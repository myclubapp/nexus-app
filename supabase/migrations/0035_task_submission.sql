-- ============================================================================
-- 0035_task_submission: Aufgabe einreichen und zurückgeben (UC-018)
--
-- `claim_task()` steht seit 0004 – und danach hört es auf. Wer heute eine
-- Aufgabe übernimmt, sitzt in einer Sackgasse: Sie steht in seiner Liste und
-- bleibt dort. Es fehlen der Weg nach vorn (Schritt 7/8) und der Weg zurück
-- (A3).
--
-- Die Rechte dafür bestehen seit 0006 (`task_assignments_submit_self`,
-- `task_assignments_delete_self`) – aber sie decken nur die eigene Zeile ab.
-- Der Statuswechsel der **Aufgabe** gehört dem Vorstand, und die Meldung an
-- die verantwortliche Person schreibt in eine fremde Inbox. Beides geht nur
-- über eine Funktion.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Schritt 7 und 8: erledigt melden.
--
-- Die Frist hält niemanden auf (A4): Wer zu spät fertig wird, hat trotzdem
-- geholfen. Der Nachweis ist optional (A5) und ein Verweis, kein Anhang –
-- so führt ihn das Entitätsmodell.
-- ---------------------------------------------------------------------------
create or replace function public.submit_task(
  p_task_id   uuid,
  p_proof_url text default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task       tasks;
  v_member     uuid;
  v_assignment task_assignments;
  v_open       int;
  v_taken      int;
  v_owner      uuid;
  v_name       text;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  v_member := current_member_id(v_task.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  select * into v_assignment
    from task_assignments
   where task_id = p_task_id and member_id = v_member;
  if not found then
    raise exception 'Diese Aufgabe hast du nicht übernommen';
  end if;

  -- BR-079 vorweggenommen: Was bestätigt ist, wird nicht erneut eingereicht.
  if v_assignment.confirmed_at is not null then
    raise exception 'Diese Aufgabe ist bereits bestätigt';
  end if;

  -- Zweimal melden ändert nichts und benachrichtigt niemanden erneut.
  if v_assignment.submitted_at is not null then
    return false;
  end if;

  update task_assignments
     set submitted_at = now(),
         proof_url = nullif(trim(p_proof_url), '')
   where id = v_assignment.id;

  -- A2: Solange Plätze frei sind oder noch jemand arbeitet, bleibt die Aufgabe,
  -- wo sie ist. Erst wenn sie voll ist **und** alle gemeldet haben, ist sie als
  -- Ganzes eingereicht – sonst verschwände sie aus dem Marktplatz, obwohl noch
  -- jemand mitmachen könnte.
  select count(*) into v_taken from task_assignments where task_id = p_task_id;
  select count(*) into v_open
    from task_assignments
   where task_id = p_task_id and submitted_at is null;

  if v_taken >= v_task.max_assignees and v_open = 0 then
    update tasks set status = 'submitted' where id = p_task_id;
  end if;

  -- Schritt 8: Die verantwortliche Person erfährt davon – über die Inbox, die
  -- auch ohne Push-Erlaubnis ankommt (NFR-009).
  select display_name into v_name from club_members where id = v_member;
  select user_id into v_owner from club_members where id = v_task.created_by;

  if v_owner is not null and not v_task.is_sample then
    perform notify(
      v_owner, 'task', 'Aufgabe erledigt gemeldet',
      v_task.title || ' – ' || coalesce(v_name, 'ein Mitglied'),
      '/tabs/marketplace?task=' || p_task_id,
      v_task.club_id
    );
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- A3: «Doch nicht».
--
-- BR-075: ohne Punkteabzug und ohne Vermerk am Mitglied. Die Zeile wird
-- gelöscht und nicht als «zurückgegeben» markiert – ein solcher Vermerk wäre
-- genau der Nachteil, den die Regel ausschliesst.
--
-- Gewarnt wird nur, wenn es drängt: Eine Aufgabe ohne Frist drängt nie.
-- ---------------------------------------------------------------------------
create or replace function public.release_task(p_task_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task    tasks;
  v_member  uuid;
  v_id      uuid;
  v_confirm timestamptz;
  v_user    uuid;
  v_warned  boolean := false;
begin
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  v_member := current_member_id(v_task.club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  select id, confirmed_at into v_id, v_confirm
    from task_assignments
   where task_id = p_task_id and member_id = v_member;
  if v_id is null then
    raise exception 'Diese Aufgabe hast du nicht übernommen';
  end if;

  if v_confirm is not null then
    raise exception 'Diese Aufgabe ist bereits bestätigt';
  end if;

  delete from task_assignments where id = v_id;

  -- Sie steht wieder im Angebot. `expired` bleibt `expired`: Eine Aufgabe,
  -- deren Frist verstrichen ist, kehrt nicht in den Marktplatz zurück.
  if v_task.status in ('claimed', 'submitted') then
    update tasks set status = 'open' where id = p_task_id;
  end if;

  if v_task.due_at is not null
     and v_task.due_at > now()
     and v_task.due_at <= now() + interval '48 hours'
     and not v_task.is_sample then
    select cm.user_id into v_user from club_members cm where cm.id = v_task.created_by;
    if v_user is not null then
      perform notify(
        v_user, 'task', 'Aufgabe wieder offen',
        v_task.title,
        '/tabs/marketplace?task=' || p_task_id,
        v_task.club_id
      );
      v_warned := true;
    end if;
  end if;

  return v_warned;
end;
$$;

-- ---------------------------------------------------------------------------
-- BR-076: Wie viele Aufgaben habe ich diese Saison übernommen?
--
-- Die eigene Zahl, nicht die der anderen: Eine Rangliste der Zurückhaltenden
-- wäre eine Auswertung über Personen und damit genau das, was NFR-022
-- ausschliesst.
--
-- Gerechnet über `season_label()` – dieselbe Funktion, die auch den Ledger
-- einordnet. Zwei Saisonrechnungen wären zwei Saisons.
-- ---------------------------------------------------------------------------
create or replace function public.my_season_task_count(p_club_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from task_assignments a
    join tasks t on t.id = a.task_id
   where t.club_id = p_club_id
     and a.member_id = current_member_id(p_club_id)
     and season_label(p_club_id, a.claimed_at) = season_label(p_club_id);
$$;

revoke execute on function public.submit_task(uuid, text) from public, anon;
grant  execute on function public.submit_task(uuid, text) to authenticated;

revoke execute on function public.release_task(uuid) from public, anon;
grant  execute on function public.release_task(uuid) to authenticated;

revoke execute on function public.my_season_task_count(uuid) from public, anon;
grant  execute on function public.my_season_task_count(uuid) to authenticated;
