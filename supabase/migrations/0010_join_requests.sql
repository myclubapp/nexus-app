-- ============================================================================
-- 0010_join_requests: Beitritts-Anfrage stellen und entscheiden (UC-004)
--
-- Die Tabelle `join_requests` und ihre Policies bestehen seit 0001/0006, aber
-- es führt kein Weg dorthin: Ein Gast kann keine Anfrage stellen, und der
-- Vorstand kann keine entscheiden. Diese Migration ergänzt beides – und die
-- Zustellung, ohne die niemand vom Entscheid erfährt.
-- ============================================================================

-- Kategorie je Zustellung (Entitätsmodell NOTIFICATION). Ohne sie lässt sich
-- später nicht pro Kategorie einstellen, was zugestellt wird (FR-080).
alter table notifications add column if not exists category text not null default 'general';

-- A3: Eine zurückgezogene Anfrage ist kein abgelehnter Entscheid – sie
-- verschwindet aus der Liste, ohne dass jemand entschieden hätte.
alter table join_requests drop constraint if exists join_requests_status_check;
alter table join_requests add constraint join_requests_status_check
  check (status in ('pending','approved','rejected','withdrawn'));

-- Die Liste des Vorstands fragt genau danach.
create index if not exists join_requests_open_idx
  on join_requests(club_id, created_at desc)
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Zustellung in die Inbox.
--
-- Ab hier brauchen sie viele Use Cases: Der Entscheid über eine Anfrage, die
-- Bestätigung einer Schicht, die Erinnerung an einen Termin. Die Inbox ist der
-- Weg, der 100% der Mitglieder erreicht – auch ohne Push-Erlaubnis (NFR-009).
--
-- Intern: Sie schreibt in eine fremde Inbox und darf deshalb kein eigener
-- Endpunkt sein.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user_id  uuid,
  p_category text,
  p_title    text,
  p_body     text default null,
  p_link     text default null,
  p_club_id  uuid default null
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into notifications (user_id, club_id, category, title, body, link)
  values (p_user_id, p_club_id, p_category, p_title, p_body, p_link);
$$;

