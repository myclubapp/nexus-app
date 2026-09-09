-- ============================================================================
-- 0033_task_marketplace: Aufgabe im Marktplatz ausschreiben (UC-017)
--
-- `tasks` steht seit 0004, aber nur als Lesestoff: Es gibt keinen Weg, eine
-- Aufgabe anzulegen. Der Marktplatz eines frisch gegründeten Vereins bleibt
-- deshalb für immer leer.
--
-- Dazu fehlen im Schema drei Dinge, die UC-017 verlangt:
--   BR-069  Das Warum – ohne Sinnzusammenhang keine Publikation.
--   A3      Der Entwurf: erfasst, aber weder sichtbar noch zugestellt.
--   A2      Der Rhythmus, in dem sich eine Aufgabe wiederholt.
--
-- Vorbild in jeder Hinsicht ist UC-011 (0018/0021): dieselbe Trennung von
-- Anlegen und Ausschreiben, dieselbe sanfte Sperre, derselbe Zähler für die
-- Verbindungs-Quote. Ein Aufgaben-Push ist ein Aufruf wie ein Helfergesuch.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
alter table tasks add column if not exists why text;
alter table tasks add column if not exists is_sample boolean not null default false;
-- A2: der Rhythmus in Tagen. Kein Cron-Ausdruck – eine Aufgabe wiederholt
-- sich nach ihrem Abschluss, nicht nach dem Kalender.
alter table tasks add column if not exists recurrence_days int;

-- A3: der Entwurfszustand. Das Entitätsmodell führt ihn als Status; anders als
-- beim Termin (`published_at`) gibt es hier keine zweite Frage, die ein
-- Zeitstempel nebenbei beantworten würde.
alter table tasks drop constraint if exists tasks_status_check;
alter table tasks add constraint tasks_status_check
  check (status in ('draft','open','claimed','submitted','done','expired'));

-- Kategorien sind eine feste Liste und keine Freitextspalte: UC-033 Schritt 2
-- lässt das Mitglied seine Interessen aus **derselben** Liste wählen. Zwei
-- Listen, die auseinanderlaufen, ergeben kein Matching (FR-059).
update tasks set category = 'other' where coalesce(trim(category), '') = '';
alter table tasks alter column category set default 'other';
alter table tasks alter column category set not null;
alter table tasks drop constraint if exists tasks_category_check;
alter table tasks add constraint tasks_category_check
  check (category in (
    'organisation','facility','catering','transport',
    'communication','finance','coaching','other'
  ));

-- BR-069: Ein Aufruf ohne Sinnzusammenhang wird nicht publiziert.
--
-- Der Constraint greift am publizierten Datensatz und nicht am Entwurf. 0020
-- hat gelehrt, warum: Verlangt er das Warum schon beim Anlegen, steht A3 im
-- Widerspruch zum Schema – wer halb erfasst und «Entwurf sichern» wählt,
-- bekäme eine Constraint-Verletzung statt eines Entwurfs.
update tasks
   set why = coalesce(nullif(trim(why), ''), nullif(trim(description), ''), title)
 where status <> 'draft' and coalesce(trim(why), '') = '';
alter table tasks drop constraint if exists tasks_why_check;
alter table tasks add constraint tasks_why_check
  check (
    status = 'draft'
    or is_sample
    or coalesce(trim(why), '') <> ''
  );

-- Das Entitätsmodell nennt beide Grenzen; ohne sie ergäbe eine Aufgabe mit
-- `max_assignees = 0` einen Aufruf, dem niemand folgen kann (C-011).
alter table tasks drop constraint if exists tasks_points_check;
alter table tasks add constraint tasks_points_check check (points >= 0);
alter table tasks drop constraint if exists tasks_max_assignees_check;
alter table tasks add constraint tasks_max_assignees_check check (max_assignees >= 1);

-- A2: Ein Rhythmus ohne Wiederholung ist Ziererei, eine Wiederholung ohne
-- Rhythmus unbestimmt.
alter table tasks drop constraint if exists tasks_recurrence_check;
-- Als `case` und nicht als `or`-Kette: `recurring` ohne Rhythmus ergäbe dort
-- `null or false` – und ein Constraint, der `null` liefert, lässt die Zeile
-- durch. Genau so kam die Prüfung durch, bevor sie es nicht mehr tat.
alter table tasks add constraint tasks_recurrence_check
  check (
    case when task_type = 'recurring'
      then recurrence_days is not null and recurrence_days between 1 and 730
      else recurrence_days is null
    end
  );

