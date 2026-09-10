-- ============================================================================
-- 0049_meeting_inputs: Sitzungs-Input einreichen und zuordnen (UC-031)
--
-- Der Leitsatz steht in MVP_Scope §13: «Die App verwaltet nicht die Sitzung,
-- sondern den Dialog um die Sitzung.» Deshalb entsteht hier **kein** Traktandum,
-- **kein** Protokoll und **keine** freie Aufgabenliste (BR-132) – nur der Weg
-- eines Vorschlags vom Mitglied zum Gremium und die dokumentierte Antwort
-- zurück.
--
-- Das Neue gegenüber UC-030 ist der Empfänger: Ein Anliegen geht an eine Person
-- oder eine Rolle, ein Input an ein **Amt**. Ämter überdauern die Personen, die
-- sie halten – deshalb wird der Verteiler **zum Zustellzeitpunkt** aufgelöst und
-- nie als Namensliste gespeichert (BR-133, A3).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Das Amt.
--
-- MVP_Scope §2 führt «Funktionärsämter mit Factsheets & Vakanz-Anzeige» als
-- Ausbaustufe 2. Hier entsteht deshalb nur, was §13.1 im Kern verlangt: der
-- Verteiler. Kein Factsheet, keine Ausschreibung, keine Nachfolgeplanung.
--
-- Ein Amt hat höchstens **eine** Inhaber:in. Ein Co-Präsidium sind zwei Ämter
-- desselben Titels – das ist ehrlicher als eine Inhaber-Liste, die niemand
-- pflegt.
-- ---------------------------------------------------------------------------
create table if not exists functionary_roles (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs(id) on delete cascade,
  title            text not null check (length(trim(title)) between 2 and 80),
  holder_member_id uuid references club_members(id) on delete set null,
  -- «Inhaber:in seit» – das Einzige aus K4, das ohne Factsheet Sinn ergibt.
  held_since       date,
  created_at       timestamptz not null default now()
);

create index if not exists functionary_roles_club_idx
  on functionary_roles(club_id, title);

-- Ein Titel je Verein genau einmal: Zwei «Kassier:in» wären zwei Verteiler für
-- dieselbe Sache.
create unique index if not exists functionary_roles_title_idx
  on functionary_roles(club_id, lower(title));

-- Ohne Inhaber:in gibt es kein Datum – und mit Inhaber:in ist das Datum
-- Pflicht, sonst steht «seit» ohne Wert in der Ansicht.
alter table functionary_roles drop constraint if exists functionary_roles_since_check;
alter table functionary_roles add constraint functionary_roles_since_check
  check (
    case when holder_member_id is null
      then held_since is null
      else held_since is not null
    end
  );

-- Das Datum führt der Server, nicht das Formular: Wer ein Amt besetzt, denkt
-- an die Person, nicht an das Feld daneben.
create or replace function public.touch_functionary_since()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.holder_member_id is null then
    new.held_since := null;
  elsif new.held_since is null
        or tg_op = 'INSERT'
        or new.holder_member_id is distinct from old.holder_member_id then
    new.held_since := coalesce(new.held_since, current_date);
    if tg_op = 'UPDATE' and new.holder_member_id is distinct from old.holder_member_id then
      new.held_since := current_date;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists functionary_roles_since on functionary_roles;
create trigger functionary_roles_since
  before insert or update on functionary_roles
  for each row execute function touch_functionary_since();

alter table functionary_roles enable row level security;

-- Wer im Verein ist, sieht das Organigramm: Ein Verteiler, den niemand kennt,
-- ist keiner.
drop policy if exists functionary_roles_read on functionary_roles;
create policy functionary_roles_read on functionary_roles
  for select using (is_club_member(club_id));

