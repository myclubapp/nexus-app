-- ============================================================================
-- 0038_manual_points: Punkte manuell buchen und korrigieren (UC-021)
--
-- Die letzte offene Lücke der Schreibseite. `award_points()` besteht seit
-- 0002, bucht aber ausschliesslich über eine Regel; ohne Regel zu buchen geht
-- nicht, und eine Gegenbuchung kennt das System überhaupt nicht.
--
-- Vier Regeln hängen daran, und keine davon war bisher irgendwo festgehalten:
--   BR-085  Der Ledger ist unveränderlich. Korrekturen sind Gegenbuchungen.
--   BR-086  Jede manuelle Buchung nennt ihren Anlass.
--   BR-087  Ein negativer Wert ist nur als Gegenbuchung zulässig.
--   BR-088  Eine verworfene Doppelbuchung wird nicht von Hand nachgeholt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Säule einer manuellen Buchung.
--
-- Das Entitätsmodell leitet sie über `rule_code` ab – eine manuelle Buchung
-- hat aber keine Regel. Sie bekommt deshalb einen eigenen Ort; bei
-- regelbasierten Buchungen bleibt er leer, und die Säule kommt weiterhin aus
-- der Regel. Zwei Wege zu **derselben** Angabe wären ein Widerspruch in
-- Wartestellung; hier sind es zwei Wege zu zwei verschiedenen Fällen.
-- ---------------------------------------------------------------------------
alter table point_transactions add column if not exists pillar smallint;
alter table point_transactions drop constraint if exists point_tx_pillar_check;
alter table point_transactions add constraint point_tx_pillar_check
  check (pillar is null or pillar between 1 and 7);

-- BR-086: als Constraint und nicht nur als Formularprüfung (C-011).
update point_transactions
   set note = 'Nachträglich ohne Anlass erfasst'
 where source_type in ('manual','correction') and coalesce(trim(note), '') = '';
alter table point_transactions drop constraint if exists point_tx_manual_note_check;
alter table point_transactions add constraint point_tx_manual_note_check
  check (
    source_type not in ('manual','correction')
    or coalesce(trim(note), '') <> ''
  );

