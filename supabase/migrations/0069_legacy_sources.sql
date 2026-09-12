-- ============================================================================
-- 0069_legacy_sources: Termine aus der bisherigen myclub-App übernehmen (UC-040)
--
-- Ein Verein, der von der bestehenden Ionic-Angular-App (Firebase) hierher
-- wechselt, führt in der Übergangszeit beide Apps. Was der Vorstand dort
-- ausschreibt – Anlässe und Helfer-Events mit Schichten –, soll hier ohne
-- Doppelerfassung erscheinen: einmal beim Verbinden, danach jede Nacht.
--
-- Der Aufbau ist derselbe wie beim Verband (`0058`, `0060`): eine Quelle je
-- Verein, ein Abgleich, der nur **liest**, und Termine, die sich über
-- `events.external_id` wiedererkennen. Neu ist nur, dass auch **Schichten**
-- mitkommen – dafür bekommt `event_shifts` eine eigene Fremdkennung.
--
-- **BR-183: Die alte App bleibt bis zum Wechsel die Quelle.** Titel, Zeit,
-- Ort, Bedarf und Absage überschreibt jeder Lauf. Was hier entsteht –
-- Zusagen, Schicht-Einträge, Check-ins, Punkte – gehört diesem System und
-- bleibt unberührt.
--
-- **BR-184: Der Abgleich löscht nichts.** Ein Termin, der in der alten App
-- verschwindet, bleibt hier stehen; eine Schicht verschwindet nur, solange
-- niemand eingetragen ist.
--
-- **BR-185: Das Service-Konto ist ein Geheimnis des Servers.** Es liegt als
-- Secret der Edge Function, nicht in dieser Tabelle und nie auf dem Gerät.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schichten aus einer fremden Quelle erkennen sich an ihrer Kennung wieder.
-- Ohne sie würde jeder Lauf dieselben Schichten ein zweites Mal anlegen –
-- oder müsste über den Titel raten, und «Kiosk» gibt es zweimal am Tag.
-- ---------------------------------------------------------------------------
alter table event_shifts add column if not exists external_id text
  check (external_id is null or length(external_id) between 1 and 80);

create unique index if not exists event_shifts_external_uidx
  on event_shifts (event_id, external_id)
  where external_id is not null;

-- ---------------------------------------------------------------------------
-- Die Quelle: ein Verein, eine Vereinskennung der bisherigen App.
--
-- `firebase_club_id` ist die Kennung aus der Adresse der alten App
-- (`/club/su-452800`). Sie ist eindeutig über alle Vereine: Zwei Vereine, die
-- dieselbe alte Kennung nennen, wären ein Fehler, keine Konfiguration.
-- ---------------------------------------------------------------------------
create table if not exists legacy_sources (
  club_id          uuid primary key references clubs(id) on delete cascade,
  firebase_club_id text not null unique
                     check (firebase_club_id ~ '^[A-Za-z0-9_-]{2,60}$'),
  status           text not null default 'pending'
                     check (status in ('pending','active','error')),
  last_sync_at     timestamptz,
  last_error       text,
  -- Wie viele Termine der letzte gelungene Lauf gebracht hat – die Zahl, die
  -- im Blatt steht, damit der Vorstand sieht, dass etwas ankommt.
  imported_events  int not null default 0,
  created_at       timestamptz not null default now()
);

alter table legacy_sources enable row level security;

-- Die Quelle gehört dem Vorstand. Mitglieder sehen, was sie bringt: Termine.
drop policy if exists legacy_sources_read on legacy_sources;
create policy legacy_sources_read on legacy_sources
  for select using (is_club_admin(club_id));

-- Geschrieben wird ausschliesslich über die Funktionen unten.