drop policy if exists functionary_roles_write on functionary_roles;
create policy functionary_roles_write on functionary_roles
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- `announce_event` liest `audience_role_ids` mit `jsonb_array_length`; ein
-- Objekt oder ein Skalar liesse die Ankündigung mit einem Typfehler abbrechen.
alter table events drop constraint if exists events_audience_check;
alter table events add constraint events_audience_check
  check (audience_role_ids is null or jsonb_typeof(audience_role_ids) = 'array');

-- ---------------------------------------------------------------------------
-- Der Input.
--
-- `committee_role_ids` ist eine jsonb-Liste von Amts-Kennungen als Text. Ein
-- «Gremium» ist damit kein eigenes Objekt, sondern eine Menge Ämter – genau
-- das, was BR-133 verlangt, und eine Verwaltung weniger.
-- ---------------------------------------------------------------------------
create table if not exists meeting_inputs (
  id                   uuid primary key default gen_random_uuid(),
  club_id              uuid not null references clubs(id) on delete cascade,
  body                 text not null check (length(trim(body)) between 1 and 5000),
  source_voice_note_id uuid references voice_notes(id) on delete set null,
  -- Bei anonymer Einreichung niemals gefüllt – dieselbe Zusage wie in `0046`,
  -- und wie dort eine Eigenschaft des Schemas (BR-122 sinngemäss).
  author_member_id     uuid references club_members(id) on delete set null,
  anon_token_hash      text,
  committee_role_ids   jsonb not null default '[]'::jsonb,
  meeting_event_id     uuid references events(id) on delete set null,
  status               text not null default 'open'
                         check (status in ('open','scheduled','in_progress','answered','declined')),
  decision_response    text,
  responded_at         timestamptz,
  responded_by         uuid references club_members(id) on delete set null,
  published_news_id    uuid references news(id) on delete set null,
  converted_task_id    uuid references tasks(id) on delete set null,
  created_at           timestamptz not null default now()
);

create index if not exists meeting_inputs_club_idx
  on meeting_inputs(club_id, status, created_at desc);
create index if not exists meeting_inputs_meeting_idx
  on meeting_inputs(meeting_event_id);
create index if not exists meeting_inputs_token_idx
  on meeting_inputs(anon_token_hash) where anon_token_hash is not null;

-- Anonym heisst: keine Autorschaft, aber ein Rückweg. Persönlich heisst:
-- Autorschaft, und kein Ticket, das sie unterlaufen könnte.
--
-- Als `case` und nicht als `or`-Kette: Eine Kette aus Vergleichen mit NULL
-- ergibt NULL, und ein `check`, der NULL liefert, gilt als erfüllt.
alter table meeting_inputs drop constraint if exists meeting_inputs_author_check;
alter table meeting_inputs add constraint meeting_inputs_author_check
  check (
    case when author_member_id is null
      then coalesce(trim(anon_token_hash), '') <> ''
      else anon_token_hash is null
    end
  );

-- Ein Gremium ohne Amt wäre ein Eingangskorb ohne Eigentümer.
alter table meeting_inputs drop constraint if exists meeting_inputs_committee_check;
alter table meeting_inputs add constraint meeting_inputs_committee_check
  check (jsonb_typeof(committee_role_ids) = 'array'
         and jsonb_array_length(committee_role_ids) > 0);

-- BR-128 sinngemäss und Entitätsmodell: Ein Endstatus verlangt die Antwort,
-- ihren Zeitpunkt und die Person, die sie gegeben hat.
alter table meeting_inputs drop constraint if exists meeting_inputs_answer_check;
alter table meeting_inputs add constraint meeting_inputs_answer_check
  check (
    status not in ('answered','declined')
    or (coalesce(trim(decision_response), '') <> ''
        and responded_at is not null
        and responded_by is not null)
  );

-- «Eingeplant» ohne Sitzung ist keine Auskunft (BR-134).
alter table meeting_inputs drop constraint if exists meeting_inputs_scheduled_check;
alter table meeting_inputs add constraint meeting_inputs_scheduled_check
  check (status <> 'scheduled' or meeting_event_id is not null);

