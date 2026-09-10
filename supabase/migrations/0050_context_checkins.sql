-- ============================================================================
-- 0050_context_checkins: Kontext-Check-in beantworten (UC-032)
--
-- **Vorsicht mit dem Wort.** `check_in()` aus `0029` erfasst Anwesenheit über
-- einen QR-Code. Hier geht es um Befinden. Gleicher Wortstamm, andere Sache –
-- deshalb heissen die Objekte hier durchgehend `checkin_*` und nie `check_in`.
--
-- Vier der sechs Regeln dieses Use Cases sind Verzichte, keine Funktionen:
--   BR-136  Gefragt wird nur das Subjektive. Kontext und Rolle **weiss** die
--           App bereits – sie leitet sie ab, statt sie zu erfragen.
--   BR-137  Für Abwesenheit existiert kein Kontext. Nicht «wird nicht
--           gefragt», sondern: Es gibt keinen Wert, unter dem man fragen
--           könnte.
--   BR-138  Keine Punkte. Belohntes Befinden wäre verzerrtes Befinden – hier
--           entsteht deshalb **keine** Punkteregel und keine Buchung.
--   BR-139  Privat ist die Vorgabe. `shared_trainer` entsteht ausschliesslich
--           über einen eigenen Aufruf des Mitglieds.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Frage.
--
-- Die Kontextliste ist abschliessend und enthält **keinen** Wert für
-- Abwesenheit – das ist BR-137 als Schema. `office_load` kommt für FR-109 dazu;
-- er hängt nicht an einer Teilnahme, sondern an einem Amt (`0049`).
-- ---------------------------------------------------------------------------
create table if not exists checkin_prompts (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  context   text not null check (context in (
              'training_attended','match_lineup','match_bench',
              'helper_shift','office_load')),
  question  text not null check (length(trim(question)) between 3 and 300),
  scale     text not null check (scale in ('emoji5','stars5','freetext')),
  sort      int not null default 0,
  is_active boolean not null default true
);

create index if not exists checkin_prompts_club_idx
  on checkin_prompts(club_id, context, sort);

alter table checkin_prompts enable row level security;

-- Wer im Verein ist, darf die Fragen sehen; ändern darf sie der Vorstand.
drop policy if exists checkin_prompts_read on checkin_prompts;
create policy checkin_prompts_read on checkin_prompts
  for select using (is_club_member(club_id));