-- ---------------------------------------------------------------------------
-- Verein über seinen Kurznamen finden (UC-004, Schritt 1 der anfragenden Seite).
--
-- Ein Vereinsverzeichnis ist ausgeschlossen (C-028). Diese Funktion antwortet
-- deshalb nur auf einen **exakten** Kurznamen und gibt nur zurück, was die
-- anfragende Person ohnehin kennen muss: den Namen des Vereins. Kein
-- Mitgliederbestand, keine Suche, keine Liste.
-- ---------------------------------------------------------------------------
create or replace function public.find_club_by_slug(p_slug text)
returns table (club_id uuid, club_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, name from clubs where slug = lower(trim(p_slug));
$$;

-- ---------------------------------------------------------------------------
-- Anfrage stellen.
-- ---------------------------------------------------------------------------
create or replace function public.request_join(
  p_club_id uuid,
  p_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_club    clubs;
  v_id      uuid;
  v_admin   record;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_club from clubs where id = p_club_id;
  if not found then
    raise exception 'Verein nicht gefunden';
  end if;

  if exists (select 1 from club_members
              where club_id = p_club_id and user_id = v_user and status <> 'left') then
    raise exception 'Du gehörst diesem Verein bereits an';
  end if;

  -- Eine erneute Anfrage überschreibt eine erledigte; eine offene bleibt, wie
  -- sie ist. Die Eindeutigkeit je Verein und Konto lässt nichts anderes zu.
  insert into join_requests (club_id, team_id, user_id, status)
  values (p_club_id, p_team_id, v_user, 'pending')
  on conflict (club_id, user_id) do update
     set status     = 'pending',
         team_id    = excluded.team_id,
         decided_by = null,
         decided_at = null,
         created_at = now()
   where join_requests.status <> 'pending'
  returning id into v_id;

  if v_id is null then
    -- Es bestand bereits eine offene Anfrage; das ist kein Fehler.
    select id into v_id from join_requests
     where club_id = p_club_id and user_id = v_user;
    return v_id;
  end if;

  -- Schritt 1: Der Vorstand erfährt von der Anfrage.
  for v_admin in
    select user_id from club_members
     where club_id = p_club_id and role in ('admin','superadmin') and status <> 'left'
       and user_id is not null
  loop
    perform notify(
      v_admin.user_id, 'join_request',
      'Neue Beitritts-Anfrage',
      'Für ' || v_club.name || ' liegt eine Anfrage vor.',
      '/tabs/profile/requests', p_club_id
    );
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Über eine Anfrage entscheiden.
-- ---------------------------------------------------------------------------
create or replace function public.decide_join_request(
  p_request_id uuid,
  p_approve    boolean,
  p_role       text default 'member',
  p_team_id    uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request   join_requests;
  v_club      clubs;
  v_decider   uuid;
  v_member_id uuid;
  v_role      text;
begin
  select * into v_request from join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Anfrage nicht gefunden';
  end if;

  -- BR-013: Der Entscheid ist dem Vorstand vorbehalten, geprüft hier und nicht
  -- durch ein ausgeblendetes Bedienelement.
  if not is_club_admin(v_request.club_id) then
    raise exception 'Nur der Vorstand entscheidet über Beitritts-Anfragen';
  end if;

  if v_request.status <> 'pending' then
    -- Zwei Vorstände gleichzeitig: Der zweite Entscheid läuft ins Leere,
    -- statt den ersten zu überschreiben.
    return v_request.status;
  end if;

  select * into v_club from clubs where id = v_request.club_id;
  v_decider := current_member_id(v_request.club_id);

  -- BR-015: Ohne abweichende Wahl wird die Person Mitglied.
  v_role := coalesce(nullif(trim(p_role), ''), 'member');
  if v_role not in ('member','trainer','admin') then
    raise exception 'Unbekannte Rolle: %', v_role;
  end if;

  -- BR-014: Jeder Entscheid hält fest, wer wann entschieden hat.
  update join_requests
     set status     = case when p_approve then 'approved' else 'rejected' end,
         decided_by = v_decider,
         decided_at = now()
   where id = p_request_id;

  if not p_approve then
    -- BR-016: neutral formuliert, ohne gespeicherte Begründung.
    perform notify(
      v_request.user_id, 'join_request',
      'Entscheid zu deiner Anfrage',
      v_club.name || ' hat deine Beitritts-Anfrage nicht angenommen.',
      null, v_request.club_id
    );
    return 'rejected';
  end if;

  -- A2: Zwischen Anfrage und Entscheid kann die Person über eine Einladung
  -- beigetreten sein. Dann bleibt es bei der bestehenden Mitgliedschaft.
  select id into v_member_id
    from club_members
   where club_id = v_request.club_id and user_id = v_request.user_id;

  if v_member_id is null then
    insert into club_members (club_id, user_id, role, display_name)
    values (
      v_request.club_id, v_request.user_id, v_role,
      coalesce(
        (select nullif(raw_user_meta_data->>'full_name', '')
           from auth.users where id = v_request.user_id),
        split_part((select email from auth.users where id = v_request.user_id), '@', 1)
      )
    )
    returning id into v_member_id;
  end if;

  if coalesce(p_team_id, v_request.team_id) is not null then
    insert into team_members (team_id, member_id)
    values (coalesce(p_team_id, v_request.team_id), v_member_id)
    on conflict do nothing;
  end if;

  perform notify(
    v_request.user_id, 'join_request',
    'Willkommen bei ' || v_club.name,
    'Deine Beitritts-Anfrage wurde angenommen.',
    '/tabs/dashboard', v_request.club_id
  );

  return 'approved';
end;
$$;

-- ---------------------------------------------------------------------------
-- A3: Die anfragende Person zieht zurück.
-- ---------------------------------------------------------------------------
create or replace function public.withdraw_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request join_requests;
begin
  select * into v_request from join_requests where id = p_request_id;
  if not found then
    raise exception 'Anfrage nicht gefunden';
  end if;

  if v_request.user_id <> auth.uid() then
    raise exception 'Nur die anfragende Person kann zurückziehen';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'Über diese Anfrage wurde bereits entschieden';
  end if;

  update join_requests set status = 'withdrawn' where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013). notify() schreibt in fremde Inboxen und bleibt intern.
-- ---------------------------------------------------------------------------
revoke execute on function public.notify(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, text, uuid)
  to service_role;

revoke execute on function public.find_club_by_slug(text)                      from public, anon;
revoke execute on function public.request_join(uuid, uuid)                     from public, anon;
revoke execute on function public.decide_join_request(uuid, boolean, text, uuid) from public, anon;
revoke execute on function public.withdraw_join_request(uuid)                  from public, anon;

grant execute on function public.find_club_by_slug(text)                       to authenticated;
grant execute on function public.request_join(uuid, uuid)                      to authenticated;
grant execute on function public.decide_join_request(uuid, boolean, text, uuid) to authenticated;
grant execute on function public.withdraw_join_request(uuid)                   to authenticated;
