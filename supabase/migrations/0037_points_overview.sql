-- ============================================================================
-- 0037_points_overview: Punktestand und «Nächste Punkte» (UC-020)
--
-- Drei Dinge, die das Dashboard verspricht und nicht hält – und einer, der
-- eine Regel aushöhlt:
--
--   BR-081  Saison **und** Gesamt. Bisher gab es nur die Saison.
--   Schritt 4 «Nächste Punkte» zeigte die bestbezahlten **Regeln** des
--           Vereins. Eine Regel «Training besucht: +10» sagt niemandem,
--           welches Training gemeint ist und ob es überhaupt eines gibt.
--   BR-084  Der Rangvergleich ist «abwählbar» – aber `point_tx_read` liess
--           jedes Vereinsmitglied jede fremde Buchung lesen, samt Notiztext.
--           Nachgemessen: Mitglied A sah die Buchungen von B, obwohl B die
--           Rangliste abgewählt hatte. Die Abwahl war eine Anzeigeeinstellung
--           und kein Schutz.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Der Ledger gehört der Person, über die er geführt wird.
--
-- Der Vorstand sieht ihn weiterhin: Er bucht von Hand (UC-021) und korrigiert
-- Fehlbuchungen – ohne Einsicht ginge beides nicht.
-- ---------------------------------------------------------------------------
drop policy if exists point_tx_read on point_transactions;
create policy point_tx_read on point_transactions
  for select using (
    member_id = current_member_id(club_id)
    or is_club_admin(club_id)
  );

-- ---------------------------------------------------------------------------
-- Die Rangliste hängt am Ledger: Sie war eine `security_invoker`-Sicht und
-- verschwände mit der engeren Policy für jedes Mitglied.
--
-- Sie läuft deshalb künftig mit den Rechten ihres Eigentümers und prüft die
-- Vereinszugehörigkeit selbst – dieselbe Bauart wie `club_directory` in 0013.
-- Was sie zeigt, ist ohnehin nur, was die Person freigegeben hat: Summen von
-- Mitgliedern mit `leaderboard_opt_in`, keine einzelnen Buchungen.
-- ---------------------------------------------------------------------------
create or replace view public.leaderboard
with (security_invoker = false)
as
select
  m.club_id,
  tm.team_id,
  m.id as member_id,
  m.display_name,
  m.avatar_url,
  t.season,
  t.total_points,
  rank() over (
    partition by m.club_id, tm.team_id, t.season
    order by t.total_points desc
  )::int as rank
from club_members m
join (
  select member_id, season, sum(points)::int as total_points
  from point_transactions
  group by member_id, season
) t on t.member_id = m.id
left join team_members tm on tm.member_id = m.id
where m.leaderboard_opt_in
  and m.status <> 'left'
  -- Der Wächter, den die Policy des Ledgers bisher beisteuerte.
  and is_club_member(m.club_id);