alter table meeting_inputs enable row level security;

-- ---------------------------------------------------------------------------
-- Halte ich eines der angeschriebenen Ämter?
--
-- Dieselbe Frage stellen die Lese-Policy und jede schreibende Funktion –
-- deshalb steht sie an **einer** Stelle. Zwei Kopien wären zwei Reichweiten.
-- ---------------------------------------------------------------------------
create or replace function public.holds_committee_role(
  p_club_id uuid,
  p_roles   jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from functionary_roles r
     where r.club_id = p_club_id
       and r.holder_member_id = current_member_id(p_club_id)
       and p_roles @> jsonb_build_array(r.id::text)
  );
$$;

-- Schritt 7 nennt ausdrücklich den Vorstand als triagierende Stelle. Er liest
-- deshalb jeden Eingangskorb – nicht als Nebenwirkung, sondern weil die
-- Spezifikation ihm die Triage zuweist. Sonst bliebe ein Input unsichtbar,
-- sobald ein Amt gerade niemand hält.
create or replace function public.can_handle_input(p_input_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from meeting_inputs i
     where i.id = p_input_id
       and (is_club_admin(i.club_id)
            or holds_committee_role(i.club_id, i.committee_role_ids))
  );
$$;

drop policy if exists meeting_inputs_read on meeting_inputs;
create policy meeting_inputs_read on meeting_inputs
  for select using (
    author_member_id = current_member_id(club_id)
    or is_club_admin(club_id)
    or holds_committee_role(club_id, committee_role_ids)
  );

-- Geschrieben wird ausschliesslich über die Funktionen unten. Ohne eigene
-- Policy für `insert`/`update` bleibt der direkte Weg zu.

