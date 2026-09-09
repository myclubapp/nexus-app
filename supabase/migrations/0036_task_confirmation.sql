-- ============================================================================
-- 0036_task_confirmation: Aufgabe bestätigen und Kudos geben (UC-019)
--
-- `confirm_task()` besteht seit 0004 und trägt drei Fehler, die der
-- Spezifikation widersprechen:
--
--   BR-065  Sie bucht direkt in den Ledger, **ohne die Punkteregel zu lesen**.
--           Ein Verein kann Säule 7 abschalten oder eine Häufigkeitsgrenze
--           setzen – bestätigte Aufgaben buchen weiter. Dieselbe Lücke hatte
--           `confirm_shift()` bis 0028; sie ist seit UC-013 vorgemerkt.
--   BR-080  Sie lässt die übernehmende Person sich selbst bestätigen.
--   A2      Sie setzt die Aufgabe auf erledigt, sobald **eine** von mehreren
--           Übernahmen bestätigt ist – die übrigen verlieren damit ihre
--           Aufgabe unter den Händen.
--
-- Dazu BR-078, die Regel, um die es in diesem Use Case eigentlich geht: In
-- jeder Rückmeldung steht die Anerkennung vor der Zahl. Bisher trug die
-- Nachricht überhaupt keinen Dank – die Spalte `kudos` wurde geschrieben und
-- nie gelesen.
-- ============================================================================

-- Der Rückgabetyp wechselt von `int` auf eine Tabelle; `create or replace`
-- kann das nicht.
drop function if exists public.confirm_task(uuid, text);

