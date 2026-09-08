-- ============================================================================
-- 0011_account_deletion: Konto löschen (UC-006)
--
-- Auflage beider App-Stores und von C-023: Die Löschung muss aus der App
-- heraus erreichbar sein, ohne Umweg über Support oder Website.
--
-- Der Kern ist BR-021: Punktebuchungen bleiben als anonyme Vereinsdaten
-- bestehen, damit Ranglisten und Auswertungen einer Saison nicht rückwirkend
-- kippen – sie tragen danach aber keinen Bezug zu einer natürlichen Person
-- mehr. `club_members` bleibt deshalb als anonymisierte Hülle stehen, an der
-- die Buchungen hängen, und verliert alles Personenbezogene.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Wäre der Verein danach ohne Vorstand (A1, BR-023)?
--
-- Eigene Funktion, weil das UI die Frage vor der Bestätigung stellen muss und
-- die Löschfunktion sie noch einmal stellt. Zwei Stellen, eine Antwort.
-- ---------------------------------------------------------------------------
create or replace function public.clubs_left_without_admin(p_user_id uuid)
returns table (club_id uuid, club_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.name
  from club_members m
  join clubs c on c.id = m.club_id
  where m.user_id = p_user_id
    and m.role in ('admin','superadmin')
    and m.status <> 'left'
    and not exists (
      select 1 from club_members other
      where other.club_id = m.club_id
        and other.user_id is distinct from p_user_id
        and other.role in ('admin','superadmin')
        and other.status <> 'left'
    );
$$;

/**
 * Prüfung für die aufrufende Person selbst – das ist die Fassung, die das UI
 * aufruft. Sie nimmt keinen Parameter entgegen, damit niemand die
 * Vorstandslage eines fremden Kontos abfragen kann.
 */
create or replace function public.my_clubs_left_without_admin()
returns table (club_id uuid, club_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select * from clubs_left_without_admin(auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Konto löschen.
--
-- Läuft in einer Transaktion: Bricht ein Schritt ab, bleibt das Konto
-- vollständig bestehen (Failure Postcondition), statt halb gelöscht.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_blocker record;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- A1: Ein Verein darf nicht ohne Vorstand zurückbleiben (BR-023).
  select * into v_blocker from clubs_left_without_admin(v_user) limit 1;
  if found then
    raise exception
      'Du bist im Verein % die einzige Person mit Vorstandsrechten. Bestimme zuerst jemand anderen.',
      v_blocker.club_name;
  end if;

  -- Schritt 4: alles Personenbezogene aus den Mitgliedschaften entfernen.
  -- Die Zeile bleibt als anonyme Hülle stehen, weil die Punktebuchungen
  -- daran hängen (BR-021).
  update club_members
     set display_name       = 'Ehemaliges Mitglied',
         avatar_url         = null,
         user_id            = null,
         status             = 'left',
         leaderboard_opt_in = false
   where user_id = v_user;

  -- Schritt 4: Zustellungen und Geräte. BR-022 verlangt die vollständige
  -- Löschung privater Inhalte, nicht ihre Anonymisierung.
  delete from notifications where user_id = v_user;
  delete from push_tokens   where user_id = v_user;

  -- Anfragen, über die noch nicht entschieden wurde, verschwinden mit dem
  -- Konto; entschiedene tragen ohnehin keinen Wert mehr.
  delete from join_requests where user_id = v_user;

  -- Schritt 6: das Anmeldekonto selbst. Die Funktion gehört `postgres` und
  -- darf deshalb in `auth.users` schreiben; der Client könnte das nie.
  delete from auth.users where id = v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013).
-- ---------------------------------------------------------------------------
-- Die Fassung mit Parameter könnte die Vorstandslage fremder Konten
-- ausleuchten und bleibt deshalb intern.
revoke execute on function public.clubs_left_without_admin(uuid)
  from public, anon, authenticated;
grant execute on function public.clubs_left_without_admin(uuid) to service_role;

revoke execute on function public.my_clubs_left_without_admin() from public, anon;
revoke execute on function public.delete_my_account()           from public, anon;

grant execute on function public.my_clubs_left_without_admin() to authenticated;
grant execute on function public.delete_my_account()           to authenticated;
