-- ============================================================================
-- 0074_delete_event_and_point_rule: Termin und Punkteregel löschen
--
-- Entscheid vom 2026-09-13: Wo etwas bearbeitet wird, lässt es sich auch
-- löschen – mit Rückfrage im Blatt. Zwei Entitäten hatten bisher keinen Weg:
-- der Termin (nur Absagen, FR-023) und die Punkteregel (nur Stilllegen).
--
-- Beide bekommen eine Funktion nach der Vorlage von `delete_team()` (0059):
-- Der Riegel gegen etwas mit Vergangenheit sitzt am Server, und die Meldung
-- sagt, was noch dranhängt. Die Reichweite ist die von `cancel_event()`
-- (0073): `can_plan_for_team()`, nicht `is_club_trainer()`. Die Policies
-- erlaubten das `delete` schon (`events_trainer_write`,
-- `point_rules_admin_write` – beide `for all`);
-- der Client ginge damit aber an Punktebuchungen vorbei, die keinen
-- Fremdschlüssel tragen: `point_transactions.source_id` und `rule_code`
-- verweisen ohne Constraint (0002). Ein gelöschter Termin liesse Buchungen
-- ohne Quelle zurück, eine gelöschte Regel Buchungen ohne Regel – und die
-- Rangliste rechnete mit beidem weiter, ohne es erklären zu können.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Termin löschen.
--
-- Nur dieser Termin, nie die Serie: Eine Serie löscht man Termin für Termin
-- oder sagt sie ab. Antworten, Schichten, Check-in-Token und Kontext-Fragen
-- fallen über `on delete cascade` mit (0003, 0029, 0050); Sitzungs-Inputs
-- verlieren nur ihren Bezug (0049, `set null`).
--
-- Gebuchte Punkte halten den Termin fest: die Teilnahme (`source_id` =
-- Termin) wie die Einsätze (`source_id` = Schicht, seit 0026).
-- ---------------------------------------------------------------------------
create or replace function public.delete_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event  events;
  v_booked int;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    raise exception 'Termin nicht gefunden';
  end if;
  -- Reichweite wie beim Absagen (0073): das eigene Team oder der Vorstand.
  if not can_plan_for_team(v_event.club_id, v_event.team_id) then
    raise exception 'Nur Trainer:innen des Teams und der Vorstand löschen Termine';
  end if;

  select count(*) into v_booked
    from point_transactions pt
   where pt.club_id = v_event.club_id
     and (
       pt.source_id = p_event_id
       or pt.source_id in (select s.id from event_shifts s where s.event_id = p_event_id)
     );

  if v_booked > 0 then
    raise exception 'Zu diesem Termin sind schon % Punktebuchungen erfolgt – er lässt sich nur noch absagen',
      v_booked;
  end if;

  delete from events where id = p_event_id;
end;
$$;

revoke execute on function public.delete_event(uuid) from public, anon;
grant  execute on function public.delete_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Punkteregel löschen.
--
-- Eine Regel mit Buchungen bleibt: Die Buchungen tragen ihren Wert selbst
-- (BR-063), aber den Namen holt die Punkte-Historie über den Regelcode.
-- Termine, die auf die Regel zeigen (`events.point_rule_code`), halten sie
-- ebenfalls – sonst zählte dort ab morgen nichts mehr, ohne dass es jemand
-- merkte. Wer die Regel nur nicht mehr will, legt sie still (UC-016).
-- ---------------------------------------------------------------------------
create or replace function public.delete_point_rule(p_rule_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rule   point_rules;
  v_booked int;
  v_events int;
begin
  select * into v_rule from point_rules where id = p_rule_id;
  if not found then
    raise exception 'Regel nicht gefunden';
  end if;
  if not is_club_admin(v_rule.club_id) then
    raise exception 'Nur der Vorstand löscht Punkteregeln';
  end if;

  select count(*) into v_booked
    from point_transactions
   where club_id = v_rule.club_id and rule_code = v_rule.code;
  select count(*) into v_events
    from events
   where club_id = v_rule.club_id and point_rule_code = v_rule.code;

  if v_booked + v_events > 0 then
    raise exception 'Diese Regel hat noch % Buchungen und % Termine – lege sie still statt sie zu löschen',
      v_booked, v_events;
  end if;

  delete from point_rules where id = p_rule_id;
end;
$$;

revoke execute on function public.delete_point_rule(uuid) from public, anon;
grant  execute on function public.delete_point_rule(uuid) to authenticated;
