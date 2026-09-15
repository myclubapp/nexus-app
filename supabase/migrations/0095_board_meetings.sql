-- ============================================================================
-- 0095_board_meetings: Die Sitzung gehört ihrem Gremium (FR-095, FR-096)
--
-- `events.audience_role_ids` steht seit `0015` in der Tabelle und wird seit
-- `0049` beim Ankündigen gelesen – geschrieben hat es nie jemand. Damit lief
-- die Sitzungs-Anbindung leer: Die Einladung zur Vorstandssitzung ging an den
-- ganzen Verein, die Sammelansicht sah nur admin/superadmin, und im
-- Terminformular stand statt des Gremiums der Team-Geltungsbereich.
--
-- Diese Migration macht aus dem Feld eine Regel. **Eine Sitzung ist ein
-- Gremiumstermin**: kein Team, immer ein Empfängerkreis aus Ämtern. Was ein
-- Team miteinander bespricht, ist ein Termin dieses Teams und heisst nicht
-- Sitzung (MVP §13.1, revidiert).
--
-- Dazu kommt die Stelle, an der das bisher auseinanderlief: Der **Kreis eines
-- Termins** – wer eingeladen, erinnert und über die Absage informiert wird –
-- war in vier Funktionen viermal ausgeschrieben. Drei davon kannten nur Team
-- und Verein. Ab hier steht er einmal in `event_audience()`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Das Vorstandsamt.
--
-- BR-133 bleibt: Ein Gremium ist kein eigenes Objekt, sondern eine Menge
-- Ämter. «Vorstand» ist deshalb keine zusätzliche Entität, sondern ein
-- Merkmal am Amt – die Menge der Ämter, die den Verein führen. Damit bekommt
-- das Sitzungsformular eine Voreinstellung, die niemand pflegen muss, und der
-- Verteiler «Vorstand» eine Definition, die nicht auf `club_members.role`
-- ausweicht: Wer im Vorstand **sitzt**, hält ein Vorstandsamt.
-- ---------------------------------------------------------------------------
alter table functionary_roles
  add column if not exists is_board boolean not null default false;

comment on column functionary_roles.is_board is
  'Gehört dieses Amt zum Vorstand? Die Menge dieser Ämter ist der Verteiler '
  '«Vorstand» und die Voreinstellung des Empfängerkreises einer Sitzung '
  '(BR-133, BR-237).';

-- Ein erster Vorschlag aus der Bezeichnung – nichts weiter. Ein Verein, der
-- seinen Vorstand anders schneidet, korrigiert ihn in der Ämter-Verwaltung;
-- deshalb setzt der Abgleich nur, wo noch nichts gesetzt ist, und nimmt
-- niemandem das Merkmal wieder weg.
update functionary_roles
   set is_board = true
 where is_board = false
   and (
        lower(title) like '%präsident%'
     or lower(title) like '%presid%'
     or lower(title) like '%kassier%'
     or lower(title) like '%finanz%'
     or lower(title) like '%aktuar%'
     or lower(title) like '%sportchef%'
     or lower(title) like '%marketing%'
     or lower(title) like '%sponsor%'
     or lower(title) like '%event%'
   );

-- ---------------------------------------------------------------------------
-- 2. Der Verteiler «Vorstand».
--
-- Eine Auskunft, kein Zustand: Die Liste entsteht bei jedem Aufruf aus den
-- Ämtern. Eine zweite, gespeicherte Liste wäre genau die Namensliste, die
-- BR-133 vermeidet – nur eine Stufe höher.
-- ---------------------------------------------------------------------------
create or replace function public.board_role_ids(p_club_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(r.id::text order by r.title), '[]'::jsonb)
    from functionary_roles r
   where r.club_id = p_club_id
     and r.is_board;
$$;

comment on function public.board_role_ids(uuid) is
  'Die Ämter des Vorstands als jsonb-Liste von Kennungen – der Empfängerkreis '
  'einer Vorstandssitzung (BR-237).';

