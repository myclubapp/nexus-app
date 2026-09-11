-- ============================================================================
-- 0055_pulse_sources: die dritte Quelle des Pulses und der Riegel am Modul
--
-- Nachtrag zu UC-027. Drei Dinge, die beim Bau des Pulses offen bleiben
-- mussten oder übersehen wurden:
--
-- 1. **Der Modul-Riegel fehlte.** UC-034 macht den Puls schaltbar und die
--    Oberfläche blendet den Weg aus – der wöchentliche Lauf legte aber weiter
--    für jeden Verein einen Entwurf an und benachrichtigte den ganzen Vorstand
--    über etwas, das er nicht öffnen kann.
--
-- 2. **Schritt 1 nennt drei Quellen, gebaut waren zwei.** Die «dokumentierten
--    Vorstandsantworten der letzten zwei Wochen» gab es beim Bau nicht.
--    Inzwischen gibt es sie zweimal: aus dem Anliegen (UC-030) und aus dem
--    Sitzungs-Input (UC-031).
--
-- 3. **FR-100 «Aus dem Vorstand» war halb gebaut.** Für Anliegen publizierte
--    der Client die News in einem zweiten Aufruf – schlug die Antwort danach
--    fehl, stand die News trotzdem im Feed. Für Sitzungs-Inputs gab es die
--    Möglichkeit gar nicht, obwohl `meeting_inputs.published_news_id` seit
--    `0049` dasteht und auf sie wartet.
--
-- **Die Grenze, die dieser Nachtrag zieht:** In den Puls darf nur, was der
-- Vorstand selbst veröffentlicht hat. Ein eingereichtes Anliegen gehört der
-- Person, die es geschrieben hat; es in eine Wochennachricht an alle zu heben,
-- wäre ein Bruch von BR-129 und von allem, wofür der anonyme Kanal steht.
-- Erkennbar ist das Veröffentlichte an einem einzigen Wert: `news.source`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- «Aus dem Vorstand» wird eine eigene Herkunft.
--
-- `publish_news()` kennt den Parameter seit `0043` und trägt dort sogar den
-- Kommentar, UC-030 müsse «nur diesen Wert setzen» – die Liste der erlaubten
-- Werte kannte ihn aber nicht. Eine News aus einer Vorstandsantwort lief
-- deshalb als gewöhnliche Vereinsnews.
-- ---------------------------------------------------------------------------
alter table news drop constraint if exists news_source_check;
alter table news add constraint news_source_check
  check (source in ('club','team','federation','website','board'));

alter table voice_notes add column if not exists published_news_id uuid
  references news(id) on delete set null;

