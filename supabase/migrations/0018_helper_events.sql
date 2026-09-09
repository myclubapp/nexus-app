-- ============================================================================
-- 0018_helper_events: Helfer-Event mit Schichten ausschreiben (UC-011)
--
-- `event_shifts` besteht seit 0003, aber lax: Zeiten und Punktwert sind
-- optional, der Personalbedarf ungeprüft. Das Entitätsmodell verlangt beides
-- verbindlich, und BR-041/BR-042 hängen daran – eine Schicht ohne
-- Personalbedarf kann keine Unterdeckung anzeigen, eine ohne Punktwert nicht
-- bewerten.
--
-- Dazu zwei Dinge, die es noch gar nicht gibt:
--   A2       Ein Entwurf, der weder sichtbar ist noch benachrichtigt.
--   BR-044   Der Zähler, aus dem sich die Verbindungs-Quote ergibt. Ohne ihn
--            lässt sich «seit vier Wochen keine Verbindungs-Nachricht» nicht
--            beantworten.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A2: Entwurf. `published_at is null` heisst «noch nicht ausgeschrieben».
--
-- Das Entitätsmodell kennt für EVENT keinen Entwurfszustand; A2 verlangt ihn.
-- Ein eigener Zeitstempel statt einer Status-Spalte, weil er zugleich
-- beantwortet, *wann* publiziert wurde – das braucht die Verbindungs-Quote.
-- ---------------------------------------------------------------------------
alter table events add column if not exists published_at timestamptz;

-- Bestehende Termine sind ausgeschrieben; sonst verschwänden sie aus der Agenda.
update events set published_at = created_at where published_at is null;

-- ---------------------------------------------------------------------------
-- Schichten: Zeiten, Personalbedarf und Punktwert sind verbindlich.
-- ---------------------------------------------------------------------------
-- Vor dem `not null` das Bestehende auffüllen, sonst scheitert die Migration
-- an alten Zeilen.
update event_shifts s
   set starts_at = coalesce(s.starts_at, e.starts_at),
       ends_at   = coalesce(s.ends_at, e.ends_at, e.starts_at + interval '2 hours')
  from events e
 where e.id = s.event_id
   and (s.starts_at is null or s.ends_at is null);

-- Das Auffüllen der NULL-Werte genügt nicht: 0003 kannte weder einen Zeit-
-- noch einen Bedarfs-Check, also darf im Bestand alles stehen. Eine einzige
-- Zeile mit `ends_at <= starts_at` oder `needed = 0` brächte den folgenden
-- `add constraint` zu Fall – und mit ihm die ganze Migration.
update event_shifts
   set ends_at = starts_at + interval '2 hours'
 where ends_at <= starts_at;

update event_shifts set needed = 1 where needed is null or needed < 1;

update event_shifts set point_rule_code = 'shift_done' where point_rule_code is null;

alter table event_shifts alter column starts_at set not null;
alter table event_shifts alter column ends_at   set not null;
alter table event_shifts alter column point_rule_code set not null;

alter table event_shifts drop constraint if exists event_shifts_time_check;
alter table event_shifts add constraint event_shifts_time_check
  check (ends_at > starts_at);

-- BR-041: Eine Schicht nennt ihren Personalbedarf.
alter table event_shifts drop constraint if exists event_shifts_needed_check;
alter table event_shifts add constraint event_shifts_needed_check
  check (needed >= 1);

-- ---------------------------------------------------------------------------
-- A2: Ein Entwurf ist für Mitglieder nicht sichtbar.
--
-- Das gehört in die Policy und nicht in die Abfrage: Sonst stünde der Entwurf
-- zwar nicht in der Agenda, wäre aber über /rest/v1/events lesbar – und ein
-- unfertiger Aufruf ist genau das, was A2 verbergen will.
-- ---------------------------------------------------------------------------
drop policy if exists events_read on events;
create policy events_read on events
  for select using (
    is_club_member(club_id)
    and (published_at is not null or is_club_trainer(club_id))
  );

drop policy if exists shifts_read on event_shifts;
create policy shifts_read on event_shifts
  for select using (
    exists (
      select 1 from events e
      where e.id = event_id
        and is_club_member(e.club_id)
        and (e.published_at is not null or is_club_trainer(e.club_id))
    )
  );

-- ---------------------------------------------------------------------------
-- BR-044: Der Zähler für die Verbindungs-Quote.
--
-- Er trägt nie einen Personenbezug – es ist eine Vereinskennzahl, keine
-- Auswertung darüber, wer wem geschrieben hat (NFR-022).
-- ---------------------------------------------------------------------------
create table if not exists club_message_log (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  kind      text not null check (kind in ('connection', 'call')),
  reference text not null,
  sent_at   timestamptz not null default now()
);
create index if not exists club_message_log_club_idx
  on club_message_log(club_id, sent_at desc);