create or replace function public.confirm_task(
  p_assignment_id uuid,
  p_kudos         text default null
)
returns table (points int, booked boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment task_assignments;
  v_task       tasks;
  v_rule       point_rules;
  v_confirmer  uuid;
  v_open       int;
  v_taken      int;
  v_user       uuid;
  v_kudos      text;
  v_points     int := 0;
begin
  select * into v_assignment
    from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Zuweisung nicht gefunden';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;

  -- Die Voraussetzung nennt trainer **oder** admin.
  if not is_club_trainer(v_task.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand bestätigen Aufgaben';
  end if;

  v_confirmer := current_member_id(v_task.club_id);

  -- BR-080: Wer eine Aufgabe selbst übernommen hat, bestätigt sie nicht selbst.
  -- Das Entitätsmodell verlangt dasselbe: `confirmed_by` ist nie identisch mit
  -- `member_id`.
  if v_confirmer = v_assignment.member_id then
    raise exception 'Die eigene Übernahme bestätigt jemand anderes';
  end if;

  -- A4: Zweimal bestätigen ändert nichts und dankt nicht ein zweites Mal.
  if v_assignment.confirmed_at is not null then
    return query select 0, false;
    return;
  end if;

  v_kudos := nullif(trim(p_kudos), '');

  update task_assignments
     set confirmed_at = now(),
         confirmed_by = v_confirmer,
         kudos = coalesce(v_kudos, kudos)
   where id = p_assignment_id;

  -- A2 aus UC-018: Erledigt ist die Aufgabe erst, wenn sie voll ist **und**
  -- alle Übernahmen bestätigt sind. Sonst verlöre die zweite Person ihre
  -- Aufgabe, weil die erste bestätigt wurde.
  select count(*) into v_taken from task_assignments where task_id = v_task.id;
  select count(*) into v_open
    from task_assignments
   where task_id = v_task.id and confirmed_at is null;

  if v_taken >= v_task.max_assignees and v_open = 0 then
    update tasks set status = 'done' where id = v_task.id;
  end if;

  select user_id into v_user from club_members where id = v_assignment.member_id;

  -- BR-065: Gibt es die Regel, und ist sie aktiv? Ohne sie vergibt der Verein
  -- für Aufgaben keine Punkte – dieselbe Antwort, die `award_points()` gibt.
  -- Die Aufgabe gilt trotzdem als erledigt: Die Anerkennung hängt nicht an der
  -- Zahl (V7, A3).
  select * into v_rule
    from point_rules
   where club_id = v_task.club_id and code = 'task_done' and is_active;

  if found and not rule_limit_reached(v_assignment.member_id, v_rule)
     and v_task.points > 0 and not v_task.is_sample then
    -- BR-077: der Punktwert **der Aufgabe**; die Regel liefert die Säule.
    -- BR-079: `source_id` ist die Aufgabe – der Dedupe-Index verwirft eine
    -- zweite Buchung still.
    insert into point_transactions
      (club_id, member_id, rule_code, points, season, source_type, source_id, note)
    values
      (v_task.club_id, v_assignment.member_id, 'task_done', v_task.points,
       season_label(v_task.club_id), 'task', v_task.id, v_task.title)
    on conflict do nothing;

    if found then
      v_points := v_task.points;
    end if;
  end if;

  -- Schritt 7 und BR-078: Der Dank ist die Nachricht, die Zahl steht
  -- nachgeordnet im Text. Ohne Dank trägt die Nachricht wenigstens den
  -- Aufgabentitel – aber nie eine Null als Aussage über den Beitrag.
  if v_user is not null and not v_task.is_sample then
    perform notify(
      v_user,
      'points',
      coalesce(v_kudos, 'Danke für deinen Einsatz'),
      v_task.title
        || case when v_points > 0
                then ' – ' || v_points || ' Punkte gutgeschrieben'
                else '' end,
      '/tabs/profile',
      v_task.club_id
    );
  end if;

  return query select v_points, true;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: «Zurück an die Person».
--
-- Der Hinweis ist Pflicht: Eine Aufgabe zurückzugeben, ohne zu sagen, was
-- fehlt, ist kein wertschätzender Ton, sondern eine Sackgasse.
-- ---------------------------------------------------------------------------
create or replace function public.reject_task(
  p_assignment_id uuid,
  p_note          text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_assignment task_assignments;
  v_task       tasks;
  v_user       uuid;
begin
  select * into v_assignment
    from task_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Zuweisung nicht gefunden';
  end if;

  select * into v_task from tasks where id = v_assignment.task_id;

  if not is_club_trainer(v_task.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand entscheiden über Aufgaben';
  end if;

  if v_assignment.confirmed_at is not null then
    raise exception 'Diese Aufgabe ist bereits bestätigt';
  end if;

  if coalesce(trim(p_note), '') = '' then
    raise exception 'Zur Nachbesserung gehört ein Hinweis, was fehlt';
  end if;

  -- Zurück auf übernommen: Die Person behält die Aufgabe, nur die Meldung ist
  -- zurückgenommen.
  update task_assignments
     set submitted_at = null
   where id = p_assignment_id;

  if v_task.status = 'submitted' then
    update tasks set status = 'claimed' where id = v_task.id;
  end if;

  select user_id into v_user from club_members where id = v_assignment.member_id;
  if v_user is not null and not v_task.is_sample then
    perform notify(
      v_user, 'task', v_task.title, trim(p_note),
      '/tabs/marketplace?task=' || v_task.id, v_task.club_id
    );
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 3: Wer hat übernommen, wann gemeldet, mit welchem Nachweis?
--
-- Als Funktion und nicht als Abfrage über `club_members`: Die Liste nennt
-- Namen zu Übernahmen, und wer sie sehen darf, entscheidet die Rolle – nicht
-- die Sichtbarkeitseinstellung des einzelnen Profils.
-- ---------------------------------------------------------------------------
create or replace function public.task_roster(p_task_id uuid)
returns table (
  assignment_id uuid,
  member_id     uuid,
  display_name  text,
  claimed_at    timestamptz,
  submitted_at  timestamptz,
  proof_url     text,
  confirmed_at  timestamptz,
  kudos         text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from tasks where id = p_task_id;
  if v_club is null then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  if not is_club_trainer(v_club) then
    raise exception 'Nur Trainer:innen und der Vorstand sehen die Übernahmen';
  end if;

  return query
    select a.id, a.member_id, m.display_name, a.claimed_at, a.submitted_at,
           a.proof_url, a.confirmed_at, a.kudos
      from task_assignments a
      join club_members m on m.id = a.member_id
     where a.task_id = p_task_id
     -- Zwei Übernahmen desselben Augenblicks – etwa aus einem Import – hätten
     -- ohne zweites Merkmal keine feste Reihenfolge, und die Liste spränge bei
     -- jedem Aufruf.
     order by a.claimed_at, m.display_name, a.id;
end;
$$;

revoke execute on function public.confirm_task(uuid, text) from public, anon;
grant  execute on function public.confirm_task(uuid, text) to authenticated;

revoke execute on function public.reject_task(uuid, text) from public, anon;
grant  execute on function public.reject_task(uuid, text) to authenticated;

revoke execute on function public.task_roster(uuid) from public, anon;
grant  execute on function public.task_roster(uuid) to authenticated;
