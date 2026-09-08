-- ============================================================================
-- 0007_function_grants: Der Ledger bleibt in Serverhand
--
-- Postgres vergibt EXECUTE auf jede neue Funktion automatisch an `public`,
-- Supabase legt zusätzlich Grants für `anon` und `authenticated` an. Bei einer
-- `security definer`-Funktion heisst das: Sie hängt als Endpunkt unter
-- /rest/v1/rpc/ und umgeht dabei genau die RLS, die sie schützen soll.
--
-- award_points() prüft den Aufrufer bewusst nicht – sie ist die interne
-- Buchungsroutine, die check_in() und confirm_shift() aus ihrer eigenen
-- Definer-Kette heraus aufrufen. Ohne den Entzug unten könnte jede angemeldete
-- Person über /rest/v1/rpc/award_points beliebige Punkte auf beliebige
-- Mitglieder buchen – das `insert`-Verbot aus 0006_rls wäre wirkungslos
-- (CLAUDE.md «Punkte schreibt nur der Server», Architektur §10).
-- ============================================================================

revoke execute on function public.award_points(uuid, text, text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.award_points(uuid, text, text, uuid, text)
  to service_role;

-- seed_point_rules() gehört zu create_club() und hat als eigener Endpunkt
-- keinen Zweck: Sie schreibt Regelvorlagen in einen beliebigen Verein.
revoke execute on function public.seed_point_rules(uuid, text)
  from public, anon, authenticated;
grant execute on function public.seed_point_rules(uuid, text)
  to service_role;

-- Die übrigen RPCs prüfen den Aufrufer selbst über current_member_id() bzw.
-- is_club_admin(). Anonym sind sie ohnehin sinnlos – die Tür bleibt trotzdem zu.
--
-- Achtung: `revoke ... from anon` allein genügt nicht. `anon` ist Mitglied der
-- Rolle PUBLIC, und Postgres' Default-Grant an PUBLIC (`=X/...` in proacl)
-- bleibt dabei stehen. Erst der Entzug von PUBLIC schliesst die Tür; das
-- explizite Grant an `authenticated` hält sie für angemeldete Personen offen.
revoke execute on function public.check_in(uuid, text)      from public, anon;
revoke execute on function public.claim_task(uuid)          from public, anon;
revoke execute on function public.confirm_task(uuid, text)  from public, anon;
revoke execute on function public.confirm_shift(uuid, uuid) from public, anon;
revoke execute on function public.create_club(text, text)   from public, anon;
revoke execute on function public.redeem_invite(text)       from public, anon;

grant execute on function public.check_in(uuid, text)      to authenticated;
grant execute on function public.claim_task(uuid)          to authenticated;
grant execute on function public.confirm_task(uuid, text)  to authenticated;
grant execute on function public.confirm_shift(uuid, uuid) to authenticated;
grant execute on function public.create_club(text, text)   to authenticated;
grant execute on function public.redeem_invite(text)       to authenticated;

-- is_club_member(), is_club_admin() und current_member_id() behalten ihr
-- anon-Recht: Sie stehen in den RLS-Policies, und eine anonyme Abfrage soll
-- eine leere Trefferliste ergeben, keinen «permission denied»-Fehler.

-- Ohne festes search_path trifft eine Funktion je nach Aufrufer andere Objekte.
-- Die Definer-Funktionen setzen es im Kopf; diese beiden Helfer sind
-- `security invoker` und wurden dabei übersehen.
alter function public.slugify(text)
  set search_path = public, pg_temp;
alter function public.season_label(uuid, timestamptz)
  set search_path = public, pg_temp;
