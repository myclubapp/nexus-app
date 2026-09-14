-- ============================================================================
-- 0082_member_export: Mitgliederliste herausgeben (UC-043, FR-130)
--
-- Die bestehende myclub-App exportiert Mitglieder an zwei Stellen: als Verein
-- (`club-member-list`) und je Team (`team-member-list`). Beide Wege lesen dort
-- dieselbe Firestore-Sammlung und bauen die Datei im Client zusammen – die
-- Abgrenzung war eine Frage der Ansicht, nicht des Servers.
--
-- Hier nicht. Ein Export ist die Stelle, an der Personendaten den Verein
-- verlassen; die Reichweite gehört deshalb an den Server, nicht an ein Blatt,
-- das man auch ohne Rolle öffnen kann.
--
-- **BR-205: Der Export trägt die Reichweite seiner Aufrufer:in.** Den ganzen
-- Verein (`p_team_id is null`) exportiert nur der Vorstand. Ein Team
-- exportiert, wer für dieses Team planen darf – `can_plan_for_team()` aus
-- `0073`, dieselbe Funktion, die auch entscheidet, wer für ein Team einen
-- Termin anlegt (C-032).
--
-- **BR-206: Was die Trainer:in exportiert, ist die Kaderliste, nicht die
-- Kartei.** `0063` hat das für den Notfallkontakt entschieden und begründet:
-- «Die Adresse bleibt beim Vorstand (Rechnungen, Post) und bei der Person.»
-- Diese Funktion schreibt dieselbe Linie fort – ohne Adresse, ohne
-- Geburtsdatum, und mit E-Mail und Telefon nur dort, wo die Person sie
-- freigegeben hat (FR-019). Vollständig exportiert nur, wer die Kontaktzeile
-- ohnehin lesen darf – `is_club_admin()`, dieselbe Prüfung wie in der Policy
-- `member_contacts_own` (0013). Die Sportchef:in gehört ausdrücklich nicht
-- dazu: Sie darf für ihren Bereich **planen**, nicht die Kartei lesen.
--
-- **BR-209: Der Export ist eine Momentaufnahme, kein Abonnement.** Die Zeilen
-- entstehen im Aufruf. Keine Datei auf dem Server, keine Kopie im Verein, und
-- kein Protokoll darüber, wer wen exportiert hat – ein solches Protokoll wäre
-- genau die Überwachungsfläche, die §11.4a der Vision ausschliesst.
-- ============================================================================

create or replace function public.export_members(
  p_club_id uuid,
  p_team_id uuid default null
)
returns table (
  member_id    uuid,
  first_name   text,
  last_name    text,
  display_name text,
  email        text,
  phone        text,
  birth_date   date,
  street       text,
  house_number text,
  postal_code  text,
  city         text,
  country      text,
  role         text,
  status       text,
  member_since date,
  teams        text,
  offices      text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  -- Vollständig oder als Kaderliste (BR-206).
  --
  -- `is_club_admin`, **nicht** `is_club_board`: Die Sportchef:in führt einen
  -- Bereich und darf für ihn planen (BR-205), aber `member_contacts_own`
  -- (0013) und `emergency_contact()` (0063) geben ihr die Kontaktzeile
  -- ausdrücklich nicht. Stünde hier `is_club_board`, bekäme sie über den
  -- Export genau die Adressen, die sie im Mitglied-Detail nicht sieht – und
  -- die Regel stünde zweimal verschieden im Repository.
  --
  -- Reichweite (wen) und Umfang (was) sind damit zwei Prüfungen: unten
  -- `can_plan_for_team()`, hier `is_club_admin()`.
  v_full boolean := is_club_admin(p_club_id);
begin
  -- BR-205. Ein `p_team_id`, das einem anderen Verein gehört, ist kein
  -- Zugriffsfehler, sondern eine leere Liste – wie überall sonst auch.
  if not can_plan_for_team(p_club_id, p_team_id) then
    return;
  end if;
  if p_team_id is not null and not exists (
       select 1 from teams where id = p_team_id and club_id = p_club_id) then
    return;
  end if;

  return query
    select
      m.id,
      m.first_name,
      m.last_name,
      m.display_name,
      -- FR-019: Der Vorstand sieht die Adresse immer, die Trainer:in nur,
      -- wenn die Person sie für den Verein freigegeben hat.
      case when v_full or coalesce((m.privacy->>'email')::boolean, false)
           then c.email end,
      case when v_full or coalesce((m.privacy->>'phone')::boolean, false)
           then c.phone end,
      case when v_full then c.birth_date end,
      case when v_full then c.street end,
      case when v_full then c.house_number end,
      case when v_full then c.postal_code end,
      case when v_full then c.city end,
      case when v_full then c.country end,
      m.role,
      m.status,
      m.member_since,
      (
        select string_agg(t.name, ', ' order by t.name)
          from team_members tm join teams t on t.id = tm.team_id
         where tm.member_id = m.id
           -- Der Verein steht dabei, obwohl ein Mitglied heute nur in Teams
           -- seines Vereins stehen kann: Die Spalte soll auch dann stimmen,
           -- wenn jemand diese Zusicherung später lockert.
           and t.club_id = p_club_id
      ),
      -- Ämter aus `functionary_holders` (0070), nicht aus dem Spiegel
      -- `holder_member_id`: Wer zwei Sitze hält, hält zwei Ämter.
      (
        select string_agg(t.title, ', ' order by t.title)
          from (
            select distinct r.title
              from functionary_holders h join functionary_roles r on r.id = h.role_id
             where h.member_id = m.id and r.club_id = p_club_id
          ) t
      )
      from club_members m
      left join member_contacts c on c.member_id = m.id
     where m.club_id = p_club_id
       and (
         p_team_id is null
         or exists (select 1 from team_members tm
                     where tm.member_id = m.id and tm.team_id = p_team_id)
       )
     order by coalesce(nullif(trim(m.last_name), ''), m.display_name), m.display_name;
end;
$$;

-- Eine `security definer`-Funktion ist sofort ein offener Endpunkt: Postgres
-- vergibt `execute` an PUBLIC, Supabase zusätzlich an `anon`. `revoke … from
-- anon` allein wirkt nicht – der Grant an PUBLIC bliebe stehen (0007).
revoke execute on function public.export_members(uuid, uuid) from public, anon;
grant  execute on function public.export_members(uuid, uuid) to authenticated;
