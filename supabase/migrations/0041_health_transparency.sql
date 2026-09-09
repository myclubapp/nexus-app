-- ============================================================================
-- 0041_health_transparency: Was sieht mein Verein? (UC-025)
--
-- `0040` hat ein System gebaut, das Signale über Menschen speichert. Diese
-- Migration ist das Gegengewicht: Die betroffene Person bekommt vollständige
-- Auskunft (BR-105) und einen Schalter, der sofort wirkt (BR-106).
--
-- `club_members.health_opt_out` steht seit `0013` und hatte bis heute keinen
-- Weg, gesetzt zu werden.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BR-105: Alle Signale zur eigenen Person, ohne Auswahl.
--
-- Über eine Funktion und **nicht** über eine erweiterte Policy: `0040` gibt
-- Signale nur den Zuständigen (BR-096), und das soll so bleiben. Eine Policy,
-- die zusätzlich «oder ich bin die betroffene Person» sagte, wäre der bequeme
-- Weg – sie öffnete diese Zeilen aber für jede beliebige Abfrage, nicht nur
-- für diese Seite.
-- ---------------------------------------------------------------------------
create or replace function public.my_health_signals(p_club_id uuid)
returns table (
  id          uuid,
  signal_type text,
  severity    text,
  status      text,
  detected_at timestamptz,
  expires_at  timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.signal_type, s.severity, s.status, s.detected_at, s.expires_at
    from health_signals s
   where s.club_id = p_club_id
     and s.member_id = current_member_id(p_club_id)
   order by s.detected_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 6 bis 8: der Opt-out.
--
-- BR-106: Er wirkt **sofort**. Bestehende personenbezogene Signale werden in
-- derselben Anweisung gelöscht – auch eines, an dem gerade jemand arbeitet.
-- Das ist die Absicht der Regel: Die betroffene Person hat Vorrang.
--
-- BR-107: Was bleibt, sind die anonymen Team- und Vereinswerte. Der Opt-out
-- entzieht das Mitglied den individuellen Hinweisen, nicht den Aggregaten –
-- und schon gar nicht dem Punktesystem.
-- ---------------------------------------------------------------------------
create or replace function public.set_health_opt_out(
  p_club_id uuid,
  p_opt_out boolean
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_count  int := 0;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  update club_members
     set health_opt_out = coalesce(p_opt_out, false)
   where id = v_member;

  if coalesce(p_opt_out, false) then
    delete from health_signals
     where club_id = p_club_id and member_id = v_member;
    get diagnostics v_count = row_count;
  end if;

  return v_count;
end;
$$;

revoke execute on function public.my_health_signals(uuid) from public, anon;
grant  execute on function public.my_health_signals(uuid) to authenticated;

revoke execute on function public.set_health_opt_out(uuid, boolean) from public, anon;
grant  execute on function public.set_health_opt_out(uuid, boolean) to authenticated;
