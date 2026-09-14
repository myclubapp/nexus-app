-- ============================================================================
-- 0085_member_self_update_guard: Was ein Mitglied an der eigenen Zeile ändern
-- darf (Befund aus UC-045, BR-214)
--
-- **Der Befund.** Die Policy `members_update_self` aus `0006` lautet seit dem
-- ersten Tag:
--
--     for update using (user_id = auth.uid()) with check (user_id = auth.uid())
--
-- Sie prüft, **wessen** Zeile geändert wird – nicht **was** daran. Über
-- PostgREST genügt damit ein
--
--     PATCH /rest/v1/club_members?id=eq.<eigene id>  {"role":"superadmin"}
--
-- und aus einem Mitglied wird der Vorstand. Der Trigger aus `0012` greift
-- nicht: Er schützt den **letzten** Vorstand vor dem Verschwinden, nicht den
-- Verein vor einem hinzukommenden. Am 2026-09-14 gegen die laufende Datenbank
-- geprüft: An `club_members` hängen genau drei Policies, und keine engt die
-- Spalten ein.
--
-- Das widerspricht der ersten der nicht verhandelbaren Regeln des Projekts –
-- «Rollenprüfung serverseitig» – und BR-027, das ausdrücklich sagt, die
-- Berechtigung liege «in der Policy und im Trigger». Gefunden wurde es beim
-- Bauen von `set_member_avatar()` (UC-045): Diese Funktion prüft sorgfältig
-- die Herkunft der Bildadresse, während derselbe Wert nebenan ungeprüft
-- geschrieben werden konnte.
--
-- **BR-214: An der eigenen Zeile ändert ein Mitglied genau eine Spalte** –
-- `leaderboard_opt_in` (FR-020). Alles andere läuft über eine Funktion, die
-- ihre eigene Prüfung mitbringt: `update_my_profile()` für Name, Kontakt und
-- Datenschutz, `set_health_opt_out()` für die Fürsorge-Hinweise,
-- `set_member_avatar()` für das Bild, `set_contribution_goal()` für das Ziel.
-- Rolle, Bereich und Status gehören dem Vorstand.
--
-- **Die Liste ist eine Erlaubnisliste, keine Verbotsliste.** Verglichen wird
-- die ganze Zeile als `jsonb` ohne die erlaubte Spalte. Eine Spalte, die
-- jemand später hinzufügt, ist damit von selbst geschützt – bei einer
-- Verbotsliste wäre sie still offen.
-- ============================================================================

create or replace function public.guard_member_self_update()
returns trigger
language plpgsql
-- **Ausdrücklich kein `security definer`.** Der Trigger muss sehen, wer
-- gerade schreibt. In einer `security definer`-Funktion ist `current_user`
-- der Eigentümer (`postgres`), bei einem direkten Aufruf über PostgREST
-- `authenticated`. Genau daran hängt die Unterscheidung unten; am
-- 2026-09-14 auf der laufenden Datenbank nachgemessen.
set search_path = public, pg_temp
as $$
begin
  -- Alles, was durch eine `security definer`-Funktion oder den Dienst kommt,
  -- hat seine Prüfung dort – und wird hier nicht ein zweites Mal geprüft.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- Der Vorstand verwaltet die Mitgliedschaften (Policy `members_admin_write`).
  if is_club_admin(old.club_id) then
    return new;
  end if;

  if to_jsonb(new) - 'leaderboard_opt_in' is distinct from to_jsonb(old) - 'leaderboard_opt_in' then
    raise exception
      'An der eigenen Mitgliedschaft lässt sich nur die Teilnahme an Ranglisten ändern. Alles andere läuft über das Profil.';
  end if;

  return new;
end;
$$;

drop trigger if exists club_members_guard_self_update on club_members;
create trigger club_members_guard_self_update
  before update on club_members
  for each row
  execute function public.guard_member_self_update();

-- Rechte: **entziehen, nicht vergeben.** Postgres prüft das `EXECUTE`-Recht
-- auf eine Triggerfunktion beim **Anlegen** des Triggers, nicht beim
-- Auslösen – ein Grant an `authenticated` wäre also nicht nur unnötig,
-- sondern hängte die Funktion zusätzlich als Endpunkt unter `/rest/v1/rpc/`.
-- Dieselbe Zeile steht in `0070` an der Triggerfunktion
-- `functionary_member_left()`.
revoke execute on function public.guard_member_self_update()
  from public, anon, authenticated;
