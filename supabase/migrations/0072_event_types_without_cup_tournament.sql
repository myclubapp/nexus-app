-- ============================================================================
-- 0072_event_types_without_cup_tournament: Cup und Turnier entfallen
--
-- Entscheid vom 2026-09-12: Die Terminarten «Cup» und «Turnier» haben sich
-- gegenüber «Spiel» nie unterschieden – gleiche Punkteregel (match_attend),
-- gleicher Check-in-Kontext, gleiche Antwortlogik. Als Filter in der Agenda
-- waren sie nur Rauschen. Ein Wettbewerb ist ein `match`; der Verein nennt
-- ihn über `clubs.settings.labels`, wie er will.
--
-- Vier Stellen kennen die beiden Werte: der Check-Constraint (0015), die
-- Standardlabels je Vereinsart (0008), der Check-in-Kontext (0050) und die
-- gespeicherten Labels der bestehenden Vereine.
-- ============================================================================

-- Bestehende Termine werden zu Spielen, bevor der Constraint sie verböte.
update public.events
   set type = 'match'
 where type in ('cup', 'tournament');

alter table public.events drop constraint if exists events_type_check;
alter table public.events add constraint events_type_check
  check (type in ('training','match','gv','social','helper','meeting'));

-- Gespeicherte Labels: Die beiden Schlüssel verschwinden aus den
-- Vereinseinstellungen, sonst zeigt sie die Einstellungsseite als Leichen.
update public.clubs
   set settings = jsonb_set(
         settings,
         '{labels}',
         (settings -> 'labels') - 'cup' - 'tournament'
       )
 where settings -> 'labels' ? 'cup'
    or settings -> 'labels' ? 'tournament';

-- ---------------------------------------------------------------------------
-- Standard-Terminlabels je Vereinsart, ohne Cup und Turnier (Fassung 0008).
-- ---------------------------------------------------------------------------
create or replace function public.default_event_labels(p_club_kind text)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_club_kind
    when 'music' then jsonb_build_object(
      'training',   'Probe',
      'match',      'Konzert',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    when 'culture' then jsonb_build_object(
      'training',   'Probe',
      'match',      'Aufführung',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    when 'youth' then jsonb_build_object(
      'training',   'Gruppenstunde',
      'match',      'Aktion',
      'gv',         'Vereinsversammlung',
      'social',     'Anlass',
      'helper',     'Helfereinsatz'
    )
    when 'neighborhood' then jsonb_build_object(
      'training',   'Treffen',
      'match',      'Aktion',
      'gv',         'Versammlung',
      'social',     'Anlass',
      'helper',     'Helfereinsatz'
    )
    when 'sport' then jsonb_build_object(
      'training',   'Training',
      'match',      'Spiel',
      'gv',         'Generalversammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
    else jsonb_build_object(
      'training',   'Treffen',
      'match',      'Anlass',
      'gv',         'Versammlung',
      'social',     'Vereinsanlass',
      'helper',     'Helfereinsatz'
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- Check-in-Kontext (Fassung 0050): Der Wettkampf heisst nur noch `match`.
-- ---------------------------------------------------------------------------
create or replace function public.checkin_context(
  p_event_type text,
  p_status     text,
  p_shift_id   uuid
)
returns text
language sql
immutable
as $$
  select case
    -- Ein Helfereinsatz ist an der Schicht erkennbar, unabhängig vom Typ.
    when p_shift_id is not null and p_status in ('present','substitute')
      then 'helper_shift'
    when p_event_type = 'helper' and p_status in ('present','substitute')
      then 'helper_shift'
    when p_event_type = 'match' and p_status = 'substitute'
      then 'match_bench'
    when p_event_type = 'match' and p_status = 'present'
      then 'match_lineup'
    when p_event_type in ('training','gv','social') and p_status = 'present'
      then 'training_attended'
    else null
  end;
$$;