-- ---------------------------------------------------------------------------
-- 3. Das Gremium löst über **alle** Sitze auf, nicht nur über den Spiegel.
--
-- `committee_members()` aus `0049` las `functionary_roles.holder_member_id`.
-- Seit `0070` ist das nur noch die **erste** verknüpfte Inhaber:in eines
-- Amtes (BR-185); die übrigen Sitze stehen in `functionary_holders`. Ein
-- Co-Präsidium bekam damit eine Einladung statt zwei.
--
-- Der Spiegel bleibt als zweiter Zweig stehen: Ein Amt, das noch keine
-- Sitzzeile hat, fällt sonst aus dem Verteiler. `union` entfernt die
-- Doppelten.
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
  select m.id, m.user_id
    from functionary_roles r
    join functionary_holders h on h.role_id = r.id
    join club_members m on m.id = h.member_id
   where r.club_id = p_club_id
     and p_roles @> jsonb_build_array(r.id::text)
     and m.status <> 'left'
     and m.user_id is not null
  union
  select m.id, m.user_id
    from functionary_roles r
    join club_members m on m.id = r.holder_member_id
   where r.club_id = p_club_id
     and p_roles @> jsonb_build_array(r.id::text)
     and m.status <> 'left'
     and m.user_id is not null;
$$;