-- ---------------------------------------------------------------------------
-- Schritte 3 bis 5: verbinden. Entsteht als `pending`; ob die Kennung trägt,
-- weiss erst der Abruf in der Edge Function.
-- ---------------------------------------------------------------------------
create or replace function public.connect_legacy_source(
  p_club_id          uuid,
  p_firebase_club_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id text := trim(coalesce(p_firebase_club_id, ''));
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand verbindet die bisherige App';
  end if;
  if v_id = '' then
    raise exception 'Ohne Vereinskennung der bisherigen App gibt es nichts zu übernehmen';
  end if;
  if exists (select 1 from legacy_sources
              where firebase_club_id = v_id and club_id <> p_club_id) then
    raise exception 'Diese Kennung ist schon mit einem anderen Verein verbunden';
  end if;

  insert into legacy_sources (club_id, firebase_club_id)
  values (p_club_id, v_id)
  on conflict (club_id) do update
    set firebase_club_id = excluded.firebase_club_id,
        status = 'pending',
        last_error = null;
end;
$$;

-- A4: Trennen beendet die Zufuhr. Die übernommenen Termine bleiben (BR-184).
create or replace function public.disconnect_legacy_source(p_club_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand trennt die bisherige App';
  end if;
  delete from legacy_sources where club_id = p_club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Das Ergebnis eines Laufs festhalten – dieselbe Regel wie beim Verband
-- (BR-155): Ein einzelner Fehlschlag ist noch kein kaputter Anschluss. Erst
-- nach drei Tagen ohne gelungenen Lauf wechselt der Zustand, und dann erfährt
-- es der Vorstand einmal, nicht täglich.
-- ---------------------------------------------------------------------------
create or replace function public.report_legacy_sync(
  p_club_id uuid,
  p_ok      boolean,
  p_error   text default null,
  p_count   int  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    legacy_sources;
  v_person record;
begin
  select * into v_row from legacy_sources where club_id = p_club_id for update;
  if not found then
    raise exception 'Diese Quelle besteht nicht';
  end if;

  if p_ok then
    update legacy_sources
       set status = 'active',
           last_sync_at = now(),
           last_error = null,
           imported_events = coalesce(p_count, imported_events)
     where club_id = p_club_id;
    return;
  end if;

  update legacy_sources
     set last_error = left(coalesce(p_error, 'unbekannt'), 500),
         status = case
           when v_row.status = 'pending' then 'error'
           when v_row.last_sync_at is null
             or now() - v_row.last_sync_at > interval '3 days' then 'error'
           else v_row.status
         end
   where club_id = p_club_id;

  if v_row.status <> 'error'
     and (select status from legacy_sources where club_id = p_club_id) = 'error' then
    for v_person in
      select m.user_id from club_members m
       where m.club_id = p_club_id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'system', 'Die Übernahme aus der bisherigen App meldet einen Fehler',
        null, '/tabs/profile/legacy', p_club_id
      );
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ein Termin der alten App als Termin hier – mit seinen Schichten.
--
-- `p_external_id` ist «legacy:event:<id>» oder «legacy:helper:<id>»; über sie
-- erkennt der nächste Lauf seinen Termin wieder (wie BR-180 beim Verband).
-- Beim ersten Mal wird er sofort ausgeschrieben (`published_at`): In der
-- alten App ist er es längst, ein Entwurf hier wäre eine Rückstufung.
--
-- `p_shifts` ist eine Liste von Objekten
--   { external_id, title, starts_at, ends_at, needed, points }.
-- Schichten werden über `(event_id, external_id)` nachgeführt; eine Schicht,
-- die in der Quelle fehlt, verschwindet nur, solange niemand eingetragen ist
-- (BR-184) – sonst bliebe ein Eintrag ohne Schicht zurück.
--
-- BR-036 verlangt für Helfer-Events und Anlässe ein Warum. Die alte App kennt
-- nur eine Beschreibung; fehlt sie, steht ein Satz, der die Herkunft nennt –
-- ehrlicher als ein erfundener Sinn, und der Vorstand kann ihn ersetzen.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_legacy_event(
  p_club_id          uuid,
  p_external_id      text,
  p_type             text,
  p_title            text,
  p_why              text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz default null,
  p_location         text default null,
  p_capacity_needed  int default null,
  p_cancelled        boolean default false,
  p_cancelled_reason text default null,
  p_shifts           jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_shift jsonb;
  v_keep  text[] := '{}';
  v_why   text;
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return null;
  end if;
  if p_type not in ('social','helper') then
    raise exception 'Die bisherige App liefert Anlässe und Helfer-Events, nicht «%»', p_type;
  end if;
  if coalesce(trim(p_title), '') = '' or p_starts_at is null then
    return null;
  end if;

  v_why := coalesce(nullif(left(trim(coalesce(p_why, '')), 500), ''),
                    'Aus der bisherigen myclub-App übernommen');

  insert into events (
    club_id, team_id, type, title, why, starts_at, ends_at, location,
    capacity_needed, cancelled_at, cancelled_reason, external_id,
    published_at, is_sample
  )
  values (
    p_club_id, null, p_type,
    left(trim(p_title), 160), v_why, p_starts_at,
    case when p_ends_at > p_starts_at then p_ends_at else null end,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    case when coalesce(p_capacity_needed, 0) >= 1 then p_capacity_needed else null end,
    case when p_cancelled then now() else null end,
    case when p_cancelled
         then coalesce(nullif(left(trim(coalesce(p_cancelled_reason, '')), 500), ''),
                       'In der bisherigen App abgesagt')
         else null end,
    p_external_id, now(), false
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    type             = excluded.type,
    title            = excluded.title,
    why              = excluded.why,
    starts_at        = excluded.starts_at,
    ends_at          = excluded.ends_at,
    location         = excluded.location,
    capacity_needed  = excluded.capacity_needed,
    -- Eine Absage kommt und geht mit der Quelle; ihr Zeitpunkt bleibt der erste.
    cancelled_at     = case when excluded.cancelled_at is null then null
                            else coalesce(events.cancelled_at, excluded.cancelled_at) end,
    cancelled_reason = excluded.cancelled_reason
  returning id into v_id;

  for v_shift in select * from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
  loop
    if coalesce(v_shift->>'external_id', '') = '' then continue; end if;
    v_keep := v_keep || (v_shift->>'external_id');

    insert into event_shifts (event_id, external_id, title, starts_at, ends_at,
                              needed, points, point_rule_code)
    values (
      v_id,
      v_shift->>'external_id',
      left(coalesce(nullif(trim(v_shift->>'title'), ''), 'Schicht'), 160),
      (v_shift->>'starts_at')::timestamptz,
      (v_shift->>'ends_at')::timestamptz,
      greatest(coalesce((v_shift->>'needed')::int, 1), 1),
      greatest(coalesce((v_shift->>'points')::int, 0), 0),
      'shift_done'
    )
    on conflict (event_id, external_id) where external_id is not null
    do update set
      title     = excluded.title,
      starts_at = excluded.starts_at,
      ends_at   = excluded.ends_at,
      needed    = excluded.needed,
      points    = excluded.points;
  end loop;

  delete from event_shifts s
   where s.event_id = v_id
     and s.external_id is not null
     and not (s.external_id = any (v_keep))
     and not exists (select 1 from attendance a where a.shift_id = s.id);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Der Anstoss: pg_cron -> pg_net -> Edge Function, wortgleich zu `0058`.
-- ---------------------------------------------------------------------------
create or replace function public.sync_legacy_sources()
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
  if not exists (select 1 from legacy_sources) then
    return null;
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'Übernahme aus der bisherigen App übersprungen: project_url oder service_role_key fehlt im Vault';
    return null;
  end if;

  select net.http_post(
           url     := v_project_url || '/functions/v1/sync-legacy',
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_service_key),
           body    := jsonb_build_object('mode', 'all'),
           timeout_milliseconds := 120000
         ) into v_request_id;

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (Vorlage `0007`): Was der Dienst braucht, bekommt nur der Dienst.
-- ---------------------------------------------------------------------------
revoke execute on function public.connect_legacy_source(uuid, text) from public, anon;
grant  execute on function public.connect_legacy_source(uuid, text) to authenticated;

revoke execute on function public.disconnect_legacy_source(uuid) from public, anon;
grant  execute on function public.disconnect_legacy_source(uuid) to authenticated;

revoke execute on function public.report_legacy_sync(uuid, boolean, text, int)
  from public, anon, authenticated;
grant  execute on function public.report_legacy_sync(uuid, boolean, text, int) to service_role;

revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb)
  from public, anon, authenticated;
grant  execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb)
  to service_role;

revoke execute on function public.sync_legacy_sources() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auftrag: einmal täglich, nach dem Verband. Ein Helfer-Event ändert sich
-- nicht stündlich, und wer es eilig hat, drückt «Jetzt übernehmen».
-- ---------------------------------------------------------------------------
select cron.unschedule('legacy-sync')
 where exists (select 1 from cron.job where jobname = 'legacy-sync');
select cron.schedule('legacy-sync', '50 4 * * *',
  $cron$select public.sync_legacy_sources();$cron$);