create index if not exists tasks_club_due_idx on tasks(club_id, due_at);

-- ---------------------------------------------------------------------------
-- 2. Sichtbarkeit und Schreibrecht
--
-- Die Voraussetzung von UC-017 nennt trainer **oder** admin; `tasks_admin_write`
-- aus 0006 liess nur den Vorstand schreiben. Eine Trainer:in käme damit nicht
-- an die Aufgabe für ihr eigenes Team.
-- ---------------------------------------------------------------------------
drop policy if exists tasks_read on tasks;
create policy tasks_read on tasks
  for select using (
    is_club_member(club_id)
    and (status <> 'draft' or is_club_trainer(club_id))
  );

drop policy if exists tasks_admin_write on tasks;
drop policy if exists tasks_trainer_insert on tasks;
drop policy if exists tasks_trainer_update on tasks;
drop policy if exists tasks_trainer_delete on tasks;

-- Getrennt nach Vorgang, nicht `for all`: Beim Anlegen ist `created_by` an die
-- schreibende Person gebunden – sonst schriebe jemand eine Aufgabe im Namen
-- eines anderen aus. Beim Ändern darf das nicht gelten, sonst käme ein
-- zweites Vorstandsmitglied nicht mehr an die Aufgabe, um sie zu korrigieren.
create policy tasks_trainer_insert on tasks
  for insert with check (
    is_club_trainer(club_id) and created_by = current_member_id(club_id)
  );
create policy tasks_trainer_update on tasks
  for update using (is_club_trainer(club_id)) with check (is_club_trainer(club_id));
create policy tasks_trainer_delete on tasks
  for delete using (is_club_trainer(club_id));