-- «Halte ich eines dieser Ämter?» beantwortet ab hier dieselbe Auflösung.
-- Sonst bekäme die zweite Inhaber:in eines Amtes zwar die Einladung, sähe die
-- Sitzung aber nicht: `holds_committee_role()` las ebenfalls nur den Spiegel,
-- und seit Abschnitt 6 hängt die Sichtbarkeit eines Gremiumstermins daran.
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
      from committee_members(p_club_id, p_roles) c
     where c.member_id = current_member_id(p_club_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. Sitzung = Gremiumstermin.
--
-- Die Regel steht als `check` an der Tabelle und nicht im Formular: Ein
-- Termin, der über die Policy direkt eingefügt wird, umginge das Formular –
-- und eine Sitzung ohne Gremium ist genau der Zustand, aus dem die stille
-- Einladung an den ganzen Verein entsteht.
--
-- Zuerst bekommen die bestehenden Sitzungen ihr Gremium, dann wird geprüft.
-- ---------------------------------------------------------------------------
update events e
   set audience_role_ids = board_role_ids(e.club_id)
 where e.type = 'meeting'
   and coalesce(jsonb_array_length(e.audience_role_ids), 0) = 0
   and jsonb_array_length(board_role_ids(e.club_id)) > 0;

-- Eine Sitzung, die an einem Team hing, ist ab hier ein Gremiumstermin; das
-- Team war ohnehin nie der Empfängerkreis, sondern nur ein Filter davor.
update events
   set team_id = null
 where type = 'meeting'
   and team_id is not null;

alter table events drop constraint if exists events_meeting_committee_check;
alter table events add constraint events_meeting_committee_check
  check (
    type <> 'meeting'
    or (team_id is null
        and coalesce(jsonb_array_length(audience_role_ids), 0) > 0)
  )
  -- `not valid`, damit die Migration nicht an einer Altzeile scheitert, deren
  -- Verein noch kein Vorstandsamt führt. Geprüft wird ab sofort trotzdem –
  -- `not valid` betrifft nur den Bestand, nicht neue Zeilen.
  not valid;

-- Ist der Bestand sauber, gilt die Regel auch rückwirkend. So bleibt kein
-- «not valid» stehen, das später niemand mehr nachzieht.
do $$
begin
  if not exists (
    select 1 from events
     where type = 'meeting'
       and (team_id is not null
            or coalesce(jsonb_array_length(audience_role_ids), 0) = 0)
  ) then
    execute 'alter table events validate constraint events_meeting_committee_check';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Der Kreis eines Termins – **eine** Definition.
--
-- Bisher stand er viermal da: in `announce_event` (mit Gremium),
-- `cancel_event`, `count_undecided` und `remind_undecided_internal` (alle
-- drei ohne). Eine Sitzung wurde damit dem Gremium angekündigt, aber dem
-- ganzen Verein abgesagt und dem ganzen Verein nachgefragt.
--
-- Die Reihenfolge der Zweige ist die Reichweite von eng nach weit: Gremium
-- vor Team vor Verein. Wer ein Konto hat, zählt – wer keines hat, ist nicht
-- erreichbar und darf deshalb auch nicht als «noch offen» gelten (BR-059).
-- ---------------------------------------------------------------------------
create or replace function public.event_audience(p_event_id uuid)
returns table (member_id uuid, user_id uuid)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct m.id, m.user_id
    from events e
    join club_members m on m.club_id = e.club_id
   where e.id = p_event_id
     and m.status <> 'left'
     and m.user_id is not null
     and case
           when coalesce(jsonb_array_length(e.audience_role_ids), 0) > 0 then
             exists (select 1
                       from committee_members(e.club_id, e.audience_role_ids) c
                      where c.member_id = m.id)
           when e.team_id is not null then
             exists (select 1 from team_members tm
                      where tm.member_id = m.id
                        and tm.team_id = e.team_id)
           else true
         end;
$$;

comment on function public.event_audience(uuid) is
  'Wer zu diesem Termin gehört: das Gremium, sonst das Team, sonst der Verein '
  '(BR-238). Einzige Definition für Ankündigung, Absage und Erinnerung.';

-- ---------------------------------------------------------------------------
-- 6. Wer die Sitzung sieht.
--
-- `event_in_scope()` kannte bisher Team und Verein. Eine Vorstandssitzung ist
-- ein Vereinstermin ohne Team – und stand damit in der Agenda **jedes**
-- Mitglieds. Der neue Zweig kommt zuerst: Steht ein Gremium, gehört der
-- Termin ihm.
--
-- Geprüft wird mit `is_club_admin` und nicht mit `is_club_board`, damit hier
-- dasselbe gilt wie in `can_see_agenda()` (`0049`): Wer die Sitzung sieht,
-- sieht auch ihre Sammelansicht. Zwei Prüfungen wären zwei Reichweiten.
-- ---------------------------------------------------------------------------
create or replace function public.event_in_scope(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from events e
     where e.id = p_event_id
       and is_club_member(e.club_id)
       and case
             -- Ein Termin mit Gremium gehört dem Gremium.
             when coalesce(jsonb_array_length(e.audience_role_ids), 0) > 0 then
               is_club_admin(e.club_id)
               or holds_committee_role(e.club_id, e.audience_role_ids)
             -- Ein Vereinstermin gilt allen.
             when e.team_id is null then true
             -- Der Vorstand sieht den ganzen Vereinskalender.
             when is_club_board(e.club_id) then true
             -- Alle anderen – Trainer:innen eingeschlossen – ihre Teams.
             else exists (
               select 1 from team_members tm
                where tm.team_id = e.team_id
                  and tm.member_id = current_member_id(e.club_id)
             )
           end
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Ankündigen, Absagen, Erinnern – alle über denselben Kreis.
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

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand kündigen Termine an';
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return 0;
  end if;

  -- BR-133: Steht ein Empfängerkreis aus Ämtern, gilt er – aufgelöst über die
  -- **aktuellen** Inhaber:innen, nicht über eine gespeicherte Namensliste.
  -- Das entscheidet jetzt `event_audience()` für alle drei Zustellwege.
  for v_person in select * from event_audience(p_event_id) loop
    perform notify(
      v_person.user_id, 'event',
      v_event.title,
      to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda?event=' || p_event_id, v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

create or replace function public.cancel_event(
  p_event_id uuid,
  p_reason   text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_reason text;
  v_person record;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand sagen Termine ab';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null then
    raise exception 'Eine Absage braucht einen Grund';
  end if;

  if v_event.cancelled_at is not null then
    -- Zweimal absagen ändert nichts und benachrichtigt niemanden erneut.
    return;
  end if;

  update events
     set cancelled_at = now(), cancelled_reason = v_reason
   where id = p_event_id;

  -- Der Grund erreicht alle Betroffenen, nicht nur die Zugesagten – bei einer
  -- Sitzung also das Gremium und nicht den Verein.
  for v_person in select * from event_audience(p_event_id) loop
    perform notify(
      v_person.user_id, 'event',
      'Abgesagt: ' || v_event.title,
      v_reason, '/tabs/agenda?event=' || p_event_id, v_event.club_id,
      true
    );
  end loop;
end;
$$;

create or replace function public.count_undecided(p_event_id uuid)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_event events;
  v_count int;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  if not is_club_member(v_event.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  select count(*)::int into v_count
    from event_audience(p_event_id) a
   where not exists (
     select 1 from attendance att
      where att.event_id = p_event_id
        and att.member_id = a.member_id
        and att.shift_id is null
   );

  return v_count;
end;
$$;

create or replace function public.remind_undecided_internal(p_event_id uuid)
returns table (notified int, last_reminder timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_person record;
  v_count  int := 0;
begin
  select * into v_event from events where id = p_event_id for update;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;

  -- Die Wächter stehen hier und nicht beim Aufrufer: Der Cron-Lauf filtert
  -- zwar auch, aber eine Regel, die von der `where`-Klausel ihres Aufrufers
  -- abhängt, gilt beim zweiten Aufrufer nicht mehr.
  if v_event.published_at is null then
    raise exception 'Dieser Termin ist noch nicht ausgeschrieben';
  end if;

  if v_event.cancelled_at is not null then
    raise exception 'Dieser Termin wurde abgesagt';
  end if;

  if v_event.starts_at <= now() then
    raise exception 'Der Termin hat begonnen';
  end if;

  -- A1 und BR-060: höchstens alle 24 Stunden.
  if v_event.reminded_at is not null
     and now() - v_event.reminded_at < interval '24 hours' then
    return query select 0, v_event.reminded_at;
    return;
  end if;

  -- Beispielinhalte lösen keine Zustellung aus (BR-161).
  if v_event.is_sample then
    return query select 0, null::timestamptz;
    return;
  end if;

  -- BR-059: ausschliesslich Mitglieder ohne Antwort auf den **Termin**. Eine
  -- übernommene Schicht ist keine Zusage zum Anlass – sie sagt, dass jemand
  -- hilft, nicht, dass er kommt. Wer gefragt wird, sagt `event_audience()`.
  for v_person in
    select * from event_audience(p_event_id) a
     where not exists (
       select 1 from attendance att
        where att.event_id = p_event_id
          and att.member_id = a.member_id
          and att.shift_id is null
     )
  loop
    -- BR-062: Der Weg führt direkt zur Antwort, nicht in eine Suche.
    perform notify(
      v_person.user_id,
      'event',
      'Kommst du?',
      v_event.title || ' – ' ||
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
      '/tabs/agenda?event=' || p_event_id,
      v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  -- A2: War niemand offen, gilt der Termin nicht als erinnert – sonst
  -- verbrauchte ein wirkungsloser Aufruf die Frist für einen wirksamen.
  if v_count = 0 then
    return query select 0, null::timestamptz;
    return;
  end if;

  update events set reminded_at = now() where id = p_event_id;

  return query select v_count, now();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Das Merkmal am Amt geht durch `save_office()`.
--
-- Als zusätzlicher Parameter mit Vorgabewert `null` = «unverändert». Ein
-- Vorgabewert `false` würde das Merkmal bei jedem Speichern aus einem
-- Formular löschen, das den Parameter nicht kennt – derselbe Grund, aus dem
-- `0091` den Punktwert in eine eigene Funktion gelegt hat.
--
-- Die alte Signatur muss weg: Ein zusätzlicher Parameter erzeugt eine zweite
-- Funktion, und PostgREST kann zwischen beiden nicht wählen.
-- ---------------------------------------------------------------------------
drop function if exists public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb
);

create or replace function public.save_office(
  p_club_id           uuid,
  p_title             text,
  p_id                uuid    default null,
  p_why               text    default null,
  p_duties            jsonb   default '[]'::jsonb,
  p_hours_per_season  text    default null,
  p_points_label      text    default null,
  p_max_holders       int     default 1,
  p_contact_member_id uuid    default null,
  p_contact_name      text    default null,
  p_holders           jsonb   default '[]'::jsonb,
  p_is_board          boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_holder jsonb;
  v_keep   uuid[] := '{}';
  v_hid    uuid;
  v_member uuid;
  v_name   text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand pflegt die Ämter';
  end if;

  if length(trim(coalesce(p_title, ''))) not between 2 and 80 then
    raise exception 'Ein Amt braucht seine Bezeichnung';
  end if;
  if jsonb_typeof(coalesce(p_duties, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_holders, '[]'::jsonb)) <> 'array' then
    raise exception 'Pflichten und Belegung sind Listen';
  end if;
  if coalesce(p_max_holders, 1) not between 1 and 50 then
    raise exception 'Ein Amt hat zwischen 1 und 50 Sitzen';
  end if;
  if p_contact_member_id is not null and not exists (
       select 1 from club_members m
        where m.id = p_contact_member_id and m.club_id = p_club_id) then
    raise exception 'Die Ansprechperson ist nicht Mitglied dieses Vereins';
  end if;

  if p_id is null then
    insert into functionary_roles (
      club_id, title, why, duties, hours_per_season, points_label,
      max_holders, contact_member_id, contact_name, is_board
    )
    values (
      p_club_id, trim(p_title), nullif(trim(p_why), ''), coalesce(p_duties, '[]'::jsonb),
      nullif(trim(p_hours_per_season), ''), nullif(trim(p_points_label), ''),
      coalesce(p_max_holders, 1), p_contact_member_id, nullif(trim(p_contact_name), ''),
      coalesce(p_is_board, false)
    )
    returning id into v_id;
  else
    update functionary_roles
       set title             = trim(p_title),
           why               = nullif(trim(p_why), ''),
           duties            = coalesce(p_duties, '[]'::jsonb),
           hours_per_season  = nullif(trim(p_hours_per_season), ''),
           points_label      = nullif(trim(p_points_label), ''),
           max_holders       = coalesce(p_max_holders, 1),
           contact_member_id = p_contact_member_id,
           contact_name      = nullif(trim(p_contact_name), ''),
           is_board          = coalesce(p_is_board, is_board)
     where id = p_id and club_id = p_club_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Dieses Amt gibt es nicht';
    end if;
  end if;

  for v_holder in select * from jsonb_array_elements(coalesce(p_holders, '[]'::jsonb)) loop
    v_name   := trim(coalesce(v_holder->>'display_name', ''));
    v_member := nullif(v_holder->>'member_id', '')::uuid;
    if v_member is not null then
      if not exists (select 1 from club_members m
                      where m.id = v_member and m.club_id = p_club_id) then
        raise exception 'Diese Person ist nicht Mitglied dieses Vereins';
      end if;
      -- Der Name folgt dem Mitglied und nicht der Eingabe: Wer verknüpft ist,
      -- heisst im Organigramm so wie im Verzeichnis.
      select display_name into v_name from club_members where id = v_member;
    end if;
    if v_name = '' then
      raise exception 'Ein Sitz braucht seinen Namen';
    end if;

    v_hid := nullif(v_holder->>'id', '')::uuid;
    if v_hid is null then
      insert into functionary_holders (role_id, member_id, display_name, interim)
      values (v_id, v_member, v_name, coalesce((v_holder->>'interim')::boolean, false))
      returning id into v_hid;
    else
      update functionary_holders
         set member_id    = v_member,
             display_name = v_name,
             interim      = coalesce((v_holder->>'interim')::boolean, false)
       where id = v_hid and role_id = v_id;
    end if;
    v_keep := v_keep || v_hid;
  end loop;

  -- Was nicht mehr in der Liste steht, ist aufgelöst.
  delete from functionary_holders
   where role_id = v_id and not (id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb, boolean
) from public, anon;
grant execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb, boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Rechte.
--
-- `event_audience()` ist eine interne Routine: Sie beantwortet, wer
-- benachrichtigt wird, und ihre Antwort steht keiner Ansicht zu. Ohne
-- `revoke` hinge sie unter `/rest/v1/rpc/` und gäbe die Mitgliederliste
-- jedes Termins an jede angemeldete Person aus (CLAUDE.md, `0007`).
--
-- `board_role_ids()` darf jede:r abrufen: Wer im Verein ist, sieht die Ämter
-- ohnehin – die Funktion sagt nichts, was nicht schon in der Tabelle steht.
-- ---------------------------------------------------------------------------
revoke execute on function public.event_audience(uuid) from public, anon, authenticated;

revoke execute on function public.board_role_ids(uuid) from public, anon;
grant  execute on function public.board_role_ids(uuid) to authenticated;