-- ---------------------------------------------------------------------------
-- Die aktuellen Amtsinhaber:innen eines Gremiums (BR-133, A3).
--
-- Aufgelöst wird **jetzt**, nicht bei der Einreichung: Wechselt ein Amt
-- zwischen Einreichung und Zustellung die Person, stimmt der Verteiler
-- trotzdem.
-- ---------------------------------------------------------------------------
create or replace function public.committee_members(
  p_club_id uuid,
  p_roles   jsonb
)
returns table (member_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct m.id, m.user_id
    from functionary_roles r
    join club_members m on m.id = r.holder_member_id
   where r.club_id = p_club_id
     and p_roles @> jsonb_build_array(r.id::text)
     and m.status <> 'left'
     and m.user_id is not null;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 5–6: einreichen und zustellen (FR-097).
-- ---------------------------------------------------------------------------
create or replace function public.submit_meeting_input(
  p_club_id    uuid,
  p_body       text,
  p_roles      jsonb,
  p_anonymous  boolean default false,
  p_token_hash text default null,
  p_source_note uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_text   text;
  v_input  uuid;
  v_person record;
  v_known  int;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    raise exception 'Nur Mitglieder reichen Inputs ein';
  end if;

  v_text := nullif(trim(p_body), '');
  if v_text is null then
    raise exception 'Ohne Text kein Input';
  end if;

  if jsonb_typeof(p_roles) <> 'array' or jsonb_array_length(p_roles) = 0 then
    raise exception 'Wähle das Zielgremium';
  end if;

  -- Jede genannte Kennung muss ein Amt **dieses** Vereins sein. Ohne diese
  -- Prüfung liesse sich ein Input an ein fremdes Gremium adressieren und wäre
  -- dort über die Policy lesbar.
  select count(*) into v_known
    from functionary_roles r
   where r.club_id = p_club_id
     and p_roles @> jsonb_build_array(r.id::text);
  if v_known <> jsonb_array_length(p_roles) then
    raise exception 'Unbekanntes Amt im Zielgremium';
  end if;

  -- Die Quelle muss ein eigenes Anliegen sein: Sonst liesse sich fremdes
  -- Gesagtes in ein Gremium tragen (BR-123).
  if p_source_note is not null then
    if not exists (select 1 from voice_notes n
                    where n.id = p_source_note
                      and n.club_id = p_club_id
                      and n.author_member_id = v_member) then
      raise exception 'Dieses Anliegen gehört dir nicht';
    end if;
  end if;

  if p_anonymous then
    if coalesce(trim(p_token_hash), '') = '' then
      raise exception 'Ohne Ticket kein anonymer Input';
    end if;
    insert into meeting_inputs
      (club_id, body, committee_role_ids, anon_token_hash, source_voice_note_id)
    values
      (p_club_id, v_text, p_roles, p_token_hash, p_source_note)
    returning id into v_input;
  else
    insert into meeting_inputs
      (club_id, body, committee_role_ids, author_member_id, source_voice_note_id)
    values
      (p_club_id, v_text, p_roles, v_member, p_source_note)
    returning id into v_input;
  end if;

  -- Schritt 6: an die **aktuellen** Amtsinhaber:innen.
  for v_person in select * from committee_members(p_club_id, p_roles) loop
    perform notify(v_person.user_id, 'input', 'Ein Input ist eingegangen',
                   null, '/tabs/profile/meeting', p_club_id);
  end loop;

  return v_input;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 7–8: zuordnen (FR-098) – und damit schon antworten (BR-134).
--
-- Ein Aufruf, zwei Ausgänge: mit Sitzung heisst «eingeplant», ohne Sitzung
-- «laufend». Zwei Funktionen wären zwei Wege zu demselben Entscheid.
-- ---------------------------------------------------------------------------
create or replace function public.assign_input(
  p_input_id uuid,
  p_meeting_event_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input meeting_inputs;
  v_event events;
begin
  select * into v_input from meeting_inputs where id = p_input_id;
  if not found then
    raise exception 'Input nicht gefunden';
  end if;

  if not can_handle_input(p_input_id) then
    raise exception 'Dieser Input ist nicht an dich gerichtet';
  end if;

  if v_input.status in ('answered','declined') then
    raise exception 'Dieser Input ist bereits abgeschlossen';
  end if;

  if p_meeting_event_id is not null then
    select * into v_event from events where id = p_meeting_event_id;
    if not found or v_event.club_id <> v_input.club_id then
      raise exception 'Sitzung nicht gefunden';
    end if;
    if v_event.type <> 'meeting' then
      raise exception 'Nur eine Sitzung nimmt Inputs auf';
    end if;

    update meeting_inputs
       set status = 'scheduled', meeting_event_id = p_meeting_event_id
     where id = p_input_id;
  else
    update meeting_inputs
       set status = 'in_progress', meeting_event_id = null
     where id = p_input_id;
  end if;

  -- BR-134: Der Status **ist** die Antwort – also wird er zugestellt. Ohne
  -- diese Zustellung wäre die Zuordnung eine Notiz für den Vorstand.
  if v_input.author_member_id is not null then
    perform notify(
      (select user_id from club_members where id = v_input.author_member_id),
      'input',
      case when p_meeting_event_id is null
        then 'Dein Input wird laufend bearbeitet'
        else 'Dein Input ist für eine Sitzung eingeplant'
      end,
      case when p_meeting_event_id is null then null else v_event.title end,
      '/tabs/profile/meeting', v_input.club_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A4: an das zuständige Gremium weiterleiten.
--
-- Der Input bleibt derselbe – nur sein Empfängerkreis ändert sich, und der
-- Statusverlauf bleibt erhalten. Ein neuer Input wäre ein zweiter Vorgang zu
-- derselben Sache.
-- ---------------------------------------------------------------------------
create or replace function public.forward_input(
  p_input_id uuid,
  p_roles    jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input  meeting_inputs;
  v_known  int;
  v_person record;
begin
  select * into v_input from meeting_inputs where id = p_input_id;
  if not found then
    raise exception 'Input nicht gefunden';
  end if;

  if not can_handle_input(p_input_id) then
    raise exception 'Dieser Input ist nicht an dich gerichtet';
  end if;

  if jsonb_typeof(p_roles) <> 'array' or jsonb_array_length(p_roles) = 0 then
    raise exception 'Wähle das Zielgremium';
  end if;

  select count(*) into v_known
    from functionary_roles r
   where r.club_id = v_input.club_id
     and p_roles @> jsonb_build_array(r.id::text);
  if v_known <> jsonb_array_length(p_roles) then
    raise exception 'Unbekanntes Amt im Zielgremium';
  end if;

  update meeting_inputs
     set committee_role_ids = p_roles,
         -- Die Weiterleitung setzt die Zuordnung zurück: Was das eine Gremium
         -- eingeplant hat, hat das andere nicht entschieden.
         status = 'open',
         meeting_event_id = null
   where id = p_input_id;

  for v_person in select * from committee_members(v_input.club_id, p_roles) loop
    perform notify(v_person.user_id, 'input', 'Ein Input wurde weitergeleitet',
                   null, '/tabs/profile/meeting', v_input.club_id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 9: die dokumentierte Antwort (FR-099 sinngemäss, §13.3).
--
-- Dieselbe Regel wie bei einem Anliegen: Ein Endstatus ohne Antwort ist das
-- Versanden, das ausgeschlossen sein soll.
-- ---------------------------------------------------------------------------
create or replace function public.answer_meeting_input(
  p_input_id uuid,
  p_answer   text,
  p_decline  boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input meeting_inputs;
  v_text  text;
begin
  select * into v_input from meeting_inputs where id = p_input_id for update;
  if not found then
    raise exception 'Input nicht gefunden';
  end if;

  if not can_handle_input(p_input_id) then
    raise exception 'Dieser Input ist nicht an dich gerichtet';
  end if;

  v_text := nullif(trim(p_answer), '');
  if v_text is null then
    raise exception 'Ohne Antwort kein Entscheid';
  end if;

  update meeting_inputs
     set decision_response = v_text,
         status = case when p_decline then 'declined' else 'answered' end,
         responded_at = now(),
         responded_by = current_member_id(v_input.club_id)
   where id = p_input_id;

  -- Bei anonymer Einreichung gibt es niemanden zu benachrichtigen; die Antwort
  -- wird über das Ticket abgeholt (A1).
  if v_input.author_member_id is not null then
    perform notify(
      (select user_id from club_members where id = v_input.author_member_id),
      'input', 'Dein Input wurde beantwortet', null,
      '/tabs/profile/meeting', v_input.club_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: der anonyme Statusverlauf.
--
-- Wie in `0047` fragt die Funktion nicht, wer ruft – sie prüft den Prüfwert des
-- Tickets. Zwei Verfahren für dieselbe Zusage wären zwei Angriffsflächen.
-- ---------------------------------------------------------------------------
create or replace function public.anon_input(p_token_hash text)
returns table (
  input_id   uuid,
  body       text,
  status     text,
  response   text,
  meeting_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id, i.body, i.status, i.decision_response, e.starts_at, i.created_at
    from meeting_inputs i
    left join events e on e.id = i.meeting_event_id
   where i.anon_token_hash = p_token_hash
     and coalesce(trim(p_token_hash), '') <> '';
$$;

-- ---------------------------------------------------------------------------
-- A2 und BR-135: die Sammelansicht.
--
-- Die Funktion gibt **genau drei** Arten zurück – Inputs, vakante Ämter, offene
-- Helfereinsätze. Dass sie nichts anderes kann, ist die Umsetzung von BR-132:
-- Es gibt keine Stelle, an der ein Traktandum entstehen könnte.
-- ---------------------------------------------------------------------------
create or replace function public.can_see_agenda(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from events e
     where e.id = p_event_id
       and e.type = 'meeting'
       and (is_club_admin(e.club_id)
            or holds_committee_role(e.club_id,
                 coalesce(e.audience_role_ids, '[]'::jsonb)))
  );
$$;

create or replace function public.meeting_agenda(p_event_id uuid)
returns table (
  kind   text,
  ref_id uuid,
  title  text,
  detail text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  v_club uuid;
begin
  select e.club_id into v_club from events e where e.id = p_event_id;
  if v_club is null then
    raise exception 'Sitzung nicht gefunden';
  end if;

  if not can_see_agenda(p_event_id) then
    raise exception 'Diese Sitzung ist nicht deine';
  end if;

  return query
    -- 1. Die zugeordneten offenen Inputs.
    select 'input'::text, i.id, left(i.body, 160), i.status
      from meeting_inputs i
     where i.meeting_event_id = p_event_id
       and i.status not in ('answered','declined')
     order by i.created_at;

  return query
    -- 2. Dauerthema: vakante Ämter. Vakant heisst hier schlicht «kein
    --    Inhaber» – eine Ausschreibung gibt es im MVP nicht.
    select 'vacancy'::text, r.id, r.title, null::text
      from functionary_roles r
     where r.club_id = v_club
       and r.holder_member_id is null
     order by r.title;

  return query
    -- 3. Dauerthema: offene Helfereinsätze. Dieselbe Rechnung wie im
    --    Vereins-Puls (`0044`) – eine zweite Definition von «offen» wäre eine
    --    zweite Wahrheit.
    select 'shift'::text, s.id, s.title, e.title
      from event_shifts s
      join events e on e.id = s.event_id
     where e.club_id = v_club
       and e.cancelled_at is null
       and not e.is_sample
       and s.starts_at > now()
       and s.needed > (select count(*) from attendance a
                        where a.shift_id = s.id
                          and a.status in ('registered','present'))
     order by s.starts_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-096: die Einladung geht an die Ämter.
--
-- `announce_event` benachrichtigte bisher den ganzen Verein bzw. das Team.
-- Für eine Sitzung mit gesetztem Empfängerkreis sind das die falschen Leute –
-- und `events.audience_role_ids` stand seit `0015` ungenutzt da.
-- ---------------------------------------------------------------------------
create or replace function public.announce_event(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_person record;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_trainer(v_event.club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand kündigen Termine an';
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return 0;
  end if;

  -- BR-133: Steht ein Empfängerkreis aus Ämtern, gilt er – aufgelöst über die
  -- **aktuellen** Inhaber:innen, nicht über eine gespeicherte Namensliste.
  if coalesce(jsonb_array_length(v_event.audience_role_ids), 0) > 0 then
    for v_person in
      select * from committee_members(v_event.club_id, v_event.audience_role_ids)
    loop
      perform notify(
        v_person.user_id, 'event', v_event.title,
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
        '/tabs/agenda', v_event.club_id);
      v_count := v_count + 1;
    end loop;
    return v_count;
  end if;

  for v_person in
    select distinct m.user_id
    from club_members m
    left join team_members tm on tm.member_id = m.id
    where m.club_id = v_event.club_id
      and m.status <> 'left'
      and m.user_id is not null
      and (v_event.team_id is null or tm.team_id = v_event.team_id)
  loop
    perform notify(
      v_person.user_id, 'event',
      v_event.title,
      to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda', v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- §13.3: Unbeantwortetes wird sichtbar – für Anliegen **und** Inputs.
--
-- `flag_unanswered_notes()` aus `0047` zählte nur Anliegen. Der Signaltyp
-- `inputs_unanswered` ist über den Index `(club_id, signal_type, member_id,
-- team_id)` aber **einer je Verein**: Zwei Quellen, die getrennt zählen, würden
-- sich gegenseitig das Signal wegnehmen und abwechselnd die falsche Zahl
-- schreiben. Deshalb zählt eine Funktion beides.
-- ---------------------------------------------------------------------------
create or replace function public.flag_unanswered_notes()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   record;
  v_days   int;
  v_input_days int;
  v_open   int;
  v_count  int := 0;
  v_signal uuid;
begin
  for v_club in select c.id, c.settings from clubs c loop
    -- Ohne dieses Zurücksetzen trüge `v_signal` den Wert des vorigen Vereins
    -- weiter: `on conflict do nothing` lässt die Variable unberührt, und der
    -- nächste Verein bekäme eine Zustellung zu einem fremden Signal.
    v_signal := null;
    v_days := coalesce(
      nullif(v_club.settings->'voice'->>'answerDays','')::int, 14);
    -- Ein Input darf auf eine Sitzung warten – deshalb die längere Frist.
    v_input_days := coalesce(
      nullif(v_club.settings->'meeting'->>'answerDays','')::int, 21);

    select
      (select count(*)
         from voice_notes n
        where n.club_id = v_club.id
          and n.kind in ('feedback','anonymous')
          and n.status in ('open','in_progress')
          and n.flagged_at is null
          -- Anonyme Anliegen tragen keinen Zeitstempel; die Kalenderwoche
          -- genügt, um «zu lange her» zu erkennen (BR-122 bleibt unangetastet).
          and coalesce(
                n.created_at,
                to_date(n.created_week, 'IYYY-"W"IW')::timestamptz
              ) < now() - make_interval(days => v_days))
      +
      (select count(*)
         from meeting_inputs i
        where i.club_id = v_club.id
          and i.status in ('open','scheduled','in_progress')
          and i.created_at < now() - make_interval(days => v_input_days))
    into v_open;

    if v_open = 0 then
      continue;
    end if;

    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'inputs_unanswered', 'attention', v_open::text)
    on conflict do nothing
    returning id into v_signal;

    if v_signal is not null then
      v_count := v_count + 1;
      perform notify_signal_owners(v_signal);
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte. Eine neue `security definer`-Funktion ist sofort ein offener
-- Endpunkt (CLAUDE.md).
-- ---------------------------------------------------------------------------
revoke execute on function public.holds_committee_role(uuid, jsonb) from public, anon;
grant  execute on function public.holds_committee_role(uuid, jsonb) to authenticated;

revoke execute on function public.can_handle_input(uuid) from public, anon;
grant  execute on function public.can_handle_input(uuid) to authenticated;

revoke execute on function public.committee_members(uuid, jsonb) from public, anon;
grant  execute on function public.committee_members(uuid, jsonb) to authenticated;

revoke execute on function public.submit_meeting_input(uuid, text, jsonb, boolean, text, uuid)
  from public, anon;
grant  execute on function public.submit_meeting_input(uuid, text, jsonb, boolean, text, uuid)
  to authenticated;

revoke execute on function public.assign_input(uuid, uuid) from public, anon;
grant  execute on function public.assign_input(uuid, uuid) to authenticated;

revoke execute on function public.forward_input(uuid, jsonb) from public, anon;
grant  execute on function public.forward_input(uuid, jsonb) to authenticated;

revoke execute on function public.answer_meeting_input(uuid, text, boolean) from public, anon;
grant  execute on function public.answer_meeting_input(uuid, text, boolean) to authenticated;

-- Der anonyme Rückweg fragt nicht nach der Anmeldung – `anon` braucht er
-- trotzdem nicht: Die App ist angemeldet, das Ticket ist der Ausweis.
revoke execute on function public.anon_input(text) from public, anon;
grant  execute on function public.anon_input(text) to authenticated;

revoke execute on function public.can_see_agenda(uuid) from public, anon;
grant  execute on function public.can_see_agenda(uuid) to authenticated;

revoke execute on function public.meeting_agenda(uuid) from public, anon;
grant  execute on function public.meeting_agenda(uuid) to authenticated;

-- Die Anmahnung läuft im Auftrag, nicht auf Zuruf.
revoke execute on function public.flag_unanswered_notes() from public, anon, authenticated;
