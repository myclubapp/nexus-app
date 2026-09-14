-- ============================================================================
-- 0084_email_notifications: Meldungen per E-Mail (UC-044)
--
-- Seit 0045 entsteht jede Meldung an einer Stelle (`notify()`), und dort wird
-- auch entschieden, ob sie als Push hinausgehen darf. E-Mail ist deshalb kein
-- zweites Meldungssystem, sondern ein zweiter Vermerk an derselben Zeile –
-- und ein zweiter Abholer: alle fünf Minuten sammelt ein Cron-Lauf die
-- fälligen Zeilen ein und reicht sie an die Edge Function `send-mail`, die
-- sie in der Sprache der Person rendert und über den Vereins-SMTP verschickt.
--
-- Drei Regeln, die hier festgeschrieben sind:
--
-- * **Die Inbox bleibt** (BR-117). Abwählbar ist nur der Mail-Vermerk.
-- * **Fürsorge und Befinden gehen nie per Mail** (BR-210). Ein Postfach
--   lesen auch andere; «Ein Hinweis wartet auf dich» gehört nicht dorthin
--   (NFR-022). Diese Regel steht über jeder Einstellung.
-- * **Der Modus bündelt, die Dringlichkeit bricht** (BR-211). Wer «täglich»
--   wählt, bekommt eine Zusammenfassung um 18:00; wer «wöchentlich» wählt,
--   sonntags um 18:00. Absagen, der Beitritts-Entscheid und der Vereins-Puls
--   warten nicht – der Puls ist die Wochenmail, eine Absage die einzige
--   Meldung, bei der Verspätung Schaden anrichtet.
--
-- Bestehende Zeilen bleiben ohne Vermerk (`email_wanted` false als Vorgabe):
-- Der erste Lauf verschickt keinen Rückstand aus Wochen, in denen es den
-- Kanal nicht gab.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Einstellungen: die dritte Spalte der Matrix, der Modus und die Sprache.
--
-- Die Sprache steht hier, weil die App sie sonst nirgends auf dem Server
-- hält: i18next merkt sie sich im Gerät. Eine Mail in der falschen Sprache
-- wäre der häufigste Grund, den Kanal abzuschalten.
-- ---------------------------------------------------------------------------
alter table notification_settings
  add column if not exists email      jsonb not null default '{}'::jsonb,
  add column if not exists email_mode text  not null default 'daily'
    check (email_mode in ('immediate', 'daily', 'weekly', 'off')),
  add column if not exists locale     text
    check (locale in ('de', 'fr', 'it', 'en'));

-- Der Vermerk an der Zeile, wortgleich zum Push-Vermerk aus 0045 – plus das,
-- was ein Versand braucht, der auch scheitern kann: Versuche, Fehler und die
-- Sperre, damit zwei Läufe nicht dieselbe Zeile verschicken.
alter table notifications
  add column if not exists email_wanted     boolean not null default false,
  add column if not exists email_after      timestamptz,
  add column if not exists email_sent_at    timestamptz,
  add column if not exists email_attempts   smallint not null default 0,
  add column if not exists email_claimed_at timestamptz,
  add column if not exists email_error      text;

-- Der Index, den der Abholer braucht: die offenen Mail-Zeilen. Nach fünf
-- Versuchen gibt er eine Zeile auf – ein SMTP, der eine Adresse dauerhaft
-- ablehnt, soll den Lauf nicht jede fünf Minuten neu beschäftigen.
create index if not exists notifications_email_pending_idx
  on notifications (email_after nulls first)
  where email_wanted and email_sent_at is null and email_attempts < 5;

