-- ============================================================================
-- 0051_contribution_profile: Beitrags-Profil erfassen (UC-033)
--
-- **BR-142: «Anfragen statt abfragen.»** `suggest_task()` aus `0033`
-- benachrichtigt heute jedes Mitglied des Vereins – das ist eine Ausschreibung
-- mit Zustellung, kein Angebot. Genau darum steht FR-059 seit UC-017 auf
-- `In Progress`.
--
-- Hier bekommt sie ihren Sinn: Wer ein Profil hat, bekommt, was dazu passt –
-- und **nur** das. Wer keines hat, bekommt weiterhin alles (BR-143): Das
-- Profil ist freiwillig, und ein fehlendes darf weder auffallen noch gemeldet
-- werden.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Das Profil.
--
-- Eine Zeile kann auch **leer** sein: `asked_at` ohne Interessen hält fest,
-- dass gefragt wurde und die Person später ausfüllen wollte (A1). Ohne diese
-- Möglichkeit gäbe es keinen Ort für «nicht jetzt» – und die jährliche Frage
-- käme jeden Monat.
-- ---------------------------------------------------------------------------
create table if not exists member_contribution_profiles (
  member_id   uuid primary key references club_members(id) on delete cascade,
  club_id     uuid not null references clubs(id) on delete cascade,
  -- Dieselbe Liste wie `tasks.category` (`0033`). Zwei Listen, die
  -- auseinanderlaufen, ergäben kein Matching.
  interests   jsonb not null default '[]'::jsonb,
  strengths   text check (strengths is null or length(strengths) <= 1000),
  -- Englisch, wie jeder Datenbankwert (CLAUDE.md). Das Entitätsmodell nennt
  -- die deutschen Wörter; die sind die Anzeige, nicht der Wert.
  time_budget text check (time_budget in ('once','monthly','seasonal')),
  asked_at    timestamptz,
  updated_at  timestamptz not null default now()
);

create index if not exists contribution_profiles_club_idx
  on member_contribution_profiles(club_id);

alter table member_contribution_profiles
  drop constraint if exists contribution_profiles_interests_check;
alter table member_contribution_profiles
  add constraint contribution_profiles_interests_check
  check (jsonb_typeof(interests) = 'array');

-- Ein ausgefülltes Profil trägt sein Zeitbudget: Ohne das wäre BR-144 nicht
-- anwendbar. Als `case` und nicht als `or`-Kette – eine Kette aus Vergleichen
-- mit NULL ergibt NULL, und ein `check`, der NULL liefert, gilt als erfüllt.
alter table member_contribution_profiles
  drop constraint if exists contribution_profiles_budget_check;
alter table member_contribution_profiles
  add constraint contribution_profiles_budget_check
  check (
    case when jsonb_array_length(interests) = 0
              and coalesce(trim(strengths), '') = ''
      then true
      else time_budget is not null
    end
  );

alter table member_contribution_profiles enable row level security;

-- ---------------------------------------------------------------------------
-- BR-145: Das Profil ist **nicht** Teil der Führungssicht.
--
-- Es gibt genau eine Policy, und sie gibt die eigene Zeile heraus. Nicht dem
-- Vorstand, nicht den Trainer:innen – niemandem. Wer damit arbeitet, ist der
-- Server: `suggest_task()` läuft als `security definer` und liest, ohne dass
-- ein Mensch dabei etwas sähe.
-- ---------------------------------------------------------------------------
drop policy if exists contribution_profiles_own on member_contribution_profiles;
create policy contribution_profiles_own on member_contribution_profiles
  for select using (member_id = current_member_id(club_id));

