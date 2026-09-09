-- ============================================================================
-- 0019_shift_points: Der Punktwert steht an der Schicht (BR-042)
--
-- 0018 hat `event_shifts.point_rule_code` verbindlich gemacht und damit die
-- halbe Regel umgesetzt: Jede Schicht weiss, *welcher* Säule ihr Einsatz
-- zählt. Was fehlt, ist der Wert selbst.
--
-- BR-042 verlangt ihn ausdrücklich pro Schicht, «weil ein halber Tag und ein
-- ganzer Tag unterschiedlich zählen», und UC-013 Schritt 4 bucht «den
-- Punktwert **der Schicht**». Mit nur einem Regelcode zählte jede Schicht
-- desselben Vereins gleich viel – ein halber Tag so viel wie ein ganzer.
--
-- Das Entitätsmodell führt für EVENT_SHIFT keine Spalte `points`; das ist eine
-- Lücke des Modells gegenüber der Regel, nicht eine Abweichung von ihr. Die
-- Schicht verhält sich damit wie eine Aufgabe: Sie trägt ihren Wert selbst,
-- und der Regelcode liefert nur die Säule fürs Reporting.
-- ============================================================================

alter table event_shifts add column if not exists points int;

-- Bestehende Schichten erben den Wert ihrer Regel, damit sich nichts
-- rückwirkend verschiebt.
update event_shifts s
   set points = coalesce(
     (select r.points
        from point_rules r
        join events e on e.id = s.event_id
       where r.club_id = e.club_id and r.code = s.point_rule_code),
     0
   )
 where s.points is null;

alter table event_shifts alter column points set not null;
alter table event_shifts alter column points set default 0;

-- BR-066 gilt auch hier: Eine Schicht bringt Punkte oder keine, nie negative.
alter table event_shifts drop constraint if exists event_shifts_points_check;
alter table event_shifts add constraint event_shifts_points_check
  check (points >= 0);
