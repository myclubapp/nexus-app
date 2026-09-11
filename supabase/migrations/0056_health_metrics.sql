-- ============================================================================
-- 0056_health_metrics: die Kennzahlen der Vereins-Gesundheit (UC-023)
--
-- `0040` hat die **Triage** gebaut: Signale entstehen, werden zugestellt, mit
-- einem Tap übernommen und verfallen, ohne eine Akte zu hinterlassen. Was
-- fehlte, ist die andere Hälfte desselben Bildschirms – die Zahlen, auf die
-- sich ein Signal bezieht (FR-060, FR-061, FR-068, FR-069).
--
-- **Eine Kennzahl ist gefährlicher als ein Hinweis.** Ein Hinweis benennt
-- einen Anlass; eine Zahl heftet eine Bewertung an eine Gruppe oder an eine
-- Person. Diese Migration hält deshalb vier Grenzen ein:
--
--   BR-094  Gerechnet wird aus Teilnahmen, Antworten, Punktebuchungen und
--           Ämtern. Nichts sonst.
--   BR-095  Keine Rangliste der Wenig-Aktiven, keine Note für ein Team, kein
--           Wort wie «inaktiv» – die Funktionen geben Zahlen zurück, die
--           Formulierung steht in den Übersetzungen.
--   BR-096  Vereinszahlen sieht der Vorstand, Teamzahlen sieht, wer das Team
--           führt. Geprüft wird hier, nicht in der Abfrage.
--   BR-097  **Nichts davon wird gespeichert.** Jede Zahl entsteht beim Lesen;
--           es gibt keine Tabelle mit Monatswerten und damit keine Historie.
--
-- Und eine fünfte Grenze, die nirgends steht und trotzdem die wichtigste ist:
-- **Keine dieser Funktionen gibt Namen zurück.** Die Versuchung bei FR-068
-- wäre eine Liste derer, die alles tragen. Sie wäre eine Liste derer, die
-- nichts tragen, gleich mit – und ein Verein, der die führt, braucht kein
-- Frühwarnsystem mehr, sondern eine Aussprache.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- FR-075: Der Definitionskatalog wird lesbar.
--
-- Die Schwellen stehen seit `0040` in `clubs.settings.health.thresholds` und
-- waren von der App aus nicht zu sehen. Eine Kennzahl, deren Definition
-- niemand kennt, ist keine Kennzahl, sondern eine Behauptung.
-- ---------------------------------------------------------------------------
create or replace function public.health_definitions(p_club_id uuid)
returns table (key text, value numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen die Definitionen';
  end if;

  return query
  select d.key, health_threshold(p_club_id, d.key, d.fallback)
    from (values
      ('activeDays',       60::numeric),
      ('silentDays',       60),
      ('noResponseEvents',  3),
      ('attendanceDropFrom', 0.7),
      ('attendanceDropTo',   0.5),
      ('longTenureYears',    3),
      ('minGroup',           5)
    ) as d(key, fallback);
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-060: die Vereins-Übersicht.
--
-- Vier Zahlen und ihr Vorjahreswert. «Aktivierung» ist die Frage, wer
-- überhaupt angekommen ist – mindestens eine Punktebuchung in der Saison –,
-- nicht, wer fleissig war. Der Unterschied ist der zwischen einer Kennzahl und
-- einem Zeugnis.
--
-- Der Trend entsteht aus derselben Rechnung für die **Vorsaison**. Das ist
-- möglich, ohne gegen BR-097 zu verstossen: Der Punkte-Ledger trägt seine
-- Saison selbst, es wird nichts zusätzlich aufbewahrt.
-- ---------------------------------------------------------------------------
-- `drop` vor `create`: Postgres lässt die Rückgabespalten einer bestehenden
-- Funktion nicht ändern, und diese hier hat im Lauf der Durchsicht eine Spalte
-- verloren. Auf einer frischen Datenbank tut die Zeile nichts.
drop function if exists public.club_health(uuid);

create or replace function public.club_health(p_club_id uuid)
returns table (
  members              int,
  activated            int,
  prev_activated       int,
  active               int,
  active_days          int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season      text;
  v_prev_season text;
  v_days        int;
begin
  -- BR-096: Die Vereinszahlen gehören dem Vorstand. Abgewiesen statt mit
  -- Nullen beantwortet – «0 von 0 aktiv» läse sich wie ein toter Verein.
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Vereins-Übersicht';
  end if;

  v_season      := season_label(p_club_id);
  v_prev_season := season_label(p_club_id, now() - interval '1 year');
  v_days        := health_threshold(p_club_id, 'activeDays', 60)::int;

  return query
  select
    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'),

    (select count(distinct t.member_id)::int from point_transactions t
      join club_members m on m.id = t.member_id and m.status = 'active'
     where t.club_id = p_club_id and t.season = v_season),

    -- Der Trend vergleicht **Anzahlen**, keine Quoten: Wie gross der Verein in
    -- der Vorsaison war, weiss diese Datenbank nicht – BR-097 verbietet die
    -- Historie, die es dafür bräuchte. Ausgetretene zählen deshalb mit, denn
    -- sie waren damals da.
    (select count(distinct t.member_id)::int from point_transactions t
      where t.club_id = p_club_id and t.season = v_prev_season),

    -- «Aktiv» ist, wer im Fenster eine Spur hinterlassen hat: eine Buchung
    -- oder eine Antwort auf einen Termin. Eine Absage zählt dazu – wer
    -- absagt, ist da (BR-095).
    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'
        and (
          exists (select 1 from point_transactions t
                   where t.member_id = m.id
                     and t.created_at > now() - make_interval(days => v_days))
          or exists (select 1 from attendance a
                      join events e on e.id = a.event_id
                     where a.member_id = m.id
                       and e.starts_at > now() - make_interval(days => v_days))
        )),

    v_days;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-061: die Teamzahlen.
--
-- Zwei Quoten über die vergangenen neunzig Tage: Wie viele der Eingeladenen
-- **antworten**, und wie viele **kommen**. Getrennt, weil sie verschiedene
-- Dinge sagen – ein Team, das zusagt und nicht erscheint, hat ein anderes
-- Problem als eines, das schweigt.
--
-- **Unter der Mindestgrösse entsteht keine Zeile.** In einem Team mit vier
-- Personen ist eine Antwortquote von 75 Prozent kein Aggregat, sondern die
-- Aussage über eine bestimmte Person. Dieselbe Schwelle wie bei `team_mood()`
-- in UC-032, und wie dort **keine Zeile** statt einer Null: Eine Null läse
-- sich wie ein Ergebnis.
-- ---------------------------------------------------------------------------
create or replace function public.team_health(p_club_id uuid)
returns table (
  team_id      uuid,
  team_name    text,
  members      int,
  invitations  int,
  answered     int,
  attended     int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_min    int;
  v_member uuid;
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen Teamzahlen';
  end if;

  v_min    := health_threshold(p_club_id, 'minGroup', 5)::int;
  v_member := current_member_id(p_club_id);

  return query
  with in_reach as (
    -- BR-096: Der Vorstand sieht den Verein, Trainer:innen ihre Teams.
    select t.id, t.name
      from teams t
     where t.club_id = p_club_id
       and (is_club_admin(p_club_id)
            or exists (select 1 from team_members tm
                        where tm.team_id = t.id and tm.member_id = v_member))
  ),
  sized as (
    select r.id, r.name,
           (select count(*)::int from team_members tm where tm.team_id = r.id) as size
      from in_reach r
  ),
  past as (
    select s.id as team_id, e.id as event_id
      from sized s
      join events e on e.team_id = s.id
     where e.published_at is not null
       and e.cancelled_at is null
       and not e.is_sample
       and e.starts_at between now() - interval '90 days' and now()
  )
  select
    s.id, s.name, s.size,
    (s.size * (select count(*)::int from past p where p.team_id = s.id)),
    (select count(*)::int from past p
       join attendance a on a.event_id = p.event_id and a.shift_id is null
      where p.team_id = s.id),
    (select count(*)::int from past p
       join attendance a on a.event_id = p.event_id and a.shift_id is null
      where p.team_id = s.id and a.status = 'present')
    from sized s
   where s.size >= v_min
   order by s.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-068: die Verantwortungsverteilung (K4).
--
-- Wie viele Menschen tragen vier Fünftel dessen, was im Verein an Einsätzen
-- geleistet wird? Gezählt werden **Einsätze**, nicht Punkte: Helfereinsätze
-- (Säule 3) und Aufgaben (Säule 7). Ein pünktlich bezahlter Beitrag ist kein
-- Einsatz, und ein besuchtes Training ist Teilnahme, nicht Verantwortung.
--
-- Zurück kommt eine **Zahl**, nie eine Liste. Wer trägt, weiss der Vorstand
-- ohnehin; wer nicht trägt, geht ihn hier nichts an.
-- ---------------------------------------------------------------------------
create or replace function public.responsibility_concentration(p_club_id uuid)
returns table (
  contributors int,
  carriers     int,
  members      int,
  efforts      int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season text;
  v_total  int;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Verantwortungsverteilung';
  end if;

  v_season := season_label(p_club_id);

  return query
  with effort as (
    select t.member_id, count(*)::int as n
      from point_transactions t
      join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
     where t.club_id = p_club_id
       and t.season = v_season
       and r.pillar in (3, 7)
     group by t.member_id
  ),
  ranked as (
    select n,
           sum(n) over (order by n desc, member_id) as running,
           sum(n) over () as total,
           row_number() over (order by n desc, member_id) as rank
      from effort
  )
  select
    (select count(*)::int from effort),
    -- Alle bis zu der Person, mit der die Summe vier Fünftel erreicht.
    coalesce((select min(rank)::int from ranked
               where running::numeric >= total * 0.8), 0),
    (select count(*)::int from club_members m
      where m.club_id = p_club_id and m.status = 'active'),
    coalesce((select sum(n)::int from effort), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-069: der Nachfolge-Vorlauf (K4).
--
-- Zwei Fälle brauchen Vorlauf: ein **vakantes** Amt und eines, das dieselbe
-- Person seit langem hält. Der zweite ist der wichtigere – ein Amt, das seit
-- neun Jahren dieselbe Person trägt, ist kein Zeichen von Stabilität, sondern
-- eine offene Frage, die niemand gestellt hat.
--
-- Zurückgegeben wird das **Amt**, nicht die Person: Wer es hält, steht in der
-- Ämterliste, wo es hingehört.
-- ---------------------------------------------------------------------------
drop function if exists public.succession_lead(uuid);

create or replace function public.succession_lead(p_club_id uuid)
returns table (
  role_id    uuid,
  title      text,
  is_vacant  boolean,
  years      numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_years numeric;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand sieht den Nachfolge-Vorlauf';
  end if;

  v_years := health_threshold(p_club_id, 'longTenureYears', 3);

  return query
  select r.id, r.title,
         r.holder_member_id is null,
         case when r.held_since is null then null
              else round(extract(epoch from age(current_date, r.held_since))
                         / (365.25 * 86400), 1) end
    from functionary_roles r
   where r.club_id = p_club_id
     and (r.holder_member_id is null
          or (r.held_since is not null
              and r.held_since <= current_date - (v_years * 365.25)::int))
   order by r.holder_member_id is null desc, r.held_since nulls last;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-062/FR-067: `succession_gap` bekommt seine Quelle.
--
-- Der Typ steht seit `0040` im Constraint und hatte keine Datengrundlage – die
-- Ämter gab es damals noch nicht. Jetzt gibt es sie.
--
-- Als eigene Routine und nicht als weiterer Block in `detect_health_signals()`:
-- Dieser Anlass hat einen anderen Takt als der tägliche Teilnahme-Lauf. Ein
-- Amt wird nicht über Nacht vakant, und ein wöchentlicher Blick genügt.
--
-- Die Schwere ist `info` – BR-098. Eine fehlende Nachfolge ist eine Frage an
-- den Vorstand, keine Massnahme gegen jemanden.
-- ---------------------------------------------------------------------------
create or replace function public.detect_succession_gaps(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  record;
  v_years numeric;
  v_open  int;
  v_count int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    -- Die Ämter gehören zum Modul «Sitzungen» (UC-034). Ohne es gibt es keine
    -- Ämter und damit nichts zu melden.
    if not module_enabled(v_club.id, 'meeting') then
      continue;
    end if;

    v_years := health_threshold(v_club.id, 'longTenureYears', 3);

    select count(*) into v_open
      from functionary_roles r
     where r.club_id = v_club.id
       and (r.holder_member_id is null
            or (r.held_since is not null
                and r.held_since <= current_date - (v_years * 365.25)::int));

    if v_open = 0 then
      continue;
    end if;

    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'succession_gap', 'info', v_open::text)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_signal_owners(
        (select id from health_signals
          where club_id = v_club.id and signal_type = 'succession_gap'));
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
--
-- Die Kennzahlen prüfen ihre Reichweite selbst und dürfen deshalb von
-- Angemeldeten aufgerufen werden. Der Detektor nicht: Er schreibt.
-- ---------------------------------------------------------------------------
revoke execute on function public.health_definitions(uuid) from public, anon;
grant  execute on function public.health_definitions(uuid) to authenticated;

revoke execute on function public.club_health(uuid) from public, anon;
grant  execute on function public.club_health(uuid) to authenticated;

revoke execute on function public.team_health(uuid) from public, anon;
grant  execute on function public.team_health(uuid) to authenticated;

revoke execute on function public.responsibility_concentration(uuid) from public, anon;
grant  execute on function public.responsibility_concentration(uuid) to authenticated;

revoke execute on function public.succession_lead(uuid) from public, anon;
grant  execute on function public.succession_lead(uuid) to authenticated;

revoke execute on function public.detect_succession_gaps(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auftrag: einmal pro Woche, montags früh.
-- ---------------------------------------------------------------------------
select cron.unschedule('succession-gaps')
 where exists (select 1 from cron.job where jobname = 'succession-gaps');
select cron.schedule('succession-gaps', '35 5 * * 1',
  $cron$select public.detect_succession_gaps();$cron$);