-- ---------------------------------------------------------------------------
-- Die Entscheidung. Gegenstück zu `push_decision()`.
--
-- Rückgabe: `wanted` false heisst «gar nicht». `after_at` null heisst
-- «beim nächsten Lauf», ein Zeitstempel heisst «erst dann» – das Ende des
-- Tages oder der Woche, je nach Modus.
-- ---------------------------------------------------------------------------
create or replace function public.email_decision(
  p_user_id  uuid,
  p_category text,
  p_urgent   boolean default false,
  p_at       timestamptz default now()
)
returns table (wanted boolean, after_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings notification_settings;
  v_mode     text := 'daily';
  v_local    timestamp;
  v_target   timestamp;
begin
  -- BR-210: über jeder Einstellung.
  if p_category in ('health', 'checkin') then
    return query select false, null::timestamptz;
    return;
  end if;

  select * into v_settings from notification_settings where user_id = p_user_id;
  if found then
    v_mode := v_settings.email_mode;

    if v_mode = 'off' then
      return query select false, null::timestamptz;
      return;
    end if;

    -- BR-118 gilt auch hier: je Kategorie, fehlende Kategorie ist erlaubt.
    if v_settings.email ? p_category
       and not coalesce((v_settings.email->>p_category)::boolean, true) then
      return query select false, null::timestamptz;
      return;
    end if;
  end if;

  -- BR-211: Dringendes und der Puls warten nicht.
  if p_urgent or p_category = 'pulse' or v_mode = 'immediate' then
    return query select true, null::timestamptz;
    return;
  end if;

  v_local := p_at at time zone 'Europe/Zurich';

  if v_mode = 'weekly' then
    -- Sonntag 18:00; ist der heute schon vorbei, der nächste.
    v_target := date_trunc('day', v_local)
      + ((7 - extract(isodow from v_local)::int) * interval '1 day')
      + time '18:00';
    if v_local >= v_target then
      v_target := v_target + interval '7 days';
    end if;
  else
    -- täglich 18:00
    v_target := date_trunc('day', v_local) + time '18:00';
    if v_local >= v_target then
      v_target := v_target + interval '1 day';
    end if;
  end if;

  return query select true, v_target at time zone 'Europe/Zurich';
end;
$$;

-- ---------------------------------------------------------------------------
-- `notify()` bekommt die Dringlichkeit als siebten Parameter.
--
-- Die alte Signatur muss weg, sonst stehen zwei Funktionen nebeneinander und
-- jeder positionale Aufruf mit sechs Argumenten ist nicht mehr eindeutig.
-- Alle bestehenden Aufrufer bleiben gültig – der Parameter hat eine Vorgabe.
-- ---------------------------------------------------------------------------
drop function if exists public.notify(uuid, text, text, text, text, uuid);

create or replace function public.notify(
  p_user_id  uuid,
  p_category text,
  p_title    text,
  p_body     text default null,
  p_link     text default null,
  p_club_id  uuid default null,
  p_urgent   boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_push  record;
  v_email record;
begin
  select * into v_push  from push_decision(p_user_id, p_category);
  select * into v_email from email_decision(p_user_id, p_category, p_urgent);

  insert into notifications
    (user_id, club_id, category, title, body, link,
     push_wanted, push_after, email_wanted, email_after)
  values
    (p_user_id, p_club_id, p_category, p_title, p_body, p_link,
     v_push.wanted, v_push.after_at, v_email.wanted, v_email.after_at);
end;
$$;

revoke execute on function public.notify(uuid, text, text, text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, text, uuid, boolean)
  to service_role;

revoke execute on function public.email_decision(uuid, text, boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.email_decision(uuid, text, boolean, timestamptz)
  to service_role;

-- ---------------------------------------------------------------------------
-- Die zwei Quellen, die dringend sind (BR-211). Rümpfe wortgleich zur jeweils
-- jüngsten Fassung (`cancel_event` aus 0078, `decide_join_request` aus 0010);
-- geändert ist allein das siebte Argument von `notify()`.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_event(
  p_event_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_reason text;
  v_person record;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sagen Termine ab';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  if v_event.cancelled_at is not null then
    -- Zweimal absagen ändert nichts und benachrichtigt niemanden erneut.
    return;
  end if;

  update events
     set cancelled_at = now(), cancelled_reason = v_reason
   where id = p_event_id;

  -- Der Grund erreicht alle Betroffenen, nicht nur die Zugesagten.
  for v_person in
    select distinct m.user_id
    from club_members m
    left join team_members tm on tm.member_id = m.id
    where m.club_id = v_event.club_id
      and m.status <> 'left'
      and m.user_id is not null
      and (v_event.team_id is null or tm.team_id = v_event.team_id)
  loop
    perform notify(
      v_person.user_id, 'event',
      'Abgesagt: ' || v_event.title,
      v_reason, '/tabs/agenda?event=' || p_event_id, v_event.club_id,
      true
    );
  end loop;
end;
$$;

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
      null, v_request.club_id,
      true
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
    '/tabs/dashboard', v_request.club_id,
    true
  );

  return 'approved';
end;
$$;

-- ---------------------------------------------------------------------------
-- Einstellungen setzen: dieselbe Funktion wie in 0045, um drei Parameter
-- erweitert. Die alte Signatur weicht, sonst wäre der Aufruf mehrdeutig.
--
-- `null` heisst überall «unverändert lassen» – die App schickt trotzdem
-- immer alles, was sie zeigt.
-- ---------------------------------------------------------------------------
drop function if exists public.set_notification_settings(jsonb, time, time);

create or replace function public.set_notification_settings(
  p_push       jsonb default null,
  p_quiet_from time  default null,
  p_quiet_to   time  default null,
  p_email      jsonb default null,
  p_email_mode text  default null,
  p_locale     text  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Ein halbes Fenster ist kein Fenster.
  if (p_quiet_from is null) <> (p_quiet_to is null) then
    raise exception 'Eine stille Zeit braucht Anfang und Ende';
  end if;

  if p_email_mode is not null
     and p_email_mode not in ('immediate', 'daily', 'weekly', 'off') then
    raise exception 'Unbekannter E-Mail-Modus: %', p_email_mode;
  end if;

  if p_locale is not null and p_locale not in ('de', 'fr', 'it', 'en') then
    raise exception 'Unbekannte Sprache: %', p_locale;
  end if;

  insert into notification_settings
    (user_id, push, quiet_from, quiet_to, email, email_mode, locale, updated_at)
  values
    (auth.uid(), coalesce(p_push, '{}'::jsonb), p_quiet_from, p_quiet_to,
     coalesce(p_email, '{}'::jsonb), coalesce(p_email_mode, 'daily'), p_locale, now())
  on conflict (user_id) do update
     set push       = coalesce(p_push, notification_settings.push),
         quiet_from = excluded.quiet_from,
         quiet_to   = excluded.quiet_to,
         email      = coalesce(p_email, notification_settings.email),
         email_mode = coalesce(p_email_mode, notification_settings.email_mode),
         locale     = coalesce(p_locale, notification_settings.locale),
         updated_at = now();
end;
$$;

revoke execute on function public.set_notification_settings(jsonb, time, time, jsonb, text, text)
  from public, anon;
grant  execute on function public.set_notification_settings(jsonb, time, time, jsonb, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Nur die Sprache. Die App ruft das beim Start und beim Sprachwechsel auf –
-- auch für Personen, die die Einstellungsseite nie geöffnet haben. Ohne
-- diesen Weg bekäme jede von ihnen die Mail in der Vorgabesprache.
-- ---------------------------------------------------------------------------
create or replace function public.set_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;
  if p_locale not in ('de', 'fr', 'it', 'en') then
    raise exception 'Unbekannte Sprache: %', p_locale;
  end if;

  insert into notification_settings (user_id, locale, updated_at)
  values (auth.uid(), p_locale, now())
  on conflict (user_id) do update
     set locale = excluded.locale
   where notification_settings.locale is distinct from excluded.locale;
end;
$$;

revoke execute on function public.set_locale(text) from public, anon;
grant  execute on function public.set_locale(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Der Abholer. Nur die Edge Function ruft ihn (service_role).
--
-- Er nimmt **ganze Personen**: erst bis zu 50 Konten mit fälligen Zeilen,
-- dann alle fälligen Zeilen dieser Konten. So wird eine Zusammenfassung nie
-- über zwei Läufe zerschnitten. Jede Zeile wird beim Abholen gesperrt
-- (`email_claimed_at`) und zählt einen Versuch; die Sperre verfällt nach zehn
-- Minuten, falls die Function abstürzt, bevor sie quittiert.
--
-- Konten ohne Adresse (Anmeldung ohne E-Mail) werden ausgetragen statt fünf
-- Mal versucht.
-- ---------------------------------------------------------------------------
create or replace function public.pending_mail(p_user_limit int default 50)
returns table (
  id            uuid,
  user_id       uuid,
  email         text,
  locale        text,
  email_mode    text,
  display_name  text,
  club_id       uuid,
  club_name     text,
  club_color    text,
  category      text,
  title         text,
  body          text,
  link          text,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Konten ohne Adresse: kein Versand, kein weiterer Versuch.
  update notifications n
     set email_wanted = false,
         email_error  = 'Konto ohne E-Mail-Adresse'
    from auth.users u
   where u.id = n.user_id
     and u.email is null
     and n.email_wanted and n.email_sent_at is null;

  return query
  with due_users as (
    select distinct n.user_id
      from notifications n
     where n.email_wanted and n.email_sent_at is null and n.email_attempts < 5
       and (n.email_after is null or n.email_after <= now())
       and (n.email_claimed_at is null
            or n.email_claimed_at < now() - interval '10 minutes')
     limit p_user_limit
  ),
  claimed as (
    update notifications n
       set email_claimed_at = now(),
           email_attempts   = n.email_attempts + 1
      from due_users d
     where n.user_id = d.user_id
       and n.email_wanted and n.email_sent_at is null and n.email_attempts < 5
       and (n.email_after is null or n.email_after <= now())
       and (n.email_claimed_at is null
            or n.email_claimed_at < now() - interval '10 minutes')
    returning n.id, n.user_id, n.club_id, n.category, n.title, n.body, n.link, n.created_at
  )
  select c.id, c.user_id, u.email::text, s.locale, coalesce(s.email_mode, 'daily'),
         m.display_name, c.club_id, cl.name, cl.settings->'theme'->>'primary',
         c.category, c.title, c.body, c.link, c.created_at
    from claimed c
    join auth.users u on u.id = c.user_id
    left join notification_settings s on s.user_id = c.user_id
    left join clubs cl on cl.id = c.club_id
    left join lateral (
      select cm.display_name from club_members cm
       where cm.user_id = c.user_id
         and (c.club_id is null or cm.club_id = c.club_id)
       order by cm.member_since limit 1
    ) m on true
   order by c.user_id, c.created_at;
end;
$$;

create or replace function public.mark_mail_sent(p_ids uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update notifications
     set email_sent_at = now(), email_error = null
   where id = any(p_ids);
$$;

create or replace function public.mark_mail_failed(p_ids uuid[], p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update notifications
     set email_error = left(p_error, 500), email_claimed_at = null
   where id = any(p_ids);
$$;

revoke execute on function public.pending_mail(int)            from public, anon, authenticated;
revoke execute on function public.mark_mail_sent(uuid[])       from public, anon, authenticated;
revoke execute on function public.mark_mail_failed(uuid[], text) from public, anon, authenticated;
grant  execute on function public.pending_mail(int)            to service_role;
grant  execute on function public.mark_mail_sent(uuid[])       to service_role;
grant  execute on function public.mark_mail_failed(uuid[], text) to service_role;

-- ---------------------------------------------------------------------------
-- Der Anstoss: pg_cron -> pg_net -> Edge Function. Wortgleich zum Aufbau in
-- 0023 und 0058. Gibt es nichts Fälliges, wird die Function nicht bemüht.
-- ---------------------------------------------------------------------------
create or replace function public.send_pending_mail()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_project_url text;
  v_service_key text;
  v_request_id  bigint;
begin
  if not exists (
    select 1 from notifications n
     where n.email_wanted and n.email_sent_at is null and n.email_attempts < 5
       and (n.email_after is null or n.email_after <= now())
       and (n.email_claimed_at is null
            or n.email_claimed_at < now() - interval '10 minutes')
  ) then
    return null;
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'send_pending_mail: vault-Geheimnisse project_url und service_role_key fehlen – kein Versand';
    return null;
  end if;

  select net.http_post(
    url     := v_project_url || '/functions/v1/send-mail',
    body    := jsonb_build_object('mode', 'run'),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.send_pending_mail()
  from public, anon, authenticated;
grant execute on function public.send_pending_mail() to service_role;

-- Alle fünf Minuten. Sofortiges kommt damit binnen fünf Minuten, die
-- Zusammenfassungen um 18:00 in derselben Frist.
select cron.schedule(
  'mail-send',
  '*/5 * * * *',
  $job$select public.send_pending_mail()$job$
);