alter table club_message_log enable row level security;

drop policy if exists club_message_log_read on club_message_log;
create policy club_message_log_read on club_message_log
  for select using (is_club_admin(club_id));

-- Geschrieben wird ausschliesslich aus den Funktionen, die die Nachricht
-- versenden – nie direkt vom Client.
create or replace function public.log_club_message(
  p_club_id   uuid,
  p_kind      text,
  p_reference text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into club_message_log (club_id, kind, reference)
  values (p_club_id, p_kind, p_reference);
$$;

-- ---------------------------------------------------------------------------
-- A3: Wie lange ist die letzte Verbindungs-Nachricht her?
--
-- `null` heisst «noch nie» – für einen frisch gegründeten Verein ist das der
-- Normalfall und **kein** Grund, den ersten Aufruf zu bremsen.
-- ---------------------------------------------------------------------------
create or replace function public.last_connection_at(p_club_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select max(sent_at) from club_message_log
   where club_id = p_club_id and kind = 'connection';
$$;

/**
 * Greift die sanfte Sperre aus BR-044?
 *
 * Nur wenn der Verein sie ausdrücklich aktiviert hat **und** seit mehr als
 * vier Wochen eine Verbindungs-Nachricht ausblieb. Ein Verein, der noch nie
 * eine versendet hat, wird nicht gebremst: Sonst käme ein neuer Verein nie zu
 * seinem ersten Helferaufruf.
 */
create or replace function public.call_is_muted(p_club_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_enabled boolean;
  v_last    timestamptz;
begin
  select coalesce((settings->'connection'->>'muteCallsWithoutPulse')::boolean, false)
    into v_enabled
  from clubs where id = p_club_id;

  if not coalesce(v_enabled, false) then
    return false;
  end if;

  v_last := last_connection_at(p_club_id);
  if v_last is null then
    return false;
  end if;

  return now() - v_last > interval '28 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- Ein Helfer-Event ausschreiben (Schritt 8–10).
--
-- Publikation und Zustellung gehören zusammen: Ein Event, das sichtbar ist,
-- aber niemanden erreicht hat, ist der halbe Aufruf. Die sanfte Sperre setzt
-- genau hier an – sie unterdrückt die Zustellung, nicht die Sichtbarkeit.
-- ---------------------------------------------------------------------------
create or replace function public.publish_event(p_event_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_muted  boolean;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben aus';
  end if;

  -- BR-043: Ein Aufruf ohne Sinnzusammenhang wird nicht publiziert. Der
  -- check-Constraint auf `events` deckt das Anlegen ab; hier steht es
  -- nochmals, weil ein Entwurf ohne Warum bis hierher kommen darf.
  if v_event.type in ('helper','gv','social')
     and coalesce(trim(v_event.why), '') = '' then
    raise exception 'Ein Aufruf braucht sein Warum, bevor er ausgeschrieben wird';
  end if;

  -- Ein Helfer-Event ohne Schicht wäre ein Aufruf, dem niemand folgen kann.
  if v_event.type = 'helper'
     and not exists (select 1 from event_shifts where event_id = p_event_id) then
    raise exception 'Ein Helfer-Event braucht mindestens eine Schicht';
  end if;

  if v_event.published_at is null then
    update events set published_at = now() where id = p_event_id;
  end if;

  v_muted := call_is_muted(v_event.club_id);

  -- A3: Bei aktiver sanfter Sperre bleibt das Event sichtbar, der Push
  -- unterbleibt. Der Zähler bekommt trotzdem seinen Eintrag – der Aufruf
  -- ist ergangen, auch wenn er leiser war.
  if not v_muted then
    select announce_event(p_event_id) into v_count;
  end if;

  perform log_club_message(v_event.club_id, 'call', 'event:' || v_event.type);

  return query select v_count, v_muted;
end;
$$;

revoke execute on function public.log_club_message(uuid, text, text)
  from public, anon, authenticated;
grant  execute on function public.log_club_message(uuid, text, text) to service_role;

revoke execute on function public.last_connection_at(uuid) from public, anon;
grant  execute on function public.last_connection_at(uuid) to authenticated;

revoke execute on function public.call_is_muted(uuid) from public, anon;
grant  execute on function public.call_is_muted(uuid) to authenticated;

revoke execute on function public.publish_event(uuid) from public, anon;
grant  execute on function public.publish_event(uuid) to authenticated;
