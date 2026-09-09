-- ============================================================================
-- 0016_guard_last_admin_club_delete: Der Vorstandsschutz darf den Verein nicht
-- unlöschbar machen
--
-- `guard_last_admin_delete()` aus 0012 hält BR-026 durch: Die letzte Person
-- mit Vorstandsrechten lässt sich nicht austragen. Der Trigger fragt aber
-- nicht, *warum* die Zeile verschwindet. Wird der Verein selbst gelöscht,
-- räumt `club_members.club_id references clubs(id) on delete cascade` die
-- Mitgliedschaften mit ab – und der Trigger bricht genau das ab. Ein Verein
-- mit Vorstand ist damit überhaupt nicht löschbar: weder beim Aufräumen einer
-- Testumgebung noch, wenn ein Verein die Plattform verlässt.
--
-- Beim Cascade ist die Zeile in `clubs` bereits aus derselben Transaktion
-- verschwunden, wenn die Trigger der Kindtabelle laufen – Postgres löscht die
-- Elternzeile zuerst und führt die referenzielle Aktion danach aus. Die Frage
-- «gibt es den Verein noch?» trennt die beiden Fälle deshalb sauber, ohne dass
-- BR-026 im gemeinten Fall – dem Austragen eines einzelnen Mitglieds aus einem
-- fortbestehenden Verein – nachlässt.
-- ============================================================================

create or replace function public.guard_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Der Verein selbst verschwindet gerade: Es bleibt nichts zurück, das ohne
  -- Vorstand dastehen könnte, und die Regel ist gegenstandslos.
  if not exists (select 1 from clubs where id = old.club_id) then
    return old;
  end if;

  if old.role in ('admin','superadmin') and old.status <> 'left'
     and count_club_admins(old.club_id, old.id) = 0 then
    raise exception
      'Ein Verein braucht mindestens eine Person mit Vorstandsrechten.';
  end if;

  return old;
end;
$$;

-- Der Trigger `club_members_guard_last_admin_delete` aus 0012 zeigt weiterhin
-- auf diese Funktion und bleibt unverändert.

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013). `create or replace` behält die Rechte aus 0012; der
-- Widerruf steht hier noch einmal, damit die Funktion auch dann intern bleibt,
-- wenn sie je auf einer Datenbank ohne 0012 entsteht.
-- ---------------------------------------------------------------------------
revoke execute on function public.guard_last_admin_delete()
  from public, anon, authenticated;
