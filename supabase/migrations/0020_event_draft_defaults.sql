-- ============================================================================
-- 0020_event_draft_defaults: Der Entwurf bleibt die Ausnahme (Nachtrag zu 0018)
--
-- 0018 hat `events.published_at` eingeführt und die Lese-Policy daran
-- gehängt: Was keinen Zeitstempel trägt, ist ein Entwurf und für Mitglieder
-- unsichtbar (A2). Die Spalte bekam aber **keinen Vorgabewert**, und der
-- gewöhnliche Weg aus UC-009 setzt sie nicht. Seither entstand jeder neu
-- erfasste Termin als unsichtbarer Entwurf – FR-021, FR-022 und FR-024 waren
-- damit gebrochen, ohne dass eine Fehlermeldung darauf hingewiesen hätte.
--
-- Richtig herum ist die Vorgabe umgekehrt: Ein Termin ist ausgeschrieben,
-- sofern nicht ausdrücklich anders gewollt. Der Entwurf ist der bewusste
-- Sonderfall, den UC-011 mit `published_at => null` selbst wählt.
-- ============================================================================

alter table events alter column published_at set default now();

-- Was zwischen 0018 und hier angelegt wurde, war nie als Entwurf gemeint.
-- Helfer-Events bleiben ausgenommen: Dort ist der Entwurf gewollt.
update events
   set published_at = created_at
 where published_at is null
   and type <> 'helper';

-- ---------------------------------------------------------------------------
-- BR-043 greift am publizierten Event, nicht am Entwurf.
--
-- Die Regel heisst «Warum ist **Publikations**voraussetzung»: «Ein Aufruf ohne
-- Sinnzusammenhang kann nicht publiziert werden.» Der Constraint aus 0015 las
-- sie strenger und verlangte das Warum schon beim Anlegen – womit A2 im
-- Widerspruch zum Schema stand: Wer die Angaben halb erfasst und «Entwurf
-- sichern» wählt, bekam eine Constraint-Verletzung statt eines Entwurfs.
--
-- 0018 hatte die Prüfung in `publish_event()` bereits mit der Begründung
-- wiederholt, «weil ein Entwurf ohne Warum bis hierher kommen darf» – nur
-- liess der Constraint ihn gar nicht erst entstehen. Die Regel bleibt
-- vollständig erzwungen, sie greift nur an der richtigen Stelle: am
-- publizierten Event und beim Publizieren selbst.
-- ---------------------------------------------------------------------------
alter table events drop constraint if exists events_why_check;
alter table events add constraint events_why_check
  check (
    published_at is null
    or type not in ('helper','gv','social')
    or is_sample
    or coalesce(trim(why), '') <> ''
  );
