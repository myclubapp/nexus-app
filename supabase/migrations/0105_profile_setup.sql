-- ============================================================================
-- 0105_profile_setup: Der Profil-Assistent (UC-053, FR-200)
--
-- UC-051 hat den Verein eingerichtet – Verband, Teams, Beispielinhalte,
-- Mitglieder. Für die **Person**, die danach beitritt, gab es nichts
-- Entsprechendes: Sie landet im Dashboard, und Bild, Name und Push liegen
-- hinter drei verschiedenen Blättern, von denen keines sie darauf anspricht.
-- Das Ergebnis steht in jeder Mitgliederliste: Anzeigename gleich
-- E-Mail-Adresse, kein Bild, kein Gerät.
--
-- Diese Migration bringt **eine Spalte**. Der Assistent selbst ist Oberfläche
-- und braucht keine: Bild, Name und Kontakt schreiben `set_member_avatar()`
-- und `update_my_profile()`, die Meldungseinstellungen
-- `set_notification_settings()`, das Gerät meldet sich über `push_tokens` an.
-- Der Server muss nur **eines** wissen, was er heute nicht weiss: ob diese
-- Person den Assistenten schon gesehen hat.
--
-- **Warum nicht im Gerät?** Weil «schon gesehen» sonst je Gerät gälte. Wer
-- sich am Laptop anmeldet, bekäme den Assistenten dort erneut – und wer das
-- Telefon wechselt, verlöre die Antwort. Die Frage gehört zur Mitgliedschaft.
--
-- **Warum an der Mitgliedschaft und nicht am Konto?** Weil das Profil an der
-- Mitgliedschaft hängt: Anzeigename, Bild und Sichtbarkeit gelten je Verein
-- (`club_members`). Wer einem zweiten Verein beitritt, hat dort ein zweites,
-- leeres Profil – und soll gefragt werden.
-- ============================================================================

alter table club_members
  -- Gesetzt heisst: Der Assistent ist erledigt – **durchlaufen oder
  -- übersprungen**. Beides ist eine Antwort (BR-270), und beide sehen für die
  -- App gleich aus: nicht noch einmal ungefragt.
  add column if not exists profile_setup_at timestamptz;

-- Bestand: Wer heute schon ein Bild oder einen eigenen Anzeigenamen hat, hat
-- sein Profil gepflegt – der Assistent hätte ihm nichts zu sagen. Ihn danach
-- zu fragen wäre eine Störung ohne Anlass.
--
-- Der Anzeigename zählt nur, wenn er **nicht** die E-Mail-Adresse ist: `0010`
-- setzt beim Beitritt `display_name` auf den Teil vor dem @, und genau das ist
-- der Zustand, den der Assistent beheben soll.
--
-- **`lower()` auf beiden Seiten**, und das ist keine Kosmetik: Dieselbe Frage
-- beantwortet in der App `isPlaceholderName()` (`src/lib/profileSetup.ts`), und
-- die vergleicht ohne Rücksicht auf Gross- und Kleinschreibung. Ohne `lower()`
-- hier gälte «Sandro» zu `sandro@…` dem Server als gepflegt und der App als
-- Platzhalter: Die Nachmigration trüge den Zeitpunkt ein, und die Karte auf dem
-- Dashboard stünde trotzdem. Laufen die beiden auseinander, widersprechen sich
-- zwei Bildschirme.
--
-- **Mitglieder ohne Konto bleiben unberührt** (der Join auf `auth.users` ist
-- innen): Sie hat noch nie jemand gefragt, und beim ersten Anmelden sollen sie
-- den Assistenten sehen – gerade wegen des Push-Schritts.
update club_members m
   set profile_setup_at = now()
  from auth.users u
 where u.id = m.user_id
   and m.profile_setup_at is null
   and (
     m.avatar_url is not null
     or (m.first_name is not null and m.last_name is not null)
     or (u.email is not null
         and lower(m.display_name) <> lower(split_part(u.email, '@', 1)))
   );

-- ---------------------------------------------------------------------------
-- Die Antwort festhalten.
--
-- Eine Funktion und keine Spalte in der Erlaubnisliste von `0085`: Diese
-- Liste ist mit Bedacht auf **eine** Spalte beschränkt (BR-214), und der
-- Trigger vergleicht die ganze Zeile. Eine zweite Spalte darin wäre die erste
-- Ausnahme; eine Funktion, die ihre Prüfung mitbringt, ist der Weg, den alle
-- anderen Profilfelder schon gehen.
-- ---------------------------------------------------------------------------
create or replace function public.finish_profile_setup(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    raise exception 'Mitglied nicht gefunden';
  end if;

  -- BR-028: Die Entscheide gehören der Person, nicht dem Verein.
  if v_member.user_id is distinct from auth.uid() then
    raise exception 'Nur die Person selbst schliesst ihre Einrichtung ab';
  end if;

  -- Einmal gesetzt, bleibt gesetzt: Ein zweiter Durchlauf über die Profilseite
  -- (FR-200, A3) soll den Zeitpunkt nicht verschieben – er ist der Beleg,
  -- wann gefragt wurde, nicht wann zuletzt etwas geändert wurde.
  update club_members
     set profile_setup_at = coalesce(profile_setup_at, now())
   where id = p_member_id;
end;
$$;

revoke execute on function public.finish_profile_setup(uuid) from public, anon;
grant  execute on function public.finish_profile_setup(uuid) to authenticated;
