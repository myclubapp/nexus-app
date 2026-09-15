-- ============================================================================
-- 0103_rules_office_credit_and_planned: Damit die Punkte ankommen
--
-- Die Prüfung am 15.09.2026 an der laufenden Datenbank hat drei Lücken
-- gezeigt, die zusammen dazu führen, dass ein Verein mit 177 aktiven
-- Mitgliedern, 25 besetzten Ämtern und 211 Schichtplätzen **sieben**
-- Buchungen im Ledger hat – alle sieben `decline_early`:
--
--   1. **Die Termine tragen keine Regel.** 330 von 336 Terminen haben
--      `point_rule_code is null`. Weder `upsert_legacy_event()` (0091) noch
--      `upsert_federation_game()` (0076) setzen die Spalte – die Übernahme aus
--      der bisherigen App und der Verbandsabgleich legen also Trainings und
--      Spiele an, an denen `check_in()` nichts zu buchen findet. Wer scannt,
--      bekommt null und erfährt nicht, warum.
--   2. **Die Amtsgutschrift hat keinen Auslöser.** `confirm_office_term()` und
--      `confirm_office_period()` stehen seit `0091` in der Datenbank, aber
--      niemand ruft sie: kein Knopf, kein Cron, keine Function.
--      `functionary_terms` ist leer, obwohl 21 Sitze verknüpft sind und einen
--      Wert tragen. Eine Mechanik ohne Auslöser ist keine Mechanik.
--   3. **Das Zugesagte ist unsichtbar.** Die Zielkarte zeigt das Gebuchte und
--      darunter Vorschläge – also das, was jemand **nicht** zugesagt hat.
--      Dazwischen fehlt, was bereits eingeplant ist: die angemeldete Schicht,
--      die übernommene Aufgabe, das laufende Amt. Wer im November drei
--      Schichten im Kalender hat, steht heute auf null und weiss nicht, dass
--      sein Beitrag längst steht.
--
-- Vier Teile:
--   1. Die Punkteregel folgt dem Termintyp (BR-263)
--   2. Die Amtsgutschrift läuft von selbst (BR-264)
--   3. Eingeplante Punkte (FR-198, BR-265/BR-266)
--   4. Rechte
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Die Punkteregel folgt dem Termintyp (BR-263).
--
-- **Gegenstück zu `RULE_BY_TYPE` in `app/src/lib/eventSeries.ts`** – dieselbe
-- Gefahr wie bei `season_label()`/`seasonLabel()`: Laufen die beiden
-- auseinander, schlägt das Formular etwas anderes vor, als die Übernahme
-- einträgt. Wer die eine Tabelle ändert, ändert die andere mit.
--
-- **Mit einer Abweichung, und die ist Absicht: `helper` bleibt hier leer.**
-- Im Formular schlägt die App bei einem Helferanlass `shift_done` vor, und
-- `check_in()` bucht die Regel des Termins mit dem **Termin** als Quelle,
-- während `confirm_shift()` (0028) dieselbe Regel mit der **Schicht** als
-- Quelle bucht. Der Dedupe-Index läuft über `(member_id, rule_code,
-- source_id)` und hält die beiden deshalb nicht auseinander: Wer an einem
-- Helferanlass scannt *und* dessen Schicht bestätigt bekommt, bekäme den
-- Einsatz zweimal. Für 17 übernommene Helferanlässe mit ihren Schichten wäre
-- das ein doppelter Ledger. Der Beitrag eines Helferanlasses ist die Schicht –
-- so sieht es auch `next_contributions()`, das Helferanlässe ausdrücklich
-- übergeht. `meeting` bleibt aus demselben Grund leer wie im Formular: Eine
-- Sitzung ist Arbeit des Gremiums, kein Beitrag mit Punktwert.
--
-- Die Funktion gibt nur zurück, was der Verein auch **hat**: Ein Verein, der
-- `match_attend` gelöscht oder abgeschaltet hat, bekommt keine Regel
-- untergeschoben.
-- ---------------------------------------------------------------------------
create or replace function public.event_rule_code(p_club_id uuid, p_type text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.code
    from point_rules r
   where r.club_id = p_club_id
     and r.is_active
     and r.code = case p_type
                    when 'training' then 'training_attend'
                    when 'match'    then 'match_attend'
                    when 'gv'       then 'assembly_attend'
                    when 'social'   then 'event_attend'
                  end;
$$;

comment on function public.event_rule_code(uuid, text) is
  'BR-263: Punkteregel zum Termintyp – Gegenstück zu RULE_BY_TYPE in app/src/lib/eventSeries.ts.';

-- Den Bestand nachziehen. **Nur wo nichts steht**: Ein Termin, dem der
-- Vorstand bewusst eine andere Regel gegeben hat, behält sie. Ein Termin ohne
-- Regel ist hier dagegen der Normalfall – 330 von 336 –, und ohne Regel bleibt
-- der Kalender punktlos.
--
-- **Keine Rücksicht auf vorhandene Buchungen, und das ist kein Verstoss gegen
-- BR-052.** Der erste Entwurf schloss Termine aus, an denen schon eine
-- `attendance`-Buchung hing; die Probe zeigte, dass das fünf Termine traf –
-- allesamt mit `decline_early`, also **Absagen**. Eine Absage ist keine
-- Bewertung der Teilnahme. Und eine Teilnahme-Buchung *aus der Terminregel*
-- kann es hier gar nicht geben: Die Regel ist ja leer, `check_in()` hatte
-- nichts zu buchen. Der Nachtrag bewertet deshalb nichts um – er entscheidet
-- allein, was beim **nächsten** Scan gebucht wird.
update events e
   set point_rule_code = event_rule_code(e.club_id, e.type)
 where e.point_rule_code is null
   and event_rule_code(e.club_id, e.type) is not null;

-- Die Übernahme aus der bisherigen App. Rumpf wie `0091`; geändert sind zwei
-- Zeilen: die Spalte im `insert` und ihr Verhalten beim Wiederholungslauf.
-- **`coalesce(events.point_rule_code, excluded.…)`** und nicht schlicht
-- `excluded`: Ein Verein, der einem übernommenen Training von Hand eine andere
-- Regel gegeben hat, behält sie – der nächtliche Abgleich ist keine
-- Gelegenheit, eine Entscheidung zu überschreiben.
create or replace function public.upsert_legacy_event(
  p_club_id          uuid,
  p_external_id      text,
  p_type             text,
  p_title            text,
  p_why              text,
  p_starts_at        timestamptz,
  p_ends_at          timestamptz default null,
  p_location         text default null,
  p_capacity_needed  int default null,
  p_cancelled        boolean default false,
  p_cancelled_reason text default null,
  p_shifts           jsonb default '[]'::jsonb,
  p_team_id          uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_shift jsonb;
  v_keep  text[] := '{}';
  v_why   text;
  v_base  int;
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return null;
  end if;
  if p_type not in ('social','helper','training') then
    raise exception 'Die bisherige App liefert Anlässe, Helfer-Events und Trainings, nicht «%»', p_type;
  end if;
  if coalesce(trim(p_title), '') = '' or p_starts_at is null then
    return null;
  end if;
  if p_team_id is not null and not exists (
       select 1 from teams where id = p_team_id and club_id = p_club_id) then
    return null;
  end if;

  v_base := club_shift_base(p_club_id);

  -- BR-188: Der Ersatzsatz gilt den Aufrufen, für die BR-036 ein Warum
  -- verlangt. Ein Training bleibt ohne Beschreibung einfach ohne Warum.
  v_why := nullif(left(trim(coalesce(p_why, '')), 500), '');
  if v_why is null and p_type in ('social', 'helper') then
    v_why := 'Aus der bisherigen myclub-App übernommen';
  end if;

  insert into events (
    club_id, team_id, type, title, why, starts_at, ends_at, location,
    capacity_needed, cancelled_at, cancelled_reason, external_id,
    published_at, is_sample, point_rule_code
  )
  values (
    p_club_id, p_team_id, p_type,
    left(trim(p_title), 160), v_why, p_starts_at,
    case when p_ends_at > p_starts_at then p_ends_at else null end,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    case when coalesce(p_capacity_needed, 0) >= 1 then p_capacity_needed else null end,
    case when p_cancelled then now() else null end,
    case when p_cancelled
         then coalesce(nullif(left(trim(coalesce(p_cancelled_reason, '')), 500), ''),
                       'In der bisherigen App abgesagt')
         else null end,
    p_external_id, now(), false,
    -- BR-263: Ohne Regel bleibt der übernommene Kalender punktlos.
    event_rule_code(p_club_id, p_type)
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    team_id          = excluded.team_id,
    type             = excluded.type,
    title            = excluded.title,
    why              = excluded.why,
    starts_at        = excluded.starts_at,
    ends_at          = excluded.ends_at,
    location         = excluded.location,
    capacity_needed  = excluded.capacity_needed,
    cancelled_at     = case when excluded.cancelled_at is null then null
                            else coalesce(events.cancelled_at, excluded.cancelled_at) end,
    cancelled_reason = excluded.cancelled_reason,
    point_rule_code  = coalesce(events.point_rule_code, excluded.point_rule_code)
  returning id into v_id;

  for v_shift in select * from jsonb_array_elements(coalesce(p_shifts, '[]'::jsonb))
  loop
    if coalesce(v_shift->>'external_id', '') = '' then continue; end if;
    v_keep := v_keep || (v_shift->>'external_id');

    insert into event_shifts (event_id, external_id, title, starts_at, ends_at,
                              needed, points, point_rule_code)
    values (
      v_id,
      v_shift->>'external_id',
      left(coalesce(nullif(trim(v_shift->>'title'), ''), 'Schicht'), 160),
      (v_shift->>'starts_at')::timestamptz,
      (v_shift->>'ends_at')::timestamptz,
      greatest(coalesce((v_shift->>'needed')::int, 1), 1),
      -- BR-204/BR-205: der Punktwert kommt aus der **Dauer**, gemessen am
      -- Einsatz. Ein fremder Wert ist keine Punktzahl dieser Skala.
      suggested_shift_points((extract(epoch from (
        (v_shift->>'ends_at')::timestamptz - (v_shift->>'starts_at')::timestamptz
      )) / 60)::int, v_base),
      'shift_done'
    )
    on conflict (event_id, external_id) where external_id is not null
    do update set
      title     = excluded.title,
      starts_at = excluded.starts_at,
      ends_at   = excluded.ends_at,
      needed    = excluded.needed,
      points    = excluded.points;
  end loop;

  delete from event_shifts s
   where s.event_id = v_id
     and s.external_id is not null
     and not (s.external_id = any (v_keep))
     and not exists (select 1 from attendance a where a.shift_id = s.id);

  return v_id;
end;
$$;

-- Der Verbandsabgleich. Rumpf wie `0076`; dieselben zwei Zeilen wie oben.
-- Ohne sie bliebe jedes der 124 übernommenen Spiele punktlos und jedes neue
-- dazu.
create or replace function public.upsert_federation_game(
  p_team_id     uuid,
  p_external_id text,
  p_title       text,
  p_starts_at   timestamptz,
  p_location    text default null,
  p_result      text default null,
  p_latitude    double precision default null,
  p_longitude   double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
  v_id   uuid;
  v_lat  double precision;
  v_lng  double precision;
begin
  select * into v_team from teams where id = p_team_id;
  if not found or v_team.federation_team_id is null or v_team.federation_stale_at is not null then
    return null;
  end if;

  -- Beide oder keiner (Constraint in `0076`) – ein halber Punkt wird
  -- verworfen, statt den Abgleich des ganzen Teams zu stoppen.
  if p_latitude is not null and p_longitude is not null then
    v_lat := p_latitude;
    v_lng := p_longitude;
  end if;

  insert into events (club_id, team_id, type, title, starts_at, location,
                      latitude, longitude, result, external_id, point_rule_code)
  values (
    v_team.club_id, p_team_id, 'match',
    left(trim(p_title), 160), p_starts_at,
    nullif(left(trim(coalesce(p_location, '')), 200), ''),
    v_lat, v_lng,
    nullif(left(trim(coalesce(p_result, '')), 40), ''),
    p_external_id,
    event_rule_code(v_team.club_id, 'match')
  )
  on conflict (club_id, external_id) where external_id is not null
  do update set
    team_id         = excluded.team_id,
    title           = excluded.title,
    starts_at       = excluded.starts_at,
    location        = excluded.location,
    latitude        = excluded.latitude,
    longitude       = excluded.longitude,
    result          = excluded.result,
    point_rule_code = coalesce(events.point_rule_code, excluded.point_rule_code)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Die Amtsgutschrift läuft von selbst (BR-264).
--
-- `0091` hat die Mechanik gebaut und keinen Auslöser: `confirm_office_term()`
-- prüft `is_club_admin()` und ist damit **nur** von einem angemeldeten
-- Vorstandskonto aus aufrufbar – ein Cron-Job hat kein JWT und käme nie durch.
-- Deshalb wird die Buchung hier in zwei Stücke geteilt:
--
--   * `grant_office_term()` – die Sachprüfungen und die Buchung, **ohne**
--     Rollenprüfung, intern und vom Netz abgeklemmt.
--   * `confirm_office_term()` – die Hülle für den Vorstand, unverändert in
--     Signatur und Verhalten.
--
-- Das ist dasselbe Muster wie bei `award_points()`: Wer prüft, ob jemand
-- **darf**, und wer prüft, ob es **stimmt**, sind zwei Fragen.
-- ---------------------------------------------------------------------------
-- Der Anteil eines Quartals am Saisonwert. **Eine** Definition für die Buchung
-- und die Vorschau: Rechnete die Vorschau anders als `grant_office_term()`,
-- verspräche die Karte einen anderen Betrag, als am Quartalsende ankommt.
-- Das vierte Quartal trägt den Rest, damit vier Viertel den ganzen Wert
-- ergeben und nicht drei Punkte fehlen.
create or replace function public.office_period_share(p_season_points int, p_period smallint)
returns int
language sql
immutable
as $$
  select case
    when coalesce(p_season_points, 0) <= 0 then 0
    when p_period = 4 then p_season_points - 3 * (p_season_points / 4)
    else p_season_points / 4
  end;
$$;

comment on function public.office_period_share(int, smallint) is
  'BR-207: Anteil eines Quartals am Saisonwert eines Amtes.';

create or replace function public.grant_office_term(
  p_role_id   uuid,
  p_member_id uuid,
  p_period    smallint default null,
  p_season    text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role   functionary_roles;
  v_season text;
  v_period smallint;
  v_share  int;
  v_term   uuid;
  v_user   uuid;
  v_by     uuid;
begin
  select * into v_role from functionary_roles where id = p_role_id;
  if not found then
    raise exception 'Dieses Amt gibt es nicht';
  end if;

  if not exists (select 1 from club_members
                  where id = p_member_id and club_id = v_role.club_id) then
    raise exception 'Kein Mitglied dieses Vereins';
  end if;

  -- Nur, wer den Sitz auch hält. «Ad interim» zählt mit: Die Arbeit wird
  -- geleistet, unabhängig davon, ob die Nachfolge schon geregelt ist.
  if not exists (select 1 from functionary_holders
                  where role_id = p_role_id and member_id = p_member_id) then
    raise exception 'Diese Person hält dieses Amt nicht';
  end if;

  -- Ohne festgelegten Wert keine Gutschrift. Das ist kein Fehler, sondern der
  -- Normalfall für ein Amt, über das der Vorstand noch nicht entschieden hat.
  if coalesce(v_role.season_points, 0) <= 0 then
    return 0;
  end if;

  v_season := coalesce(nullif(trim(p_season), ''), season_label(v_role.club_id));
  v_period := coalesce(p_period, season_period(v_role.club_id));

  v_share := office_period_share(v_role.season_points, v_period);

  -- Im Cron ist niemand angemeldet; die Spalte bleibt dann leer und sagt
  -- damit genau das Richtige: Diese Buchung hat niemand von Hand ausgelöst.
  v_by := current_member_id(v_role.club_id);

  insert into functionary_terms (role_id, member_id, season, period, points, confirmed_by)
  values (p_role_id, p_member_id, v_season, v_period, v_share, v_by)
  on conflict (role_id, member_id, season, period) do nothing
  returning id into v_term;

  -- Schon gutgeschrieben: Der Stand bleibt, eine zweite Nachricht unterbleibt.
  if v_term is null then
    return 0;
  end if;

  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id, note)
  values
    (v_role.club_id, p_member_id, 'office_held', v_share, v_season,
     'office', v_term, v_role.title)
  on conflict do nothing;

  select user_id into v_user from club_members where id = p_member_id;
  if v_user is not null and v_share > 0 then
    perform notify(
      v_user,
      'points',
      'Amt gutgeschrieben',
      v_role.title || ' – ' || v_share || ' Punkte für dieses Quartal',
      '/tabs/profile',
      v_role.club_id
    );
  end if;

  return v_share;
end;
$$;

comment on function public.grant_office_term(uuid, uuid, smallint, text) is
  'BR-207/BR-264: bucht ein Quartal einer Amtszeit. Intern – prüft die Sache, nicht die Rolle.';

-- Die Hülle für den Vorstand. Signatur und Verhalten wie in `0091`.
create or replace function public.confirm_office_term(
  p_role_id   uuid,
  p_member_id uuid,
  p_period    smallint default null,
  p_season    text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from functionary_roles where id = p_role_id;
  if v_club is null then
    raise exception 'Dieses Amt gibt es nicht';
  end if;

  -- NFR-039: serverseitig geprüft, nicht im UI versteckt.
  if not is_club_admin(v_club) then
    raise exception 'Nur der Vorstand schreibt Ämter gut';
  end if;

  return grant_office_term(p_role_id, p_member_id, p_period, p_season);
end;
$$;

-- Alle fälligen Quartale eines Vereins nachziehen.
--
-- «Fällig» heisst: vom Quartal, in dem der Sitz besetzt wurde, bis zum
-- laufenden. Drei Gründe für das Nachziehen statt einer Buchung nur fürs
-- aktuelle Quartal:
--
--   * Der erste Lauf trifft eine Saison, die schon läuft – hier Quartal 2.
--     Ohne Nachzug fiele Quartal 1 für alle 21 Sitze ersatzlos aus.
--   * Ein Cron kann ausfallen. Ein Lauf, der nur das Jetzt sieht, macht aus
--     einem Ausfall einen dauerhaften Verlust.
--   * Der Unique-Index über `(role_id, member_id, season, period)` macht jeden
--     Wiederholungslauf still und folgenlos.
--
-- `since` am Sitz entscheidet, wo begonnen wird: Wer im Januar dazukommt,
-- bekommt nicht rückwirkend das ganze Vereinsjahr. Ohne `since` – heute der
-- Normalfall, die Spalte ist bei allen 31 Sitzen leer – gilt die ganze Saison,
-- denn ein Sitz ohne Eintrittsdatum ist kein Sitz, der gerade erst entstand.
create or replace function public.office_terms_due(
  p_club_id uuid,
  p_season  text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_holder  record;
  v_season  text;
  v_now     smallint;
  v_from    smallint;
  v_period  smallint;
  v_end     date;
  v_count   int := 0;
begin
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));
  v_now    := season_period(p_club_id);
  v_end    := season_end(p_club_id);

  for v_holder in
    select h.role_id, h.member_id, h.since
      from functionary_holders h
      join functionary_roles r on r.id = h.role_id
     where r.club_id = p_club_id
       and h.member_id is not null
       and coalesce(r.season_points, 0) > 0
  loop
    -- Ein Sitz, der erst nach dieser Saison beginnt, bekommt nichts.
    if v_holder.since is not null and v_holder.since > v_end then
      continue;
    end if;

    if v_holder.since is not null
       and season_label(p_club_id, v_holder.since::timestamptz) = v_season then
      v_from := season_period(p_club_id, v_holder.since::timestamptz);
    else
      v_from := 1;
    end if;

    v_period := v_from;
    while v_period <= v_now loop
      if grant_office_term(v_holder.role_id, v_holder.member_id, v_period, v_season) > 0 then
        v_count := v_count + 1;
      end if;
      v_period := (v_period + 1)::smallint;
    end loop;
  end loop;

  return v_count;
end;
$$;

comment on function public.office_terms_due(uuid, text) is
  'BR-264: bucht alle fälligen Quartale der laufenden Saison nach. Intern, ohne Rollenprüfung.';

-- Der Knopf des Vorstands (UC-041 A9).
create or replace function public.confirm_office_due(p_club_id uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand schreibt Ämter gut';
  end if;

  return office_terms_due(p_club_id, null);
end;
$$;

-- Der Cron über alle Vereine. **Täglich** und nicht quartalsweise: Der
-- Quartalswechsel hängt am `season_start` des Vereins und fällt für jeden auf
-- einen anderen Tag – ein `cron`-Ausdruck, der das treffen wollte, müsste 28
-- Fälle kennen. Ein täglicher Lauf trifft ihn immer, und weil jede Buchung
-- über den Unique-Index dedupliziert, kostet er an den übrigen 89 Tagen
-- nichts als eine Abfrage.
create or replace function public.award_office_terms()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  record;
  v_count int := 0;
begin
  for v_club in select id from clubs loop
    v_count := v_count + office_terms_due(v_club.id, null);
  end loop;

  return v_count;
end;
$$;

select cron.unschedule('office-credit')
 where exists (select 1 from cron.job where jobname = 'office-credit');

select cron.schedule('office-credit', '20 4 * * *', $cron$select public.award_office_terms();$cron$);

-- ---------------------------------------------------------------------------
-- 3. Eingeplante Punkte (FR-198, BR-265).
--
-- «Eingeplant» ist, was jemand **zugesagt** hat und was noch **nicht gebucht**
-- ist. Das ist weder das Geleistete (`contribution_points()`) noch ein
-- Vorschlag (`next_contributions()` zeigt gerade das, was niemand zugesagt
-- hat), sondern das Stück dazwischen – und für die Frage «reicht mein Beitrag
-- diese Saison?» ist es das wichtigere von beiden.
--
-- **Nur die Beitragssäulen.** `contribution_pillars()` sagt, was aufs Ziel
-- zählt: Säule 3 und 7. Ein angemeldetes Training (Säule 1) bringt Punkte für
-- die Rangliste, aber nicht für das Ziel – es hier mitzuzählen hiesse, neben
-- einem Ziel eine Zahl zu zeigen, die nie dorthin führt.
-- ---------------------------------------------------------------------------

create or replace function public.contribution_planned(
  p_club_id   uuid,
  p_member_id uuid,
  p_season    text default null
)
returns int
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season text;
  v_total  int := 0;
  v_add    int;
  v_holder record;
  v_end    date;
  v_from   smallint;
  v_period smallint;
begin
  v_season := coalesce(nullif(trim(p_season), ''), season_label(p_club_id));

  -- a) Angemeldete Schichten, die noch nicht bestätigt sind.
  --
  -- Ohne Zeitgrenze, anders als bei den Terminen unten: `confirm_shift()`
  -- kennt kein Zeitfenster, der Schichtleiter bestätigt auch Tage später. Eine
  -- Schicht von gestern, die noch niemand abgehakt hat, ist genau der Fall,
  -- für den diese Zahl da ist.
  select coalesce(sum(coalesce(s.points, 0)), 0) into v_add
    from attendance a
    join event_shifts s on s.id = a.shift_id
    join events e on e.id = s.event_id
    join point_rules r on r.club_id = e.club_id and r.code = s.point_rule_code
   where e.club_id = p_club_id
     and a.member_id = p_member_id
     and a.status in ('registered', 'present')
     and e.cancelled_at is null
     and r.is_active
     and r.pillar = any (contribution_pillars())
     and season_label(p_club_id, s.starts_at) = v_season
     and not exists (
       select 1 from point_transactions t
        where t.member_id = p_member_id
          and t.source_type = 'shift'
          and t.source_id = s.id);
  v_total := v_total + v_add;

  -- b) Zugesagte **künftige** Termine, an denen eine Beitragsregel hängt.
  --
  -- Hier gilt die Zeitgrenze: `check_in()` lässt nur von 30 Minuten vor Beginn
  -- bis zum Ende scannen (BR-054). Ein vergangener Termin ohne Buchung bringt
  -- nichts mehr – ihn mitzuzählen wäre ein Versprechen, das der Server schon
  -- abgelehnt hat.
  select coalesce(sum(r.points), 0) into v_add
    from attendance a
    join events e on e.id = a.event_id
    join point_rules r on r.club_id = e.club_id and r.code = e.point_rule_code
   where e.club_id = p_club_id
     and a.member_id = p_member_id
     and a.shift_id is null
     and a.status = 'registered'
     and e.cancelled_at is null
     and e.starts_at > now()
     and r.is_active
     and r.pillar = any (contribution_pillars())
     and season_label(p_club_id, e.starts_at) = v_season
     and not exists (
       select 1 from point_transactions t
        where t.member_id = p_member_id
          and t.source_type = 'attendance'
          and t.source_id = e.id);
  v_total := v_total + v_add;

  -- c) Übernommene Aufgaben, die noch nicht bestätigt sind. Die Aufgabe trägt
  -- ihren Punktwert selbst (BR-077); die Regel liefert nur die Säule.
  select coalesce(sum(t.points), 0) into v_add
    from task_assignments asg
    join tasks t on t.id = asg.task_id
   where t.club_id = p_club_id
     and asg.member_id = p_member_id
     and asg.confirmed_at is null
     and t.status in ('open', 'claimed', 'submitted')
     and exists (
       select 1 from point_rules r
        where r.club_id = t.club_id
          and r.code = 'task_done'
          and r.is_active
          and r.pillar = any (contribution_pillars()))
     and not exists (
       select 1 from point_transactions pt
        where pt.member_id = p_member_id
          and pt.source_type = 'task'
          and pt.source_id = t.id);
  v_total := v_total + v_add;

  -- d) Was die gehaltenen Ämter dieser Saison noch bringen.
  --
  -- Dieselbe Quartalsrechnung wie `office_terms_due()`, nur in die andere
  -- Richtung: dort die fälligen, hier alle noch offenen bis zum Saisonende.
  -- Ein Amt ist eine Zusage über die ganze Saison – wer es im September
  -- innehat, trägt es im Mai noch.
  if exists (select 1 from point_rules
              where club_id = p_club_id and code = 'office_held' and is_active
                and pillar = any (contribution_pillars())) then
    v_end := season_end(p_club_id);

    for v_holder in
      select h.role_id, h.since, r.season_points
        from functionary_holders h
        join functionary_roles r on r.id = h.role_id
       where r.club_id = p_club_id
         and h.member_id = p_member_id
         and coalesce(r.season_points, 0) > 0
    loop
      if v_holder.since is not null and v_holder.since > v_end then
        continue;
      end if;

      if v_holder.since is not null
         and season_label(p_club_id, v_holder.since::timestamptz) = v_season then
        v_from := season_period(p_club_id, v_holder.since::timestamptz);
      else
        v_from := 1;
      end if;

      v_period := v_from;
      while v_period <= 4 loop
        if not exists (
          select 1 from functionary_terms ft
           where ft.role_id = v_holder.role_id
             and ft.member_id = p_member_id
             and ft.season = v_season
             and ft.period = v_period
        ) then
          v_total := v_total + office_period_share(v_holder.season_points, v_period);
        end if;
        v_period := (v_period + 1)::smallint;
      end loop;
    end loop;
  end if;

  return v_total;
end;
$$;

comment on function public.contribution_planned(uuid, uuid, text) is
  'BR-265: zugesagt und noch nicht gebucht – Schichten, Termine, Aufgaben, Ämter. Nur Beitragssäulen.';

-- Der eigene Stand, um das Eingeplante erweitert. Der Rückgabetyp wächst um
-- eine Spalte, deshalb erst weg und neu – `create or replace` kann das nicht.
drop function if exists public.my_contribution_goal(uuid);

create or replace function public.my_contribution_goal(p_club_id uuid)
returns table (
  season    text,
  goal      int,
  earned    int,
  planned   int,
  remaining int,
  state     text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member uuid;
  v_goal   int;
  v_earned int;
  v_season text;
begin
  v_member := current_member_id(p_club_id);
  if v_member is null then
    return;
  end if;

  -- BR-199: ohne Modul kein Saisonziel.
  if not module_enabled(p_club_id, 'goal') then
    return;
  end if;

  v_goal := contribution_goal(p_club_id, v_member);
  if v_goal is null or v_goal = 0 then
    return;
  end if;

  v_season := season_label(p_club_id);
  v_earned := contribution_points(p_club_id, v_member, v_season);

  -- Die **Ampel bleibt am Geleisteten** (BR-265): Eingeplant ist zugesagt,
  -- nicht geleistet, und eine Zusage darf nicht grün färben. Die Karte zeigt
  -- das Eingeplante daneben – dort ist es eine Auskunft, hier wäre es eine
  -- Behauptung.
  return query select
    v_season,
    v_goal,
    v_earned,
    contribution_planned(p_club_id, v_member, v_season),
    greatest(v_goal - v_earned, 0),
    contribution_state(v_earned, v_goal);
end;
$$;

-- Die Übersicht des Vorstands – dieselbe Erweiterung. Ohne sie sähe der
-- Vorstand eine Null neben jemandem, dessen Beitrag längst eingeteilt ist,
-- und spräche ihn an (BR-201: Angebot statt Mahnung setzt voraus, dass die
-- Liste die Lage kennt).
drop function if exists public.contribution_overview(uuid);

create or replace function public.contribution_overview(p_club_id uuid)
returns table (
  member_id   uuid,
  name        text,
  avatar_url  text,
  goal        int,
  earned      int,
  planned     int,
  remaining   int,
  state       text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_season text;
begin
  -- NFR-039: serverseitig, nicht im Client gefiltert.
  if not is_club_board(p_club_id) then
    raise exception 'Nur der Vorstand sieht die Beiträge der Saison';
  end if;

  v_season := season_label(p_club_id);

  return query
  select
    m.id,
    m.display_name,
    m.avatar_url,
    g.goal,
    e.earned,
    p.planned,
    -- Ohne Ziel keine Restzahl: Ein Rückstand ohne Massstab wäre eine
    -- erfundene Zahl.
    case when g.goal is null then null else greatest(g.goal - e.earned, 0) end,
    contribution_state(e.earned, g.goal)
  from club_members m
  cross join lateral (select contribution_goal(p_club_id, m.id) as goal) g
  cross join lateral (select contribution_points(p_club_id, m.id, v_season) as earned) e
  cross join lateral (select contribution_planned(p_club_id, m.id, v_season) as planned) p
  where m.club_id = p_club_id
    and m.status = 'active'
  -- Wer am weitesten zurückliegt, steht zuoberst: Die Liste ist zum Handeln
  -- da, nicht zum Nachschlagen. **Eingeplantes zählt hier mit**, denn wer
  -- eingeteilt ist, braucht keine Ansprache – die Reihenfolge ist die
  -- Handlungsempfehlung, nicht die Bewertung.
  order by
    case when g.goal is null or g.goal = 0 then 1 else 0 end,
    case when g.goal is null or g.goal = 0 then 0
         else least((e.earned + p.planned)::numeric / nullif(g.goal, 0), 1) end,
    m.display_name;
end;
$$;

-- BR-266: Wer eingeplant ist, ist nicht säumig.
--
-- Rumpf wie `0080`; geändert ist die eine Bedingung, die zählt. Ohne sie
-- meldete das Signal acht Wochen vor Saisonende jede Juniorentrainerin als
-- Lücke, deren Amt erst am Quartalsende bucht – genau der Fall, für den
-- `0091` die quartalsweise Gutschrift eingeführt hat.
create or replace function public.detect_contribution_gaps(p_club_id uuid default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club   record;
  v_count  int := 0;
  v_weeks  numeric;
  v_left   int;
  v_open   int;
begin
  for v_club in
    select c.id from clubs c
     where (p_club_id is null or c.id = p_club_id)
  loop
    -- BR-199: ohne Modul kein Signal.
    if not module_enabled(v_club.id, 'goal') then
      continue;
    end if;

    v_weeks := health_threshold(v_club.id, 'contributionGapWeeks', 8);
    v_left  := (season_end(v_club.id) - current_date);

    -- Nur im Fenster vor dem Saisonende. Davor ist ein fehlender Beitrag kein
    -- Befund, sondern der normale Anfang einer Saison.
    if v_left < 0 or v_left > v_weeks * 7 then
      continue;
    end if;

    select count(*)::int into v_open
      from club_members m
     where m.club_id = v_club.id
       and m.status = 'active'
       and coalesce(contribution_goal(v_club.id, m.id), 0) > 0
       and contribution_points(v_club.id, m.id) = 0
       and contribution_planned(v_club.id, m.id, null) = 0;

    if v_open = 0 then
      continue;
    end if;

    -- BR-202: die **Zahl**, keine Namen. Nur die Zahl und nicht zusätzlich
    -- die Wochen: Das Signal entsteht ohnehin nur im Fenster vor dem
    -- Saisonende, und ein zusammengesetztes `detail` («12:5») müsste die
    -- Anzeige auseinandernehmen – dieselbe Zahl, zwei Lesarten.
    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_club.id, null, null, 'contribution_gap', 'info', v_open::text)
    on conflict do nothing;

    if found then
      v_count := v_count + 1;
      perform notify_signal_owners(
        (select id from health_signals
          where club_id = v_club.id and signal_type = 'contribution_gap'));
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Die Vorschläge, auf die Beitragssäulen eingeschränkt (BR-265).
--
-- Die Zielkarte sagt heute unter dem Balken: «Diese Beiträge passen zu dir und
-- zählen aufs Ziel.» Der zweite Halbsatz stimmte nicht: `next_contributions()`
-- liefert jeden Termin, an dem eine aktive Regel hängt – seit Teil 1 dieser
-- Migration also auch jedes Training (Säule 1) und jedes Spiel (Säule 2).
-- Aufs **Ziel** zahlen nur die Säulen 3 und 7 ein (`contribution_pillars()`).
--
-- Deshalb ein Schalter statt einer zweiten Funktion: Das Dashboard zeigt
-- weiterhin alles, was Punkte bringt; die Zielkarte fragt nach dem, was ihr
-- Balken auch bewegt. Zwei Funktionen mit fast gleichem Rumpf wären zwei
-- Gelegenheiten, die Sortierung auseinanderlaufen zu lassen.
--
-- Der Parameter kommt hinten und hat einen Vorgabewert, die alte Signatur
-- fällt weg: Eine zweite Überladung `(uuid, int)` neben `(uuid, int, boolean)`
-- macht aus jedem Aufruf über PostgREST eine Frage der Auflösung.
-- ---------------------------------------------------------------------------
drop function if exists public.next_contributions(uuid, int);

create or replace function public.next_contributions(
  p_club_id           uuid,
  p_limit             int default 5,
  p_contribution_only boolean default false
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
      and (not p_contribution_only or exists (
        select 1 from point_rules r
         where r.club_id = e.club_id
           and r.code = e.point_rule_code
           and r.is_active
           and r.pillar = any (contribution_pillars())
      ))
  ),
  -- b) Schichten mit Unterdeckung, in die ich nicht eingetragen bin –
  --    höchstens eine je Termin (`distinct on`), die früheste. Ein Anlass mit
  --    einem Dutzend Schichten füllte sonst die ganze Liste, und weil alle
  --    Zeilen denselben Termin tragen, wäre es zwölfmal derselbe Vorschlag.
  shifts_open as (
    select distinct on (e.id)
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
      and (not p_contribution_only or exists (
        select 1 from point_rules r
         where r.club_id = e.club_id
           and r.code = s.point_rule_code
           and r.is_active
           and r.pillar = any (contribution_pillars())
      ))
    -- `s.id` als letztes Glied, damit bei gleicher Anfangszeit immer dieselbe
    -- Schicht gewinnt: Ein Vorschlag, der bei jedem Abruf wechselt, sieht wie
    -- ein Fehler aus.
    order by e.id, s.starts_at, s.id
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
      and (not p_contribution_only or exists (
        select 1 from point_rules r
         where r.club_id = t.club_id
           and r.code = 'task_done'
           and r.is_active
           and r.pillar = any (contribution_pillars())
      ))
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

-- ---------------------------------------------------------------------------
-- 4. Rechte.
--
-- Eine neue `security definer`-Funktion ist sofort ein offener Endpunkt:
-- Postgres vergibt `execute` an PUBLIC, Supabase zusätzlich an `anon` und
-- `authenticated` (CLAUDE.md, Vorlage `0007`). `revoke … from anon` allein
-- wirkt nicht – `anon` zieht sein Recht aus PUBLIC.
--
-- Die Trennlinie ist dieselbe wie überall: Was **selbst** prüft, wen es vor
-- sich hat, darf an Angemeldete; was das nicht tut, bleibt intern. Die drei
-- neuen internen sind `grant_office_term()` (bucht ohne Rollenprüfung),
-- `office_terms_due()` (ruft sie in der Schleife) und `award_office_terms()`
-- (der Cron über alle Vereine) – jede von ihnen wäre offen ein Endpunkt, mit
-- dem jedes angemeldete Konto sich selbst Punkte schreiben könnte.
-- ---------------------------------------------------------------------------
revoke execute on function public.event_rule_code(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.upsert_legacy_event(
  uuid, text, text, text, text, timestamptz, timestamptz, text, int, boolean, text, jsonb, uuid)
  from public, anon, authenticated;

revoke execute on function public.upsert_federation_game(
  uuid, text, text, timestamptz, text, text, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.upsert_federation_game(
  uuid, text, text, timestamptz, text, text, double precision, double precision)
  to service_role;

revoke execute on function public.grant_office_term(uuid, uuid, smallint, text)
  from public, anon, authenticated;
revoke execute on function public.office_terms_due(uuid, text)
  from public, anon, authenticated;
revoke execute on function public.award_office_terms()
  from public, anon, authenticated;
revoke execute on function public.contribution_planned(uuid, uuid, text)
  from public, anon, authenticated;
revoke execute on function public.detect_contribution_gaps(uuid)
  from public, anon, authenticated;

-- `office_period_share()` rechnet zwar nur und liest nichts, bleibt aber
-- trotzdem intern: Die App ruft sie nicht, und ein Grant ohne Aufrufer ist ein
-- offener Endpunkt ohne Nutzen. Braucht die Oberfläche den Anteil einmal,
-- kommt der Grant mit dem Aufrufer.
revoke execute on function public.office_period_share(int, smallint)
  from public, anon, authenticated;

revoke execute on function public.confirm_office_due(uuid) from public, anon;
grant  execute on function public.confirm_office_due(uuid) to authenticated;

revoke execute on function public.confirm_office_term(uuid, uuid, smallint, text) from public, anon;
grant  execute on function public.confirm_office_term(uuid, uuid, smallint, text) to authenticated;

revoke execute on function public.my_contribution_goal(uuid) from public, anon;
grant  execute on function public.my_contribution_goal(uuid) to authenticated;

revoke execute on function public.contribution_overview(uuid) from public, anon;
grant  execute on function public.contribution_overview(uuid) to authenticated;

revoke execute on function public.next_contributions(uuid, int, boolean) from public, anon;
grant  execute on function public.next_contributions(uuid, int, boolean) to authenticated;