-- ---------------------------------------------------------------------------
-- 2. BR-081: Saison und Gesamt.
--
-- Beide Zahlen aus **einer** Abfrage, damit sie nie aus zwei Zeitpunkten
-- stammen. Die Saison folgt `season_label()` – derselben Funktion, die jede
-- Buchung einordnet (BR-082).
-- ---------------------------------------------------------------------------
create or replace function public.my_points_summary(p_club_id uuid)
returns table (
  season         text,
  season_points  int,
  career_points  int,
  booking_count  int,
  first_booking  timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    season_label(p_club_id),
    coalesce(sum(points) filter (where t.season = season_label(p_club_id)), 0)::int,
    coalesce(sum(points), 0)::int,
    count(*)::int,
    min(t.created_at)
  from point_transactions t
  where t.club_id = p_club_id
    and t.member_id = current_member_id(p_club_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. Schritt 4: «Nächste Punkte» als konkrete Beiträge.
--
-- BR-083: Die Vorschläge berücksichtigen die Team-Zugehörigkeit und lassen
-- weg, was die Person bereits übernommen hat. Das Beitrags-Profil kommt mit
-- UC-033 dazu: Das Beitrags-Profil schränkt dann `tasks_open` ein, und zwar
-- hier und nicht im Client.
--
-- Drei Quellen, eine Liste, nach Zeit sortiert: Ein Vorschlag ohne Datum wäre
-- kein Vorschlag, sondern ein Katalog.
-- ---------------------------------------------------------------------------
create or replace function public.next_contributions(
  p_club_id uuid,
  p_limit   int default 5
)
returns table (
  kind    text,
  ref_id  uuid,
  title   text,
  detail  text,
  points  int,
  when_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  return query
  -- a) Der nächste Termin, auf den ich noch nicht geantwortet habe.
  with events_open as (
    select
      'event'::text as kind,
      e.id as ref_id,
      e.title,
      e.type as detail,
      (select r.points from point_rules r
        where r.club_id = e.club_id and r.code = e.point_rule_code and r.is_active) as points,
      e.starts_at as when_at
    from events e
    left join team_members tm
      on tm.team_id = e.team_id and tm.member_id = v_member
    where e.club_id = p_club_id
      and e.published_at is not null
      and e.cancelled_at is null
      and not e.is_sample
      and e.starts_at > now()
      -- Ein Helfer-Event ist kein Vorschlag: Der Beitrag ist die Schicht, und
      -- die steht unten. Beides zu nennen hiesse, denselben Anlass zweimal
      -- vorzuschlagen – einmal sogar ohne Punktwert.
      and e.type <> 'helper'
      and (e.team_id is null or tm.member_id is not null)
      and not exists (
        select 1 from attendance a
         where a.event_id = e.id and a.member_id = v_member and a.shift_id is null
      )
  ),
  -- b) Schichten mit Unterdeckung, in die ich nicht eingetragen bin.
  shifts_open as (
    select
      'shift'::text as kind,
      -- Nicht die Schicht, sondern ihr **Termin**: Der Vorschlag führt in die
      -- Agenda, und die hebt Termine hervor, nicht Schichten. Mit der
      -- Schicht-Id landete der Tipp auf einer Seite ohne Treffer.
      e.id as ref_id,
      s.title,
      e.title as detail,
      s.points,
      s.starts_at as when_at
    from event_shifts s
    join events e on e.id = s.event_id
    where e.club_id = p_club_id
      and e.published_at is not null
      and e.cancelled_at is null
      and not e.is_sample
      and s.starts_at > now()
      and s.needed > (
        select count(*) from attendance a
         where a.shift_id = s.id and a.status in ('registered','present')
      )
      and not exists (
        select 1 from attendance a
         where a.shift_id = s.id and a.member_id = v_member
      )
  ),
  -- c) Offene Aufgaben in meinem Geltungsbereich, die ich nicht halte.
  tasks_open as (
    select
      'task'::text as kind,
      t.id as ref_id,
      t.title,
      t.category as detail,
      t.points,
      t.due_at as when_at
    from tasks t
    where t.club_id = p_club_id
      and t.status = 'open'
      and not t.is_sample
      and task_in_scope(t.id)
      and t.max_assignees > (select count(*) from task_assignments a where a.task_id = t.id)
      and not exists (
        select 1 from task_assignments a
         where a.task_id = t.id and a.member_id = v_member
      )
  )
  select * from (
    select * from events_open
    union all select * from shifts_open
    union all select * from tasks_open
  ) all_open
  -- Ohne Datum steht ein Vorschlag hinten, nicht vorn: Was einen Termin hat,
  -- drängt.
  order by when_at nulls last
  limit greatest(coalesce(p_limit, 5), 1);
end;
$$;

revoke execute on function public.my_points_summary(uuid) from public, anon;
grant  execute on function public.my_points_summary(uuid) to authenticated;

revoke execute on function public.next_contributions(uuid, int) from public, anon;
grant  execute on function public.next_contributions(uuid, int) to authenticated;
