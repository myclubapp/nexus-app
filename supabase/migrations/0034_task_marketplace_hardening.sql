-- ============================================================================
-- 0034_task_marketplace_hardening: Befunde des Code-Reviews zu UC-017
--
-- Zwei Befunde, beide an derselben Stelle: dem Geltungsbereich.
--
-- 1. **Schritt 4 war wirkungslos.** Die Zustellung achtete auf das Team, die
--    Sichtbarkeit nicht: `tasks_read` liess jedes Vereinsmitglied jede
--    Team-Aufgabe lesen, und `claim_task()` liess sie jeden übernehmen.
--    Nachgemessen: Ein Mitglied ausserhalb des Teams sah die Aufgabe und
--    konnte sie übernehmen. Die Postcondition («erscheint im Marktplatz im
--    gewählten Geltungsbereich») war damit nicht erfüllt.
--
-- 2. **Die Ablauf-Meldung führte ins Leere.** `expire_tasks()` verlinkt die
--    Aufgabe, aber eine abgelaufene Aufgabe stand in keiner Ansicht: Die
--    ausschreibende Person klickte auf einen Marktplatz ohne ihre Aufgabe.
--
-- Der Geltungsbereich steht ab jetzt **einmal** – in `task_in_scope()`. Policy
-- und Funktion lesen dieselbe Regel; zwei Kopien wären zwei Regeln, die
-- auseinanderlaufen.
-- ============================================================================

create or replace function public.task_in_scope(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from tasks t
     where t.id = p_task_id
       and is_club_member(t.club_id)
       and (
         -- Ein Vereinsaufruf gilt allen.
         t.team_id is null
         -- Wer ausschreibt, sieht auch, was er für andere Teams ausgeschrieben
         -- hat – sonst verlöre der Vorstand seine eigenen Aufgaben aus dem Blick.
         or is_club_trainer(t.club_id)
         or exists (
           select 1
             from team_members tm
            where tm.team_id = t.team_id
              and tm.member_id = current_member_id(t.club_id)
         )
       )
  );
$$;

-- Rekursionsfrei: Die Funktion läuft als `security definer` und umgeht damit
-- die Policy, in der sie steht.
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select using (
    -- Entwurf (A3) und Abgelaufenes (A4) gehören der ausschreibenden Seite:
    -- Das eine ist noch kein Aufruf, das andere keiner mehr.
    (status not in ('draft', 'expired') or is_club_trainer(club_id))
    and task_in_scope(id)
  );

-- Wer die Aufgabe nicht sehen darf, soll auch nicht sehen, wer sie übernommen hat.
drop policy if exists task_assignments_read on task_assignments;
create policy task_assignments_read on task_assignments
  for select using (task_in_scope(task_id));

-- ---------------------------------------------------------------------------
-- `claim_task()` prüft den Geltungsbereich selbst.
--
-- Die Policy schützt hier nichts: Die Funktion ist `security definer` und
-- umgeht die RLS, die sie schützen soll. Ohne diesen Zusatz übernimmt jedes
-- Vereinsmitglied jede Team-Aufgabe – die Id genügt.
-- ---------------------------------------------------------------------------
create or replace function public.claim_task(p_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task   tasks;
  v_member uuid;
  v_taken  int;
  v_id     uuid;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  v_member := current_member_id(v_task.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Schritt 4 aus UC-017: Eine Aufgabe für ein Team ist kein Angebot an alle.
  if not task_in_scope(p_task_id) then
    raise exception 'Diese Aufgabe gilt für ein anderes Team';
  end if;

  if v_task.status not in ('open','claimed') then
    raise exception 'Diese Aufgabe ist nicht mehr offen';
  end if;

  select count(*) into v_taken from task_assignments where task_id = p_task_id;
  if v_taken >= v_task.max_assignees then
    raise exception 'Diese Aufgabe ist bereits vergeben';
  end if;

  insert into task_assignments (task_id, member_id)
  values (p_task_id, v_member)
  returning id into v_id;

  if v_taken + 1 >= v_task.max_assignees then
    update tasks set status = 'claimed' where id = p_task_id;
  end if;

  return v_id;
end;
$$;

-- Die Policy ruft sie im Namen der anfragenden Person – `authenticated` braucht
-- das Ausführungsrecht, `anon` nicht.
revoke execute on function public.task_in_scope(uuid) from public, anon;
grant  execute on function public.task_in_scope(uuid) to authenticated;
