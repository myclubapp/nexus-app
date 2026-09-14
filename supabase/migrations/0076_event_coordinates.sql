-- ============================================================================
-- 0076_event_coordinates: die Lage des Spielorts (UC-039 BR-180, C-006)
--
-- Der Verband nennt zum Spielort nicht nur Halle und Ort, sondern auch die
-- Lage: swiss unihockey trägt in der Ortszelle `link.x` (Länge) und `link.y`
-- (Breite), WGS84. Bis jetzt kam nur der Text an; die Karte im Termin-Detail
-- braucht den Punkt.
--
-- Zwei Spalten statt `point`: PostgREST gibt `point` als Zeichenkette «(x,y)»
-- zurück, zwei Zahlen sind typisiert, und der Client rechnet nichts um.
-- Beide Werte oder keiner – ein halber Punkt ist keiner. Was der Verband
-- nicht liefert, bleibt leer: Ein Termin ohne Lage ist ein Termin ohne Karte,
-- kein Fehler. Termine von Hand haben keine Lage.
-- ============================================================================

alter table events add column if not exists latitude double precision
  check (latitude is null or latitude between -90 and 90);
alter table events add column if not exists longitude double precision
  check (longitude is null or longitude between -180 and 180);

alter table events drop constraint if exists events_coordinates_pair_check;
alter table events add constraint events_coordinates_pair_check
  check ((latitude is null) = (longitude is null));

-- ---------------------------------------------------------------------------
-- upsert_federation_game(): zwei Parameter mehr. Die alte Signatur fällt weg –
-- sonst stünden zwei Überladungen nebeneinander, und ein Aufruf ohne
-- Koordinaten wäre für Postgres mehrdeutig. Rumpf wie in `0060`, plus die
-- Lage in der Zuweisungsliste von BR-180: Sie kommt vom Verband und wird bei
-- jedem Abgleich überschrieben.
-- ---------------------------------------------------------------------------
drop function if exists public.upsert_federation_game(uuid, text, text, timestamptz, text, text);

create or replace function public.upsert_federation_game(
  p_team_id     uuid,
  p_external_id text,
  p_title       text,
  p_starts_at   timestamptz,
  p_location    text default null,
  p_result      text default null,
  p_latitude    double precision default null,
  p_longitude   double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
  v_id   uuid;
  v_lat  double precision;
  v_lng  double precision;
begin
  select * into v_team from teams where id = p_team_id;
  if not found or v_team.federation_team_id is null or v_team.federation_stale_at is not null then
    return null;
  end if;

  -- Beide oder keiner (Constraint oben) – ein halber Punkt wird verworfen,
  -- statt den Abgleich des ganzen Teams zu stoppen.
  if p_latitude is not null and p_longitude is not null then
    v_lat := p_latitude;
    v_lng := p_longitude;
  end if;

  insert into events (club_id, team_id, type, title, starts_at, location, latitude, longitude, result, external_id)
  values (
    v_team.club_id, p_team_id, 'match',
    left(trim(p_title), 160), p_starts_at,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    v_lat, v_lng,
    nullif(left(trim(coalesce(p_result, '')), 40), ''),
    p_external_id
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    team_id   = excluded.team_id,
    title     = excluded.title,
    starts_at = excluded.starts_at,
    location  = excluded.location,
    latitude  = excluded.latitude,
    longitude = excluded.longitude,
    result    = excluded.result
  returning id into v_id;

  return v_id;
end;
$$;

-- Nur der Dienst schreibt Spiele (wie in `0060`): Kein angemeldetes Konto
-- legt über diesen Weg Termine an.
revoke execute on function public.upsert_federation_game(
  uuid, text, text, timestamptz, text, text, double precision, double precision
) from public, anon, authenticated;
grant execute on function public.upsert_federation_game(
  uuid, text, text, timestamptz, text, text, double precision, double precision
) to service_role;