-- ---------------------------------------------------------------------------
-- Schritte 1–7: von Hand buchen, auch für mehrere Mitglieder (A3).
--
-- Der Punktwert ist hier ausdrücklich **positiv**: Ein negativer Wert entsteht
-- ausschliesslich als Gegenbuchung zu einer bestehenden Buchung (BR-087).
-- Wer «Punkte abziehen» will, korrigiert die Buchung, die er meint – und
-- hinterlässt damit eine Spur, die man lesen kann.
-- ---------------------------------------------------------------------------
create or replace function public.book_points_manually(
  p_club_id    uuid,
  p_member_ids uuid[],
  p_pillar     smallint,
  p_points     int,
  p_note       text
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin  uuid;
  v_note   text;
  v_member uuid;
  v_user   uuid;
  v_count  int := 0;
begin
  -- A4: Die Voraussetzung nennt ausdrücklich `admin`.
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand bucht Punkte von Hand';
  end if;

  v_admin := current_member_id(p_club_id);

  -- A2/BR-086.
  v_note := nullif(trim(p_note), '');
  if v_note is null then
    raise exception 'Jede Buchung von Hand nennt ihren Anlass';
  end if;

  if p_pillar is null or p_pillar < 1 or p_pillar > 7 then
    raise exception 'Eine Buchung gehört zu einer der sieben Säulen';
  end if;

  -- BR-087.
  if p_points is null or p_points <= 0 then
    raise exception 'Ein Abzug entsteht nur als Korrektur einer Buchung';
  end if;

  if p_member_ids is null or array_length(p_member_ids, 1) is null then
    raise exception 'Ohne Mitglied keine Buchung';
  end if;

  -- A3: genug für einen ganzen Verein, wenig genug für eine Transaktion.
  if array_length(p_member_ids, 1) > 100 then
    raise exception 'Höchstens 100 Mitglieder je Buchung';
  end if;

  foreach v_member in array p_member_ids loop
    -- Ein Mitglied aus einem fremden Verein bekäme sonst Punkte, die niemand
    -- sieht – und die die Rangliste eines fremden Vereins verschöben.
    if not exists (
      select 1 from club_members
       where id = v_member and club_id = p_club_id and status <> 'left'
    ) then
      raise exception 'Dieses Mitglied gehört nicht zu diesem Verein';
    end if;

    insert into point_transactions
      (club_id, member_id, rule_code, pillar, points, season,
       source_type, source_id, note, created_by)
    values
      (p_club_id, v_member, null, p_pillar, p_points, season_label(p_club_id),
       'manual', null, v_note, v_admin);

    v_count := v_count + 1;

    -- Schritt 7: Die Gutschrift wird gemeldet – mit dem Anlass, nicht nur mit
    -- der Zahl.
    select user_id into v_user from club_members where id = v_member;
    if v_user is not null then
      perform notify(
        v_user, 'points', 'Punkte gutgeschrieben',
        v_note || ' – ' || p_points || ' Punkte',
        '/tabs/profile/points', p_club_id
      );
    end if;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: die Gegenbuchung.
--
-- BR-085: Die ursprüngliche Buchung bleibt **unverändert** stehen. Was
-- entsteht, ist eine zweite Zeile mit umgekehrtem Vorzeichen und einem Verweis
-- auf die erste.
--
-- BR-088: Der Verweis zeigt auf die **Buchung**, nie auf deren Quelle. Eine
-- verworfene Doppelbuchung lässt sich über diesen Weg also nicht nachholen.
-- Gegen die zweite Korrektur derselben Buchung schützt der Dedupe-Index
-- **nicht** – siehe die Prüfung unten.
-- ---------------------------------------------------------------------------
create or replace function public.reverse_points(
  p_transaction_id uuid,
  p_note           text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_original point_transactions;
  v_admin    uuid;
  v_note     text;
  v_user     uuid;
  v_new      uuid;
begin
  select * into v_original from point_transactions where id = p_transaction_id;
  if not found then
    raise exception 'Buchung nicht gefunden';
  end if;

  if not is_club_admin(v_original.club_id) then
    raise exception 'Nur der Vorstand korrigiert Buchungen';
  end if;

  v_note := nullif(trim(p_note), '');
  if v_note is null then
    raise exception 'Zu einer Korrektur gehört ihre Begründung';
  end if;

  if v_original.source_type = 'correction' then
    raise exception 'Eine Korrektur wird nicht ihrerseits korrigiert';
  end if;

  -- Ausdrücklich geprüft und nicht dem Dedupe-Index überlassen: Der Index
  -- steht auf `(member_id, rule_code, source_id)`, und eine manuelle Buchung
  -- hat **kein** `rule_code`. In einem gewöhnlichen Unique-Index sind zwei
  -- NULL-Werte verschieden – zwei Gegenbuchungen zur selben Buchung kämen
  -- damit beide durch. Nachgemessen, bevor es jemandem auffiel.
  if exists (
    select 1 from point_transactions
     where source_type = 'correction' and source_id = p_transaction_id
  ) then
    raise exception 'Diese Buchung wurde bereits korrigiert';
  end if;

  v_admin := current_member_id(v_original.club_id);

  insert into point_transactions
    (club_id, member_id, rule_code, pillar, points, season,
     source_type, source_id, note, created_by)
  values
    (v_original.club_id, v_original.member_id, v_original.rule_code,
     v_original.pillar, -v_original.points,
     -- Die Gegenbuchung fällt in die Saison des Originals: Sonst stünde in
     -- der laufenden Saison ein Abzug für etwas, das in der letzten passiert
     -- ist, und beide Stände wären falsch.
     v_original.season,
     'correction', p_transaction_id, v_note, v_admin)
  returning id into v_new;

  select user_id into v_user from club_members where id = v_original.member_id;
  if v_user is not null then
    perform notify(
      v_user, 'points', 'Buchung korrigiert',
      v_note || ' – ' || (-v_original.points) || ' Punkte',
      '/tabs/profile/points', v_original.club_id
    );
  end if;

  return v_new;
end;
$$;

revoke execute on function public.book_points_manually(uuid, uuid[], smallint, int, text)
  from public, anon;
grant  execute on function public.book_points_manually(uuid, uuid[], smallint, int, text)
  to authenticated;

revoke execute on function public.reverse_points(uuid, text) from public, anon;
grant  execute on function public.reverse_points(uuid, text) to authenticated;