create or replace function public.publish_news(
  p_title     text,
  p_body      text,
  p_club_id   uuid,
  p_team_id   uuid    default null,
  p_image_url text    default null,
  p_source    text    default 'club'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_news   uuid;
  v_person record;
begin
  if not is_club_trainer(p_club_id) then
    raise exception 'Nur Trainer:innen und der Vorstand schreiben News';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Eine News braucht einen Titel';
  end if;

  if p_team_id is not null
     and not exists (select 1 from teams where id = p_team_id and club_id = p_club_id) then
    raise exception 'Dieses Team gehört nicht zu diesem Verein';
  end if;

  insert into news (club_id, team_id, source, title, body, image_url)
  values (
    p_club_id, p_team_id,
    -- Seit `0055` steht `board` in der Liste: Eine News aus einer
    -- Vorstandsantwort trägt ihren Ursprung, und der Puls erkennt sie daran.
    case when p_source in ('club','team','federation','website','board') then p_source
         else 'club' end,
    trim(p_title), nullif(trim(p_body), ''), nullif(trim(p_image_url), '')
  )
  returning id into v_news;

  -- BR-110: Die Inbox erreicht alle, unabhängig von Push.
  -- BR-109: und nur den gewählten Geltungsbereich.
  for v_person in
    select distinct m.user_id
      from club_members m
      left join team_members tm on tm.member_id = m.id
     where m.club_id = p_club_id
       and m.status <> 'left'
       and m.user_id is not null
       and (p_team_id is null or tm.team_id = p_team_id)
  loop
    perform notify(
      v_person.user_id, 'news', trim(p_title),
      left(coalesce(nullif(trim(p_body), ''), ''), 160),
      '/tabs/dashboard', p_club_id
    );
  end loop;

  -- BR-111: Eine News ist eine Verbindung. Das ist der Eintrag, der die sanfte
  -- Sperre aus UC-011 wieder löst.
  perform log_club_message(p_club_id, 'connection', 'news:' || p_source);

  return v_news;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-100, jetzt in **einem** Schritt.
--
-- Der Titel kommt vom Client: Benutzertexte laufen über i18next, nicht über
-- deutsche Literale in der Datenbank (CLAUDE.md). Seine Anwesenheit **ist**
-- der Schalter – ein zusätzliches Kennzeichen wäre eine zweite Wahrheit.
--
-- Publiziert wird vor dem Endstatus und in derselben Transaktion: Scheitert
-- eines von beidem, ist nichts geschehen. Genau das war am Client nicht
-- möglich.
-- ---------------------------------------------------------------------------
drop function if exists public.answer_voice_note(uuid, text, boolean);

create or replace function public.answer_voice_note(
  p_note_id    uuid,
  p_answer     text,
  p_decline    boolean default false,
  p_news_title text    default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_note  voice_notes;
  v_text  text;
  v_user  uuid;
  v_news  uuid;
begin
  select * into v_note from voice_notes where id = p_note_id for update;
  if not found then
    raise exception 'Anliegen nicht gefunden';
  end if;

  if not can_handle_note(p_note_id) then
    raise exception 'Dieses Anliegen ist nicht an dich gerichtet';
  end if;

  v_text := nullif(trim(p_answer), '');
  if v_text is null then
    raise exception 'Zu einem Entscheid gehört seine Begründung';
  end if;

  -- Eine Ablehnung wird nicht publiziert: «Aus dem Vorstand» erzählt, was aus
  -- Vorschlägen wurde – ein Nein an eine einzelne Person ist keine Meldung an
  -- den Verein.
  if nullif(trim(coalesce(p_news_title, '')), '') is not null and not p_decline then
    v_news := publish_news(trim(p_news_title), v_text, v_note.club_id,
                           null, null, 'board');
  end if;

  update voice_notes
     set response = v_text,
         status = case when p_decline then 'declined' else 'answered' end,
         answered_at = now(),
         answered_by = current_member_id(v_note.club_id),
         published_news_id = coalesce(v_news, published_news_id)
   where id = p_note_id;

  insert into voice_note_messages (note_id, author_side, body)
  values (p_note_id, 'board', v_text);

  -- Schritt 7: zustellen – **ausser** bei anonym. Dort gibt es niemanden, dem
  -- man zustellen könnte, und genau das ist die Absicht (BR-129). Die Antwort
  -- wird abgeholt.
  if v_note.kind = 'feedback' and v_note.author_member_id is not null then
    select user_id into v_user from club_members where id = v_note.author_member_id;
    if v_user is not null then
      perform notify(
        v_user, 'input', 'Auf dein Anliegen gibt es eine Antwort',
        null, '/tabs/profile/voice', v_note.club_id
      );
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dasselbe für den Sitzungs-Input.
--
-- `published_news_id` steht seit `0049` in der Tabelle und wurde von niemandem
-- geschrieben. Ab hier hat die Spalte ihren Schreiber.
-- ---------------------------------------------------------------------------
drop function if exists public.answer_meeting_input(uuid, text, boolean);

create or replace function public.answer_meeting_input(
  p_input_id   uuid,
  p_answer     text,
  p_decline    boolean default false,
  p_news_title text    default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_input meeting_inputs;
  v_text  text;
  v_news  uuid;
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

  if nullif(trim(coalesce(p_news_title, '')), '') is not null and not p_decline then
    v_news := publish_news(trim(p_news_title), v_text, v_input.club_id,
                           null, null, 'board');
  end if;

  update meeting_inputs
     set decision_response = v_text,
         status = case when p_decline then 'declined' else 'answered' end,
         responded_at = now(),
         responded_by = current_member_id(v_input.club_id),
         published_news_id = coalesce(v_news, published_news_id)
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
-- Schritt 1, nun mit allen drei Quellen – und mit dem Riegel am Modul.
-- ---------------------------------------------------------------------------
create or replace function public.compose_club_pulse(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club     record;
  v_happening jsonb;
  v_decisions jsonb;
  v_working  jsonb;
  v_join     jsonb;
  v_pulse    uuid;
  v_person   record;
  v_count    int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    -- UC-034: Ohne das Modul entsteht nichts. Ein Entwurf für einen Verein,
    -- der den Puls abgeschaltet hat, wäre eine Benachrichtigung über eine
    -- Seite, die niemand öffnen kann.
    if not module_enabled(v_club.id, 'pulse') then
      continue;
    end if;

    -- Ein offener Entwurf genügt; der nächste Lauf überschreibt ihn nicht.
    if exists (select 1 from club_pulses
                where club_id = v_club.id and status = 'draft') then
      continue;
    end if;

    -- «Was passiert»: die Termine der kommenden vierzehn Tage.
    select coalesce(jsonb_agg(item order by item->>'at'), '[]'::jsonb)
      into v_happening
      from (
        select jsonb_build_object(
                 'kind', 'event', 'id', e.id, 'title', e.title,
                 'at', e.starts_at, 'detail', e.type) as item
          from events e
         where e.club_id = v_club.id
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at between now() and now() + interval '14 days'
         order by e.starts_at
         limit 8
      ) x;

    -- «Woran wir arbeiten»: die dokumentierten Vorstandsantworten der letzten
    -- zwei Wochen, dann die laufenden Aufgaben.
    --
    -- **Nur publizierte Antworten** (`source = 'board'`). Das eingereichte
    -- Anliegen selbst steht nirgends – es gehört der Person, die es
    -- geschrieben hat. Die Antwort steht hier, weil der Vorstand sie mit
    -- «Aus dem Vorstand» ausdrücklich an den ganzen Verein gerichtet hat.
    --
    -- Zwei Abfragen statt einer Vereinigung: Jede Quelle hat ihre eigene
    -- Reihenfolge – Antworten die jüngste zuerst, Aufgaben die dringendste –
    -- und ein gemeinsames `limit` schnitte die eine zugunsten der anderen weg.
    select coalesce(jsonb_agg(item order by at desc), '[]'::jsonb)
      into v_decisions
      from (
        select jsonb_build_object(
                 'kind', 'decision', 'id', n.id, 'title', n.title,
                 'at', n.published_at, 'detail', null) as item,
               n.published_at as at
          from news n
         where n.club_id = v_club.id
           and n.source = 'board'
           and not n.is_sample
           and n.published_at > now() - interval '14 days'
         order by n.published_at desc
         limit 4
      ) x;

    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_working
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item
          from tasks t
         where t.club_id = v_club.id
           and t.status in ('claimed','submitted')
           and not t.is_sample
         order by t.due_at nulls last
         limit 6
      ) x;

    -- BR-113 gilt innerhalb des Abschnitts genauso: Was der Vorstand
    -- beantwortet hat, steht vor dem, was noch läuft.
    v_working := v_decisions || v_working;

    -- «Wo du dabei sein kannst»: offene Aufgaben und unterbesetzte Schichten.
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_join
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item,
               t.due_at as at
          from tasks t
         where t.club_id = v_club.id
           and t.status = 'open'
           and not t.is_sample
           and t.max_assignees > (select count(*) from task_assignments a
                                   where a.task_id = t.id)
        union all
        select jsonb_build_object(
                 'kind', 'shift', 'id', s.id, 'title', s.title,
                 'at', s.starts_at, 'detail', e.title) as item,
               s.starts_at as at
          from event_shifts s
          join events e on e.id = s.event_id
         where e.club_id = v_club.id
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and s.starts_at > now()
           and s.needed > (select count(*) from attendance a
                            where a.shift_id = s.id
                              and a.status in ('registered','present'))
         order by at nulls last
         limit 8
      ) x;

    -- A3: nichts zu berichten.
    if jsonb_array_length(v_happening) = 0
       and jsonb_array_length(v_working) = 0
       and jsonb_array_length(v_join) = 0 then
      continue;
    end if;

    insert into club_pulses (club_id, happening, working_on, join_in)
    values (v_club.id, v_happening, v_working, v_join)
    returning id into v_pulse;

    v_count := v_count + 1;

    -- Schritt 2: Der Vorstand erfährt, dass etwas bereitliegt.
    for v_person in
      select m.user_id from club_members m
       where m.club_id = v_club.id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'pulse', 'Der Vereins-Puls liegt bereit',
        null, '/tabs/profile/pulse', v_club.id
      );
    end loop;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: derselbe Riegel.
--
-- Wer das Modul abschaltet, während ein Entwurf offen liegt, will keinen
-- automatischen Versand mehr. Der Entwurf bleibt liegen; schaltet der Verein
-- den Puls wieder ein, steht er noch da.
-- ---------------------------------------------------------------------------
create or replace function public.auto_release_pulses()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pulse record;
  v_count int := 0;
begin
  for v_pulse in
    select p.id, p.club_id
      from club_pulses p
      join clubs c on c.id = p.club_id
     where p.status = 'draft'
       and p.composed_at < now() - interval '48 hours'
       and coalesce((c.settings->'pulse'->>'autoRelease')::boolean, false)
       and module_enabled(p.club_id, 'pulse')
  loop
    begin
      -- Der automatische Versand hat keine bestätigende Person; freigegeben
      -- wird der Entwurf, wie er ist.
      update club_pulses
         set status = 'sent', sent_at = now()
       where id = v_pulse.id;

      perform notify(m.user_id, 'pulse', 'Der Vereins-Puls',
        'Was passiert, woran wir arbeiten, wo du dabei sein kannst.',
        '/tabs/pulse/' || v_pulse.id, v_pulse.club_id)
        from club_members m
       where m.club_id = v_pulse.club_id
         and m.status <> 'left' and m.user_id is not null;

      perform log_club_message(v_pulse.club_id, 'connection', 'pulse');
      v_count := v_count + 1;
    exception when others then
      raise warning 'Puls % konnte nicht versendet werden: %', v_pulse.id, sqlerrm;
    end;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
--
-- Die beiden Antwortfunktionen haben eine neue Signatur; die alte ist
-- weggefallen und mit ihr ihr Grant.
-- ---------------------------------------------------------------------------
revoke execute on function public.answer_voice_note(uuid, text, boolean, text)
  from public, anon;
grant  execute on function public.answer_voice_note(uuid, text, boolean, text)
  to authenticated;

revoke execute on function public.answer_meeting_input(uuid, text, boolean, text)
  from public, anon;
grant  execute on function public.answer_meeting_input(uuid, text, boolean, text)
  to authenticated;

revoke execute on function public.compose_club_pulse(uuid) from public, anon, authenticated;
revoke execute on function public.auto_release_pulses() from public, anon, authenticated;
revoke execute on function public.publish_news(text, text, uuid, uuid, text, text)
  from public, anon;
grant  execute on function public.publish_news(text, text, uuid, uuid, text, text)
  to authenticated;