drop policy if exists checkin_prompts_write on checkin_prompts;
create policy checkin_prompts_write on checkin_prompts
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- Die Einladung.
--
-- Das Entitätsmodell kennt sie nicht – A1 verlangt sie trotzdem: Wer
-- überspringt, soll **nicht erneut** gefragt werden, und BR-141 braucht einen
-- Nachweis je Tag. Ohne diese Zeile wäre beides nur eine Absicht.
-- ---------------------------------------------------------------------------
create table if not exists checkin_invitations (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  member_id   uuid not null references club_members(id) on delete cascade,
  -- Leer beim Entlastungs-Index: Er hängt an einem Amt, nicht an einem Termin.
  event_id    uuid references events(id) on delete cascade,
  context     text not null check (context in (
                'training_attended','match_lineup','match_bench',
                'helper_shift','office_load')),
  -- Der Tag, an dem gefragt wurde. Er trägt BR-141 als Index, nicht als
  -- Prüfung im Code.
  asked_on    date not null default current_date,
  answered_at timestamptz,
  skipped_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- BR-141: höchstens **eine** Serie je Mitglied und Tag.
create unique index if not exists checkin_invitations_daily_idx
  on checkin_invitations(member_id, asked_on);

-- Zu einem Termin wird eine Person nie zweimal gefragt (A1, zweiter Satz).
create unique index if not exists checkin_invitations_event_idx
  on checkin_invitations(member_id, event_id)
  where event_id is not null;

create index if not exists checkin_invitations_open_idx
  on checkin_invitations(member_id, answered_at, skipped_at);

-- Beantwortet **oder** übersprungen – beides zugleich wäre kein Zustand.
alter table checkin_invitations drop constraint if exists checkin_invitations_state_check;
alter table checkin_invitations add constraint checkin_invitations_state_check
  check (answered_at is null or skipped_at is null);

alter table checkin_invitations enable row level security;

-- Eine Einladung gehört der Person, die gefragt wurde – niemandem sonst. Auch
-- **nicht** dem Vorstand: Schon zu wissen, wer gefragt wurde und wer nicht
-- geantwortet hat, wäre eine Auskunft über Befinden (BR-139).
drop policy if exists checkin_invitations_own on checkin_invitations;
create policy checkin_invitations_own on checkin_invitations
  for select using (member_id = current_member_id(club_id));

-- ---------------------------------------------------------------------------
-- Die Antwort.
-- ---------------------------------------------------------------------------
create table if not exists checkin_responses (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  member_id     uuid not null references club_members(id) on delete cascade,
  invitation_id uuid not null references checkin_invitations(id) on delete cascade,
  event_id      uuid references events(id) on delete cascade,
  prompt_id     uuid not null references checkin_prompts(id) on delete cascade,
  value_num     int check (value_num between 1 and 5),
  value_text    text check (value_text is null or length(value_text) <= 2000),
  visibility    text not null default 'private'
                  check (visibility in ('private','shared_trainer','event_organizer')),
  created_at    timestamptz not null default now()
);

-- Je Mitglied, Einladung und Frage höchstens eine Antwort.
create unique index if not exists checkin_responses_unique_idx
  on checkin_responses(invitation_id, prompt_id);

create index if not exists checkin_responses_member_idx
  on checkin_responses(member_id, created_at desc);
create index if not exists checkin_responses_club_idx
  on checkin_responses(club_id, created_at desc);

-- Eine Antwort ohne Inhalt ist keine. Als `case` und nicht als `or`-Kette:
-- Eine Kette aus Vergleichen mit NULL ergibt NULL, und ein `check`, der NULL
-- liefert, gilt als erfüllt.
alter table checkin_responses drop constraint if exists checkin_responses_value_check;
alter table checkin_responses add constraint checkin_responses_value_check
  check (
    case when value_num is null
      then coalesce(trim(value_text), '') <> ''
      else true
    end
  );

alter table checkin_responses enable row level security;

-- ---------------------------------------------------------------------------
-- Wer eine Antwort lesen darf.
--
-- Die Vorgabe ist: **niemand ausser der Person selbst** (BR-139). Zwei
-- Ausnahmen, beide vom Mitglied selbst gewählt:
--   `shared_trainer`     – die Trainer:innen des Teams, dessen Termin es war
--   `event_organizer`    – die Person, die den Einsatz ausgeschrieben hat (A4)
-- ---------------------------------------------------------------------------
drop policy if exists checkin_responses_read on checkin_responses;
create policy checkin_responses_read on checkin_responses
  for select using (
    member_id = current_member_id(club_id)
    or (
      visibility = 'shared_trainer'
      and exists (
        select 1
          from events e
          join team_members tm on tm.team_id = e.team_id
         where e.id = checkin_responses.event_id
           and tm.member_id = current_member_id(checkin_responses.club_id)
           and tm.role = 'trainer'
      )
    )
    or (
      visibility = 'event_organizer'
      and exists (
        select 1 from events e
         where e.id = checkin_responses.event_id
           and e.created_by = current_member_id(checkin_responses.club_id)
      )
    )
  );

-- Geschrieben wird ausschliesslich über die Funktionen unten.

-- ---------------------------------------------------------------------------
-- BR-136 und BR-137: der Kontext wird **abgeleitet**.
--
-- Es gibt kein Feld, in das jemand «war nicht da» eintragen könnte – die
-- Funktion gibt für Abwesenheit schlicht nichts zurück, und ohne Kontext
-- entsteht keine Einladung.
-- ---------------------------------------------------------------------------
create or replace function public.checkin_context(
  p_event_type text,
  p_status     text,
  p_shift_id   uuid
)
returns text
language sql
immutable
as $$
  select case
    -- Ein Helfereinsatz ist an der Schicht erkennbar, unabhängig vom Typ.
    when p_shift_id is not null and p_status in ('present','substitute')
      then 'helper_shift'
    when p_event_type = 'helper' and p_status in ('present','substitute')
      then 'helper_shift'
    when p_event_type in ('match','cup','tournament') and p_status = 'substitute'
      then 'match_bench'
    when p_event_type in ('match','cup','tournament') and p_status = 'present'
      then 'match_lineup'
    when p_event_type in ('training','gv','social') and p_status = 'present'
      then 'training_attended'
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Die Erstbefüllung der Fragen.
--
-- Der Wortlaut steht in der Datenbank und nicht in den Sprachdateien, weil ihn
-- der Verein anpassen können soll (Entitätsmodell: «pro Verein anpassbar»).
-- Deutsch ist die Vorgabe; ein Verein, der anders spricht, schreibt sie um.
-- ---------------------------------------------------------------------------
create or replace function public.seed_checkin_prompts(p_club_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int := 0;
begin
  if exists (select 1 from checkin_prompts where club_id = p_club_id) then
    return 0;
  end if;

  insert into checkin_prompts (club_id, context, question, scale, sort) values
    (p_club_id, 'training_attended', 'Wie ging es dir heute damit?', 'emoji5', 0),
    (p_club_id, 'match_lineup',      'Wie hast du den Einsatz erlebt?', 'emoji5', 0),
    -- A3: die eigene Frage für die Bank. Nicht «warum nicht gespielt» –
    -- danach fragt die App nie (BR-136).
    (p_club_id, 'match_bench',       'Wie war der Tag für dich?', 'emoji5', 0),
    (p_club_id, 'helper_shift',      'Wie lief dein Einsatz?', 'emoji5', 0),
    (p_club_id, 'helper_shift',      'Was lief gut, was nicht?', 'freetext', 1),
    (p_club_id, 'office_load',       'Wie tragfähig fühlt sich dein Amt gerade an?', 'stars5', 0);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 1–2: erkennen und zustellen (FR-102).
--
-- Läuft als Auftrag nach dem Terminende. Gefragt wird nur, wer teilgenommen
-- hat – für alle anderen liefert `checkin_context()` nichts (BR-137).
-- ---------------------------------------------------------------------------
create or replace function public.detect_checkins()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row     record;
  v_context text;
  v_invite  uuid;
  v_count   int := 0;
begin
  for v_row in
    select a.member_id, a.status, a.shift_id, e.id as event_id, e.type,
           e.club_id, e.title, m.user_id
      from attendance a
      join events e on e.id = a.event_id
      join club_members m on m.id = a.member_id
     where coalesce(e.ends_at, e.starts_at) between now() - interval '24 hours' and now()
       and e.published_at is not null
       and e.cancelled_at is null
       -- BR-161: Beispielinhalte lösen nichts aus.
       and not e.is_sample
       and m.status <> 'left'
       and m.user_id is not null
       -- Das Modul lässt sich im Verein abschalten.
       and coalesce((select c.settings->'checkin'->>'enabled' from clubs c
                      where c.id = e.club_id), 'true') <> 'false'
  loop
    -- Ohne dieses Zurücksetzen trüge `v_invite` den Wert des vorigen
    -- Durchlaufs weiter: `on conflict do nothing` lässt die Variable
    -- unberührt, und die nächste Person bekäme eine Meldung zu einer
    -- Einladung, die es für sie nicht gibt.
    v_invite := null;
    v_context := checkin_context(v_row.type, v_row.status, v_row.shift_id);
    if v_context is null then
      continue;
    end if;

    -- Gibt es zu diesem Kontext überhaupt eine Frage?
    if not exists (select 1 from checkin_prompts p
                    where p.club_id = v_row.club_id
                      and p.context = v_context
                      and p.is_active) then
      continue;
    end if;

    -- BR-141 und A1 stehen als Indizes; `on conflict do nothing` lässt beide
    -- wirken, ohne dass der Auftrag an einer Kollision abbricht.
    insert into checkin_invitations (club_id, member_id, event_id, context)
    values (v_row.club_id, v_row.member_id, v_row.event_id, v_context)
    on conflict do nothing
    returning id into v_invite;

    if v_invite is null then
      continue;
    end if;

    perform notify(v_row.user_id, 'checkin', 'Wie ging es dir?',
                   v_row.title, '/tabs/profile/mood', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-109: der Entlastungs-Index, quartalsweise.
--
-- Er hängt an einem Amt, nicht an einer Teilnahme – deshalb ein eigener
-- Auftrag und eine Einladung ohne Termin.
-- ---------------------------------------------------------------------------
create or replace function public.ask_office_load()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    record;
  v_invite uuid;
  v_count  int := 0;
begin
  for v_row in
    select r.club_id, r.holder_member_id as member_id, m.user_id
      from functionary_roles r
      join club_members m on m.id = r.holder_member_id
     where m.status <> 'left'
       and m.user_id is not null
       and coalesce((select c.settings->'checkin'->>'enabled' from clubs c
                      where c.id = r.club_id), 'true') <> 'false'
       -- Höchstens einmal im Quartal.
       and not exists (
         select 1 from checkin_invitations i
          where i.member_id = r.holder_member_id
            and i.context = 'office_load'
            and i.created_at > now() - interval '90 days')
  loop
    v_invite := null;
    insert into checkin_invitations (club_id, member_id, context)
    values (v_row.club_id, v_row.member_id, 'office_load')
    on conflict do nothing
    returning id into v_invite;

    if v_invite is null then
      continue;
    end if;

    perform notify(v_row.user_id, 'checkin', 'Wie tragfähig fühlt sich dein Amt an?',
                   null, '/tabs/profile/mood', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 5–7: antworten (FR-104).
--
-- Die Sichtbarkeit kommt vom Aufruf mit, weil sie in Schritt 4 **vor** der
-- Antwort steht: Wer erst danach erfährt, wer mitliest, hat nicht gewählt.
--
-- Was hier **nicht** steht, ist die Regel: Es gibt keinen Aufruf von
-- `award_points()`, keine `point_transactions`-Zeile, keine Regel `checkin_*`
-- (BR-138).
-- ---------------------------------------------------------------------------
create or replace function public.submit_checkin(
  p_invitation_id uuid,
  p_answers       jsonb,
  p_visibility    text default 'private'
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite checkin_invitations;
  v_answer jsonb;
  v_prompt checkin_prompts;
  v_num    int;
  v_text   text;
  v_count  int := 0;
begin
  select * into v_invite from checkin_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Check-in nicht gefunden';
  end if;

  if v_invite.member_id <> current_member_id(v_invite.club_id) then
    raise exception 'Dieses Check-in gehört dir nicht';
  end if;

  if v_invite.answered_at is not null or v_invite.skipped_at is not null then
    raise exception 'Dieses Check-in ist bereits erledigt';
  end if;

  if p_visibility not in ('private','shared_trainer','event_organizer') then
    raise exception 'Unbekannte Sichtbarkeit';
  end if;

  if jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'Ohne Antwort kein Check-in';
  end if;

  for v_answer in select * from jsonb_array_elements(p_answers) loop
    select * into v_prompt from checkin_prompts
     where id = (v_answer->>'promptId')::uuid
       and club_id = v_invite.club_id
       and context = v_invite.context
       and is_active;
    if not found then
      raise exception 'Diese Frage gehört nicht zu diesem Check-in';
    end if;

    v_num  := nullif(v_answer->>'value', '')::int;
    v_text := nullif(trim(coalesce(v_answer->>'text', '')), '');

    if v_num is null and v_text is null then
      continue;
    end if;

    insert into checkin_responses
      (club_id, member_id, invitation_id, event_id, prompt_id,
       value_num, value_text, visibility)
    values
      (v_invite.club_id, v_invite.member_id, v_invite.id, v_invite.event_id,
       v_prompt.id, v_num, v_text, p_visibility)
    on conflict do nothing;

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'Ohne Antwort kein Check-in';
  end if;

  update checkin_invitations set answered_at = now() where id = p_invitation_id;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1 und FR-103: überspringen.
--
-- Es wird **nichts** gespeichert ausser der Tatsache, dass nicht mehr gefragt
-- werden soll. Ein Überspringen ist keine Antwort und darf in keiner Auswertung
-- als eine erscheinen.
-- ---------------------------------------------------------------------------
create or replace function public.skip_checkin(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite checkin_invitations;
begin
  select * into v_invite from checkin_invitations where id = p_invitation_id;
  if not found then
    raise exception 'Check-in nicht gefunden';
  end if;

  if v_invite.member_id <> current_member_id(v_invite.club_id) then
    raise exception 'Dieses Check-in gehört dir nicht';
  end if;

  if v_invite.answered_at is not null then
    raise exception 'Dieses Check-in ist bereits beantwortet';
  end if;

  update checkin_invitations set skipped_at = now() where id = p_invitation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A5 und FR-104: eine einzelne Antwort teilen.
--
-- Genau **diese** Antwort, nicht den Verlauf und nicht die nächste. Teilen ist
-- ein Entscheid, kein Zustand (BR-139).
-- ---------------------------------------------------------------------------
create or replace function public.share_checkin(p_response_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_response checkin_responses;
begin
  select * into v_response from checkin_responses where id = p_response_id;
  if not found then
    raise exception 'Antwort nicht gefunden';
  end if;

  if v_response.member_id <> current_member_id(v_response.club_id) then
    raise exception 'Diese Antwort gehört dir nicht';
  end if;

  update checkin_responses set visibility = 'shared_trainer'
   where id = p_response_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-105: der eigene Verlauf.
--
-- Nur die eigene Kurve. Die Funktion nimmt keine fremde Kennung entgegen –
-- es gibt keinen Parameter, über den man jemand anderen einsetzen könnte.
-- ---------------------------------------------------------------------------
create or replace function public.my_checkin_trend(p_club_id uuid)
returns table (
  at      timestamptz,
  context text,
  value   int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.created_at, i.context, r.value_num
    from checkin_responses r
    join checkin_invitations i on i.id = r.invitation_id
   where r.club_id = p_club_id
     and r.member_id = current_member_id(p_club_id)
     and r.value_num is not null
   order by r.created_at;
$$;

-- ---------------------------------------------------------------------------
-- FR-106 und BR-140: die Team-Stimmung.
--
-- Unter fünf Antworten gibt die Funktion **nichts** zurück – keine Zahl mit
-- einem Hinweis daneben, sondern gar keine Zeile. Eine Zahl, die man mit
-- «zu wenige Daten» beschriftet, ist trotzdem eine Zahl.
-- ---------------------------------------------------------------------------
create or replace function public.team_mood(p_team_id uuid)
returns table (
  average   numeric,
  responses int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  uuid;
  v_days  int;
  v_avg   numeric;
  v_count int;
begin
  select t.club_id into v_club from teams t where t.id = p_team_id;
  if v_club is null then
    raise exception 'Team nicht gefunden';
  end if;

  if not is_club_trainer(v_club) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen Teamwerte';
  end if;

  v_days := coalesce(
    nullif((select c.settings->'checkin'->>'windowDays' from clubs c where c.id = v_club), '')::int,
    28);

  select round(avg(r.value_num), 2), count(*)
    into v_avg, v_count
    from checkin_responses r
    join events e on e.id = r.event_id
   where e.team_id = p_team_id
     and r.value_num is not null
     and r.created_at > now() - make_interval(days => v_days);

  -- BR-140: Darunter gar nichts.
  if coalesce(v_count, 0) < 5 then
    return;
  end if;

  return query select v_avg, v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A6 und FR-108: der Selbst-Nudge.
--
-- Die Meldung geht **ausschliesslich** an das Mitglied selbst. Es gibt in
-- dieser Funktion keine zweite Empfängerin – und das ist der ganze Punkt.
-- ---------------------------------------------------------------------------
create or replace function public.nudge_low_checkins()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in
    select r.member_id, r.club_id, m.user_id, count(*) as low
      from checkin_responses r
      join club_members m on m.id = r.member_id
     where r.value_num is not null
       and r.value_num <= 2
       and r.created_at > now() - interval '28 days'
       and m.user_id is not null
       and m.status <> 'left'
     group by r.member_id, r.club_id, m.user_id
    having count(*) >= 3
  loop
    -- Nicht öfter als einmal im Monat – ein Nudge, der wiederkehrt, ist eine
    -- Mahnung.
    if exists (select 1 from notifications n
                where n.user_id = v_row.user_id
                  and n.category = 'checkin'
                  and n.title like 'Magst du%'
                  and n.created_at > now() - interval '28 days') then
      continue;
    end if;

    perform notify(v_row.user_id, 'checkin',
                   'Magst du darüber reden?',
                   null, '/tabs/profile/mood', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte. Eine neue `security definer`-Funktion ist sofort ein offener
-- Endpunkt (CLAUDE.md).
-- ---------------------------------------------------------------------------
revoke execute on function public.checkin_context(text, text, uuid) from public, anon;
grant  execute on function public.checkin_context(text, text, uuid) to authenticated;

revoke execute on function public.submit_checkin(uuid, jsonb, text) from public, anon;
grant  execute on function public.submit_checkin(uuid, jsonb, text) to authenticated;

revoke execute on function public.skip_checkin(uuid) from public, anon;
grant  execute on function public.skip_checkin(uuid) to authenticated;

revoke execute on function public.share_checkin(uuid) from public, anon;
grant  execute on function public.share_checkin(uuid) to authenticated;

revoke execute on function public.my_checkin_trend(uuid) from public, anon;
grant  execute on function public.my_checkin_trend(uuid) to authenticated;

revoke execute on function public.team_mood(uuid) from public, anon;
grant  execute on function public.team_mood(uuid) to authenticated;

revoke execute on function public.seed_checkin_prompts(uuid) from public, anon;
grant  execute on function public.seed_checkin_prompts(uuid) to authenticated;

-- Die Aufträge laufen im Auftrag, nicht auf Zuruf.
revoke execute on function public.detect_checkins() from public, anon, authenticated;
revoke execute on function public.ask_office_load() from public, anon, authenticated;
revoke execute on function public.nudge_low_checkins() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aufträge.
-- ---------------------------------------------------------------------------
select cron.unschedule('checkin-detect')
 where exists (select 1 from cron.job where jobname = 'checkin-detect');
select cron.schedule('checkin-detect', '25 * * * *',
  $cron$select public.detect_checkins();$cron$);

select cron.unschedule('checkin-office-load')
 where exists (select 1 from cron.job where jobname = 'checkin-office-load');
select cron.schedule('checkin-office-load', '35 6 1 */3 *',
  $cron$select public.ask_office_load();$cron$);

select cron.unschedule('checkin-nudge')
 where exists (select 1 from cron.job where jobname = 'checkin-nudge');
select cron.schedule('checkin-nudge', '45 7 * * 1',
  $cron$select public.nudge_low_checkins();$cron$);
