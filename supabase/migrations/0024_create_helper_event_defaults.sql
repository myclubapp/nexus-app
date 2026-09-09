-- ============================================================================
-- 0024_create_helper_event_defaults: Ende und Ort sind wirklich optional
--
-- `create_helper_event()` aus 0021 nahm alle sechs Argumente als Pflicht. Ein
-- Helferaufruf kennt aber weder zwingend ein Ende noch einen Ort – das
-- Formular lässt beide leer, und `events` erlaubt beide `null`.
--
-- Aufgefallen ist es am generierten Typ: Ohne Vorgabewert erzeugt
-- `supabase gen types` ein `p_ends_at: string`, und der Client kann das `null`,
-- das er tatsächlich schickt, nicht mehr ausdrücken. Der Typ hatte recht – die
-- Signatur war falsch, nicht der Aufruf.
--
-- Nummer 0024, weil 0022 und 0023 für die News-Migrationen einer parallelen
-- Arbeit reserviert sind. Lücken in der Nummerierung sind folgenlos, eine
-- doppelt vergebene Nummer nicht.
-- ============================================================================

create or replace function public.create_helper_event(
  p_title     text,
  p_why       text,
  p_starts_at timestamptz,
  p_ends_at   timestamptz default null,
  p_location  text default null,
  p_shifts    jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   uuid;
  v_member uuid;
  v_event  uuid;
begin
  select cm.club_id, cm.id into v_club, v_member
    from club_members cm
   where cm.user_id = auth.uid()
     and cm.role in ('admin','superadmin')
   limit 1;

  if v_club is null then
    raise exception 'Nur der Vorstand schreibt einen Helferaufruf aus';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Ein Helferaufruf braucht einen Titel';
  end if;

  if jsonb_typeof(p_shifts) <> 'array' or jsonb_array_length(p_shifts) = 0 then
    raise exception 'Ein Helfer-Event braucht mindestens eine Schicht';
  end if;

  -- Immer als Entwurf: `publish_event()` macht daraus einen Aufruf. So ist A2
  -- kein Sonderweg, sondern der Normalfall, bei dem der zweite Schritt
  -- einfach ausbleibt.
  insert into events (club_id, type, title, why, starts_at, ends_at, location,
                      created_by, published_at)
  values (v_club, 'helper', trim(p_title), nullif(trim(coalesce(p_why, '')), ''),
          p_starts_at, p_ends_at, nullif(trim(coalesce(p_location, '')), ''),
          v_member, null)
  returning id into v_event;

  insert into event_shifts (event_id, title, starts_at, ends_at, needed, points,
                            point_rule_code)
  select v_event,
         trim(s->>'title'),
         (s->>'starts_at')::timestamptz,
         (s->>'ends_at')::timestamptz,
         (s->>'needed')::int,
         (s->>'points')::int,
         coalesce(s->>'point_rule_code', 'shift_done')
    from jsonb_array_elements(p_shifts) as s;

  return v_event;
end;
$$;

revoke execute on function
  public.create_helper_event(text, text, timestamptz, timestamptz, text, jsonb)
  from public, anon;
grant execute on function
  public.create_helper_event(text, text, timestamptz, timestamptz, text, jsonb)
  to authenticated;