-- ---------------------------------------------------------------------------
-- 3. Schritt 7: der persönliche Vorschlag.
--
-- «Persönlich» heisst heute noch «im Geltungsbereich»: Ohne Beitrags-Profil
-- (UC-033) gibt es kein Kriterium, an dem sich «passend» messen liesse. Die
-- Funktion ist die Stelle, an der das Matching später einsetzt – der
-- Empfängerkreis steht dann hier und nirgendwo sonst.
--
-- Intern: Sie schreibt in fremde Inboxen und darf kein eigener Endpunkt sein.
-- ---------------------------------------------------------------------------
create or replace function public.suggest_task(p_task_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task   tasks;
  v_person record;
  v_count  int := 0;
begin
  select * into v_task from tasks where id = p_task_id;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  -- C-031/BR-161: Beispielinhalte lösen keine Zustellung aus.
  if v_task.is_sample then
    return 0;
  end if;

  for v_person in
    select distinct m.user_id
    from club_members m
    left join team_members tm on tm.member_id = m.id
    where m.club_id = v_task.club_id
      and m.status <> 'left'
      and m.user_id is not null
      -- Wer ausschreibt, braucht keinen Vorschlag, es selbst zu übernehmen.
      and m.id <> v_task.created_by
      and (v_task.team_id is null or tm.team_id = v_task.team_id)
  loop
    perform notify(
      v_person.user_id, 'task',
      v_task.title,
      v_task.why,
      '/tabs/marketplace?task=' || v_task.id,
      v_task.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Zustellung und Zähler – der Teil, den auch die Neuausschreibung (A2) braucht.
--
-- Die sanfte Sperre unterdrückt den Push, nicht die Sichtbarkeit: Die Aufgabe
-- steht im Marktplatz, sie klopft nur an keine Tür (K1, BR-044).
-- ---------------------------------------------------------------------------
create or replace function public.announce_task(p_task_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task  tasks;
  v_muted boolean;
  v_count int := 0;
begin
  select * into v_task from tasks where id = p_task_id;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  v_muted := call_is_muted(v_task.club_id);
  if not v_muted then
    select suggest_task(p_task_id) into v_count;
  end if;

  -- Der Zähler bekommt seinen Eintrag auch bei stiller Zustellung: Der Aufruf
  -- ist ergangen, er war nur leiser.
  if not v_task.is_sample then
    perform log_club_message(v_task.club_id, 'call', 'task:' || v_task.category);
  end if;

  return query select v_count, v_muted;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Schritte 1–5: die Aufgabe anlegen.
--
-- Sie entsteht immer als **Entwurf**. Erst `publish_task()` macht sie sichtbar
-- und stellt zu – so ist A3 kein Sonderweg, sondern der Normalfall, bei dem
-- der zweite Schritt einfach ausbleibt.
--
-- Der Verein wird übergeben und nicht erraten: `create_helper_event()` sucht
-- sich die erste Vorstands-Mitgliedschaft der Person; wer zwei Vereine führt,
-- schreibt damit im falschen aus.
-- ---------------------------------------------------------------------------
create or replace function public.create_task(
  p_club_id         uuid,
  p_title           text,
  p_why             text,
  p_category        text,
  p_points          int,
  p_due_at          timestamptz default null,
  p_max_assignees   int default 1,
  p_description     text default null,
  p_team_id         uuid default null,
  p_recurrence_days int default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_task   uuid;
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben Aufgaben aus';
  end if;

  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Eine Aufgabe braucht einen Titel';
  end if;

  -- Ein Team aus einem fremden Verein ergäbe einen Geltungsbereich, den
  -- niemand sieht.
  if p_team_id is not null
     and not exists (select 1 from teams where id = p_team_id and club_id = p_club_id) then
    raise exception 'Dieses Team gehört nicht zu diesem Verein';
  end if;

  insert into tasks (
    club_id, team_id, title, description, why, category, points,
    task_type, due_at, max_assignees, status, created_by, recurrence_days
  )
  values (
    p_club_id, p_team_id, trim(p_title), nullif(trim(p_description), ''),
    nullif(trim(p_why), ''), p_category, greatest(coalesce(p_points, 0), 0),
    case when p_recurrence_days is null then 'oneoff' else 'recurring' end,
    p_due_at, greatest(coalesce(p_max_assignees, 1), 1), 'draft', v_member,
    p_recurrence_days
  )
  returning id into v_task;

  return v_task;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 5–7: ausschreiben.
--
-- Publikation und Zustellung gehören zusammen: Eine Aufgabe, die sichtbar ist,
-- aber niemanden erreicht hat, ist der halbe Aufruf.
-- ---------------------------------------------------------------------------
create or replace function public.publish_task(p_task_id uuid)
returns table (notified int, muted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task tasks;
begin
  -- Gesperrt gelesen: Zwei gleichzeitige Publikationen stellten sonst zweimal
  -- zu, weil beide den Entwurf sähen.
  select * into v_task from tasks where id = p_task_id for update;
  if not found then
    raise exception 'Aufgabe nicht gefunden';
  end if;

  if not is_club_trainer(v_task.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben Aufgaben aus';
  end if;

  -- Zweimal ausschreiben ändert nichts und benachrichtigt niemanden erneut.
  if v_task.status <> 'draft' then
    return query select 0, false;
    return;
  end if;

  -- A1/BR-069: Der Constraint deckt den publizierten Datensatz ab; hier steht
  -- es nochmals, weil ein Entwurf ohne Warum bis hierher kommen darf.
  if coalesce(trim(v_task.why), '') = '' then
    raise exception 'Eine Aufgabe braucht ihr Warum, bevor sie ausgeschrieben wird';
  end if;

  update tasks set status = 'open' where id = p_task_id;

  return query select * from announce_task(p_task_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. A2: Nach jeder abgeschlossenen Runde neu ausschreiben.
--
-- Als Trigger und nicht in `confirm_task()`: Der Abschluss ist ein
-- Zustandsübergang der Aufgabe, kein Schritt eines bestimmten Aufrufers. Wer
-- `confirm_task()` später umbaut (UC-019), kann A2 damit nicht verlieren.
--
-- Die neue Runde erbt Frist und Rhythmus; liegt die alte Frist in der
-- Vergangenheit, zählt der Rhythmus ab heute – sonst entstände eine Aufgabe,
-- die schon abgelaufen zur Welt kommt.
-- ---------------------------------------------------------------------------
create or replace function public.reissue_recurring_task()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new uuid;
begin
  if new.task_type <> 'recurring' or new.recurrence_days is null or new.is_sample then
    return new;
  end if;

  insert into tasks (
    club_id, team_id, title, description, why, category, points,
    task_type, due_at, max_assignees, status, created_by, recurrence_days
  )
  values (
    new.club_id, new.team_id, new.title, new.description, new.why,
    new.category, new.points, 'recurring',
    greatest(coalesce(new.due_at, now()), now())
      + make_interval(days => new.recurrence_days),
    new.max_assignees, 'open', new.created_by, new.recurrence_days
  )
  returning id into v_new;

  perform announce_task(v_new);
  return new;
end;
$$;

drop trigger if exists tasks_reissue_recurring on tasks;
create trigger tasks_reissue_recurring
  after update of status on tasks
  for each row
  when (new.status = 'done' and old.status is distinct from 'done')
  execute function public.reissue_recurring_task();

-- ---------------------------------------------------------------------------
-- 6. A4: Die Frist läuft ab.
--
-- Nur Aufgaben **ohne** Übernahme laufen ab. UC-018 A4 lässt die Einreichung
-- nach Fristablauf ausdrücklich zu – wer angefangen hat, dem darf die Aufgabe
-- nicht unter den Händen verschwinden.
--
-- Die ausschreibende Person erfährt es; sie hat den Aufruf zu verantworten und
-- muss entscheiden, ob sie ihn erneuert.
-- ---------------------------------------------------------------------------
create or replace function public.expire_tasks(p_limit int default 500)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task  record;
  v_count int := 0;
  v_user  uuid;
begin
  for v_task in
    select t.id, t.club_id, t.title, t.created_by
      from tasks t
     where t.status = 'open'
       and t.due_at is not null
       and t.due_at < now()
       and not t.is_sample
       and not exists (select 1 from task_assignments a where a.task_id = t.id)
     order by t.due_at
     limit p_limit
  loop
    begin
      update tasks set status = 'expired' where id = v_task.id;

      select m.user_id into v_user from club_members m where m.id = v_task.created_by;
      if v_user is not null then
        perform notify(
          v_user, 'task', 'Frist abgelaufen', v_task.title,
          '/tabs/marketplace?task=' || v_task.id, v_task.club_id
        );
      end if;

      v_count := v_count + 1;
    exception when others then
      -- Eine klemmende Aufgabe darf die übrigen nicht mitnehmen.
      raise warning 'Ablauf von % fehlgeschlagen: %', v_task.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Rechte.
--
-- Jede neue security-definer-Funktion hängt sofort unter /rest/v1/rpc/ und
-- umgeht die RLS, die sie schützen soll. `suggest_task`, `announce_task`,
-- `reissue_recurring_task` und `expire_tasks` schreiben in fremde Inboxen
-- beziehungsweise laufen ohne Rollenprüfung – sie sind intern.
-- ---------------------------------------------------------------------------
revoke execute on function public.suggest_task(uuid) from public, anon, authenticated;
revoke execute on function public.announce_task(uuid) from public, anon, authenticated;
revoke execute on function public.reissue_recurring_task() from public, anon, authenticated;
revoke execute on function public.expire_tasks(int) from public, anon, authenticated;

revoke execute on function public.create_task(
  uuid, text, text, text, int, timestamptz, int, text, uuid, int
) from public, anon;
grant execute on function public.create_task(
  uuid, text, text, text, int, timestamptz, int, text, uuid, int
) to authenticated;

revoke execute on function public.publish_task(uuid) from public, anon;
grant  execute on function public.publish_task(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Der Ablauf-Lauf. Stündlich versetzt, damit er sich nicht mit den
-- Erinnerungen aus 0032 auf dieselbe Minute legt.
-- ---------------------------------------------------------------------------
select cron.unschedule('task-expiry')
 where exists (select 1 from cron.job where jobname = 'task-expiry');

select cron.schedule(
  'task-expiry',
  '23 * * * *',
  $cron$select public.expire_tasks();$cron$
);
