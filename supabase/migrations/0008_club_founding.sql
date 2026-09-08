-- ============================================================================
-- 0008_club_founding: UC-001 «Verein gründen» vollständig
--
-- Die Gründung soll den Verein sofort benutzbar hinterlassen (K7, BR-002).
-- 0005 legt Verein, Vorstand und Punkteregeln an, lässt aber zwei Dinge offen,
-- die danach von Hand nachgeholt werden müssten: den Saisonbeginn – ohne ihn
-- rechnet season_label() gegen das Kalenderjahr – und die Terminlabels, ohne
-- die eine Musikgesellschaft «Training» statt «Probe» liest (C-009, FR-112).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Standard-Terminlabels je Vereinsart.
--
-- Die Vereinsart steuert ausschliesslich Vorlagen (BR-001): Was hier gesetzt
-- wird, ist ein Vorschlag, den die Vereinseinstellungen jederzeit überschreiben.
-- Die Schlüssel entsprechen den Werten von events.type.
-- ---------------------------------------------------------------------------
create or replace function public.default_event_labels(p_club_kind text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_club_kind
    when 'music' then jsonb_build_object(
      'training',   'Probe',
      'match',      'Konzert',
      'cup',        'Wettbewerb',
      'tournament', 'Musiktag',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    when 'culture' then jsonb_build_object(
      'training',   'Probe',
      'match',      'Aufführung',
      'cup',        'Wettbewerb',
      'tournament', 'Festival',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    when 'youth' then jsonb_build_object(
      'training',   'Gruppenstunde',
      'match',      'Aktion',
      'cup',        'Wettkampf',
      'tournament', 'Lager',
      'gv',         'Vereinsversammlung',
      'social',     'Anlass',
      'helper',     'Helfereinsatz'
    )
    when 'neighborhood' then jsonb_build_object(
      'training',   'Treffen',
      'match',      'Aktion',
      'cup',        'Wettbewerb',
      'tournament', 'Quartierfest',
      'gv',         'Versammlung',
      'social',     'Anlass',
      'helper',     'Helfereinsatz'
    )
    when 'sport' then jsonb_build_object(
      'training',   'Training',
      'match',      'Spiel',
      'cup',        'Cup',
      'tournament', 'Turnier',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    else jsonb_build_object(
      'training',   'Treffen',
      'match',      'Anlass',
      'cup',        'Wettbewerb',
      'tournament', 'Grossanlass',
      'gv',         'Versammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Vorgeschlagener Saisonbeginn je Vereinsart, als Monat und Tag.
--
-- Gegenstück zu defaultSeasonStart() in src/lib/clubKind.ts. Der Wizard zeigt
-- den Vorschlag an, die Datenbank setzt ihn, wenn der Client keinen mitgibt –
-- laufen die beiden auseinander, sieht die Gründerin einen anderen Wert als
-- den gespeicherten.
-- ---------------------------------------------------------------------------
create or replace function public.default_season_start(p_club_kind text)
returns date
language sql
stable
set search_path = public, pg_temp
as $$
  select make_date(
    extract(year from current_date)::int,
    case p_club_kind
      when 'sport'  then 7   -- Sommerpause zwischen zwei Saisons
      when 'music'  then 9   -- Vereinsjahr nach den Sommerferien
      when 'culture' then 9
      when 'youth'  then 8   -- Schuljahr
      else 1                 -- Quartier und Anderes rechnen im Kalenderjahr
    end,
    1
  );
$$;

-- ---------------------------------------------------------------------------
-- Verein gründen – ersetzt die Fassung aus 0005_onboarding.sql.
--
-- Die alte Signatur wird unten gelöscht: Ein zusätzlicher Parameter mit
-- Vorgabewert erzeugt eine zweite Funktion, keine Ersetzung. Beide blieben
-- erreichbar, der Aufruf mit zwei Argumenten würde mehrdeutig, und die alte
-- Fassung hinge weiter als RPC unter /rest/v1/ (NFR-013).
-- ---------------------------------------------------------------------------
create or replace function public.create_club(
  p_name         text,
  p_club_kind    text default 'other',
  p_season_start date default null,
  p_kind_label   text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user     uuid := auth.uid();
  v_club_id  uuid;
  v_slug     text;
  v_suffix   int := 0;
  v_name     text;
  v_kind     text;
  v_settings jsonb;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_name := trim(p_name);
  if length(v_name) < 2 then
    raise exception 'Der Vereinsname ist zu kurz';
  end if;

  -- Eine unbekannte Vereinsart fiele sonst in den check-Constraint und
  -- brächte eine Meldung, die niemandem hilft.
  v_kind := coalesce(nullif(trim(p_club_kind), ''), 'other');
  if v_kind not in ('sport','music','culture','youth','neighborhood','other') then
    raise exception 'Unbekannte Vereinsart: %', v_kind;
  end if;

  -- A1: Der Kurzname bekommt eine Unterscheidung, bis er eindeutig ist.
  v_slug := slugify(v_name);
  if v_slug = '' then
    v_slug := 'verein';
  end if;
  while exists (select 1 from clubs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := coalesce(nullif(slugify(v_name), ''), 'verein') || '-' || v_suffix;
  end loop;

  v_settings := jsonb_build_object('labels', default_event_labels(v_kind));

  -- Bei «Anderes» trägt der Verein seine eigene Bezeichnung; club_kind bleibt
  -- 'other', damit die Vorlagenlogik weiterhin greift (BR-001).
  if nullif(trim(coalesce(p_kind_label, '')), '') is not null then
    v_settings := v_settings || jsonb_build_object('kindLabel', trim(p_kind_label));
  end if;

  insert into clubs (name, slug, club_kind, season_start, settings)
  values (
    v_name,
    v_slug,
    v_kind,
    coalesce(p_season_start, default_season_start(v_kind)),
    v_settings
  )
  returning id into v_club_id;

  -- BR-003: Die gründende Person ist der erste Vorstand. Ohne diesen Schritt
  -- hätte der neue Verein niemanden, der ihn verwalten darf.
  insert into club_members (club_id, user_id, role, display_name)
  values (
    v_club_id,
    v_user,
    'admin',
    coalesce(
      (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = v_user),
      split_part((select email from auth.users where id = v_user), '@', 1)
    )
  );

  perform seed_point_rules(v_club_id, v_kind);

  return v_club_id;
end;
$$;

drop function if exists public.create_club(text, text);

-- Interne Vorlagen-Helfer: Sie haben als eigener Endpunkt keinen Zweck.
revoke execute on function public.default_event_labels(text)
  from public, anon, authenticated;
revoke execute on function public.default_season_start(text)
  from public, anon, authenticated;
grant execute on function public.default_event_labels(text)  to service_role;
grant execute on function public.default_season_start(text)  to service_role;

-- `revoke ... from anon` allein genügt nicht: anon zieht sein Recht aus PUBLIC.
revoke execute on function public.create_club(text, text, date, text)
  from public, anon;
grant execute on function public.create_club(text, text, date, text)
  to authenticated;