-- ---------------------------------------------------------------------------
-- Schritte 2–5: das Profil speichern (FR-058).
-- ---------------------------------------------------------------------------
create or replace function public.save_contribution_profile(
  p_club_id     uuid,
  p_interests   jsonb,
  p_strengths   text default null,
  p_time_budget text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_text   text;
  v_bad    int;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Nur Mitglieder führen ein Beitrags-Profil';
  end if;

  if jsonb_typeof(p_interests) <> 'array' then
    raise exception 'Interessen sind eine Liste';
  end if;

  -- Jedes Interesse muss eine bekannte Kategorie sein – dieselbe Liste, aus
  -- der eine Aufgabe ihre Kategorie nimmt.
  select count(*) into v_bad
    from jsonb_array_elements_text(p_interests) x
   where x.value not in ('organisation','facility','catering','transport',
                         'communication','finance','coaching','other');
  if v_bad > 0 then
    raise exception 'Unbekanntes Interessengebiet';
  end if;

  v_text := nullif(trim(coalesce(p_strengths, '')), '');

  if (jsonb_array_length(p_interests) > 0 or v_text is not null)
     and coalesce(p_time_budget, '') = '' then
    raise exception 'Ein ausgefülltes Profil braucht sein Zeitbudget';
  end if;

  insert into member_contribution_profiles
    (member_id, club_id, interests, strengths, time_budget, asked_at, updated_at)
  values
    (v_member, p_club_id, p_interests, v_text, nullif(p_time_budget, ''), now(), now())
  on conflict (member_id) do update
     set interests   = excluded.interests,
         strengths   = excluded.strengths,
         time_budget = excluded.time_budget,
         asked_at    = now(),
         updated_at  = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- BR-144 und A4: Wie viel Budget ist noch offen?
--
-- Gezählt werden **übernommene** Beiträge im laufenden Zeitraum, nicht
-- abgeschlossene: Wer drei Aufgaben angenommen hat, ist beschäftigt, auch wenn
-- noch keine bestätigt ist.
--
-- Ohne Profil gibt die Funktion `null` zurück – kein Budget heisst hier
-- «unbeschränkt», nicht «null» (BR-143).
-- ---------------------------------------------------------------------------
create or replace function public.contribution_budget_left(p_member_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile member_contribution_profiles;
  v_since   timestamptz;
  v_cap     int;
  v_taken   int;
begin
  select * into v_profile from member_contribution_profiles
   where member_id = p_member_id;
  if not found or v_profile.time_budget is null then
    return null;
  end if;

  if v_profile.time_budget = 'once' then
    -- «Einmalig» heisst: einer, bis das Profil neu gesetzt wird.
    v_since := v_profile.updated_at;
    v_cap := 1;
  elsif v_profile.time_budget = 'monthly' then
    v_since := date_trunc('month', now());
    v_cap := 1;
  else
    v_since := greatest(
      date_trunc('year', now()),
      v_profile.updated_at - interval '365 days');
    v_cap := 3;
  end if;

  select count(*) into v_taken
    from task_assignments a
    join tasks t on t.id = a.task_id
   where a.member_id = p_member_id
     and a.claimed_at >= v_since
     and t.is_sample is not true;

  return greatest(v_cap - v_taken, 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Das **eigene** Budget.
--
-- Ohne diesen Weg zeigte die Ansicht im Fall von A4 nur eine leere Liste und
-- könnte nicht sagen, warum. Der Parameter ist der Verein, nicht die Person:
-- Es gibt keine Möglichkeit, jemand anderen einzusetzen.
-- ---------------------------------------------------------------------------
create or replace function public.my_contribution_budget(p_club_id uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select contribution_budget_left(current_member_id(p_club_id));
$$;

-- ---------------------------------------------------------------------------
-- FR-059: Was passt zu meinem Profil?
--
-- Schritt 7 verlangt, dass **unmittelbar** nach dem Speichern die erste
-- passende Aufgabe erscheint. Deshalb eine Abfrage und nicht nur eine
-- Zustellung: Die Ansicht soll fragen können, nicht auf den nächsten Auftrag
-- warten.
-- ---------------------------------------------------------------------------
create or replace function public.matching_tasks(
  p_club_id uuid,
  p_limit   int default 5
)
returns table (
  task_id  uuid,
  title    text,
  why      text,
  category text,
  points   int,
  due_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_member uuid;
  v_profile member_contribution_profiles;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  select * into v_profile from member_contribution_profiles
   where member_id = v_member;

  -- Ohne ausgefülltes Profil gibt es keine persönlichen Vorschläge. Die
  -- allgemeine Liste steht im Marktplatz – das ist der Fall aus A1.
  if not found or jsonb_array_length(v_profile.interests) = 0 then
    return;
  end if;

  -- A4: ausgeschöpftes Budget stellt die persönlichen Vorschläge zurück.
  if coalesce(contribution_budget_left(v_member), 1) <= 0 then
    return;
  end if;

  return query
    select t.id, t.title, t.why, t.category, t.points, t.due_at
      from tasks t
      left join team_members tm
        on tm.team_id = t.team_id and tm.member_id = v_member
     where t.club_id = p_club_id
       -- `open` schliesst den Entwurf bereits aus; ein `published_at` gibt es
       -- an einer Aufgabe nicht (`0033`).
       and t.status = 'open'
       and not t.is_sample
       and (t.due_at is null or t.due_at > now())
       and v_profile.interests @> jsonb_build_array(t.category)
       -- Der Geltungsbereich gilt auch für einen Vorschlag: Eine Aufgabe eines
       -- fremden Teams anzubieten wäre ein Angebot, das ins Leere führt.
       and (t.team_id is null or tm.member_id is not null)
       -- Wer ausschreibt, braucht keinen Vorschlag, es selbst zu übernehmen.
       and t.created_by <> v_member
       and not exists (select 1 from task_assignments a
                        where a.task_id = t.id and a.member_id = v_member)
       -- Volle Aufgaben sind kein Angebot mehr.
       and (select count(*) from task_assignments a where a.task_id = t.id)
           < t.max_assignees
     order by t.due_at nulls last, t.created_at
     limit greatest(p_limit, 1);
end;
$$;

-- ---------------------------------------------------------------------------
-- Der zweite Teil des Ziels: **Ämter**.
--
-- Eine Vakanz-Anzeige im Marktplatz ist Ausbaustufe 2 (`MVP_Scope` §2). Ein
-- vakantes Amt jemandem anzubieten, der «Organisation» oder «Finanzen» als
-- Interesse genannt hat, ist es nicht – und es ist der Kern von K3b.
-- ---------------------------------------------------------------------------
create or replace function public.matching_vacancies(p_club_id uuid)
returns table (role_id uuid, title text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_member uuid;
  v_profile member_contribution_profiles;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  select * into v_profile from member_contribution_profiles
   where member_id = v_member;
  if not found or jsonb_array_length(v_profile.interests) = 0 then
    return;
  end if;

  -- Ein Amt trägt keine Kategorie. Angeboten wird es deshalb denen, die
  -- Organisation oder Finanzen genannt haben – die zwei Interessen, unter die
  -- ein Amt fällt, ohne dass jemand es einordnen müsste.
  if not (v_profile.interests @> '["organisation"]'::jsonb
          or v_profile.interests @> '["finance"]'::jsonb) then
    return;
  end if;

  return query
    select r.id, r.title
      from functionary_roles r
     where r.club_id = p_club_id
       and r.holder_member_id is null
     order by r.title;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-059, der Kern: aus der Ausschreibung wird ein Angebot.
--
-- Drei Gruppen, drei Behandlungen:
--   * **Profil passt** und Budget offen  → persönliches Angebot
--   * **kein Profil**                    → wie bisher (BR-143)
--   * **Profil passt nicht** oder Budget erschöpft → **nichts**
--
-- Die dritte Zeile ist die eigentliche Änderung. Sie sieht aus wie ein
-- Nachteil für alle, die ein Profil führen, und ist das Gegenteil: Wer gesagt
-- hat, was ihn interessiert, soll nicht mit allem anderen behelligt werden
-- (BR-142, BR-144).
-- ---------------------------------------------------------------------------
create or replace function public.suggest_task(p_task_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_task    tasks;
  v_person  record;
  v_matches boolean;
  v_count   int := 0;
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
    select distinct m.id, m.user_id, p.interests, p.time_budget
    from club_members m
    left join team_members tm on tm.member_id = m.id
    left join member_contribution_profiles p on p.member_id = m.id
    where m.club_id = v_task.club_id
      and m.status <> 'left'
      and m.user_id is not null
      -- Wer ausschreibt, braucht keinen Vorschlag, es selbst zu übernehmen.
      and m.id <> v_task.created_by
      and (v_task.team_id is null or tm.team_id = v_task.team_id)
  loop
    if v_person.interests is null
       or jsonb_array_length(v_person.interests) = 0 then
      -- Kein Profil: alles wie bisher.
      perform notify(
        v_person.user_id, 'task', v_task.title, v_task.why,
        '/tabs/marketplace?task=' || v_task.id, v_task.club_id);
      v_count := v_count + 1;
      continue;
    end if;

    v_matches := v_person.interests @> jsonb_build_array(v_task.category);
    if not v_matches then
      continue;
    end if;

    if coalesce(contribution_budget_left(v_person.id), 1) <= 0 then
      continue;
    end if;

    -- Der Text sagt, dass es ein Angebot ist. «Das könnte zu dir passen» ist
    -- etwas anderes als «Eine Aufgabe ist offen» – und genau der Unterschied,
    -- den BR-142 meint.
    perform notify(
      v_person.user_id, 'task', v_task.title,
      coalesce(v_task.why, v_task.title),
      '/tabs/marketplace?task=' || v_task.id, v_task.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 1 und A1: die jährliche Frage.
--
-- Gefragt wird, wer noch nie gefragt wurde oder wessen Profil ein Jahr alt ist
-- – **unabhängig davon, ob es ausgefüllt ist**. Wer «später» gewählt hat, wird
-- damit im nächsten Durchgang wieder gefragt und dazwischen nie.
-- ---------------------------------------------------------------------------
create or replace function public.ask_contribution_profiles()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_person record;
  v_count  int := 0;
begin
  for v_person in
    select m.id, m.club_id, m.user_id
      from club_members m
      left join member_contribution_profiles p on p.member_id = m.id
     where m.status <> 'left'
       and m.user_id is not null
       and (p.asked_at is null or p.asked_at < now() - interval '365 days')
  loop
    insert into member_contribution_profiles (member_id, club_id, asked_at)
    values (v_person.id, v_person.club_id, now())
    on conflict (member_id) do update set asked_at = now();

    perform notify(v_person.user_id, 'task',
                   'Womit trägst du gern bei?',
                   null, '/tabs/marketplace', v_person.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte. Eine neue `security definer`-Funktion ist sofort ein offener
-- Endpunkt (CLAUDE.md).
-- ---------------------------------------------------------------------------
revoke execute on function public.save_contribution_profile(uuid, jsonb, text, text)
  from public, anon;
grant  execute on function public.save_contribution_profile(uuid, jsonb, text, text)
  to authenticated;

revoke execute on function public.matching_tasks(uuid, int) from public, anon;
grant  execute on function public.matching_tasks(uuid, int) to authenticated;

revoke execute on function public.matching_vacancies(uuid) from public, anon;
grant  execute on function public.matching_vacancies(uuid) to authenticated;

-- Das eigene Budget darf die App erfragen; ein fremdes ergibt keinen Sinn und
-- wäre eine Auskunft über die Belastung einer anderen Person.
revoke execute on function public.contribution_budget_left(uuid)
  from public, anon, authenticated;

revoke execute on function public.my_contribution_budget(uuid) from public, anon;
grant  execute on function public.my_contribution_budget(uuid) to authenticated;

revoke execute on function public.suggest_task(uuid) from public, anon, authenticated;
revoke execute on function public.ask_contribution_profiles()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Der Auftrag. Wöchentlich, damit die Jahresfrist eines Mitglieds höchstens
-- eine Woche zu spät greift – gefragt wird trotzdem nur einmal im Jahr.
-- ---------------------------------------------------------------------------
select cron.unschedule('contribution-ask')
 where exists (select 1 from cron.job where jobname = 'contribution-ask');
select cron.schedule('contribution-ask', '15 8 * * 2',
  $cron$select public.ask_contribution_profiles();$cron$);
