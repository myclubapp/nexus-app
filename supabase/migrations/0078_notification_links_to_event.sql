-- ============================================================================
-- 0078_notification_links_to_event: Eine Nachricht über einen Termin führt zum
-- Termin, nicht in die Agenda
--
-- `cancel_event()` und `announce_event()` legten seit 0015 den Verweis
-- `/tabs/agenda` ab – den Pfad der **Liste**. Die Absage einer
-- Vorstandssitzung führte damit in den Agenda-Tab, wo die abgesagte Sitzung
-- erst gesucht werden musste. Die Erinnerung an Unentschlossene macht es seit
-- 0031 richtig: `/tabs/agenda?event=<id>`.
--
-- Seit der Inbox-Änderung vom 2026-09-13 hängt mehr daran als die Bequemlichkeit:
-- Die App liest am Pfad (`linkTarget()` in `src/lib/linkTarget.ts`), ob eine
-- Nachricht einen einzelnen Gegenstand meint. Trägt sie eine Kennung, öffnet
-- sich der Termin als Blatt über der Inbox; trägt sie keine, bleibt es beim
-- Tab-Wechsel. Ohne die Kennung wirkt die neue Bedienung deshalb wie kaputt –
-- genau bei den beiden häufigsten Terminnachrichten.
--
-- Nur der Verweis ändert sich. Beide Fassungen sind sonst wortgleich zu 0073,
-- damit ein Diff zeigt, dass nichts anderes mitgewandert ist.
--
-- Offen bleibt `release_shift()`: Die Warnung «Schicht ist unterbesetzt» führt
-- weiterhin nach `/tabs/agenda`. Die Funktion wird gerade an anderer Stelle
-- umgebaut (0077); der Verweis gehört dort nachgezogen.
-- ============================================================================

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

  -- Der Grund erreicht alle Betroffenen, nicht nur die Zugesagten.
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
      'Abgesagt: ' || v_event.title,
      v_reason, '/tabs/agenda?event=' || p_event_id, v_event.club_id
    );
  end loop;
end;
$$;

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
  if coalesce(jsonb_array_length(v_event.audience_role_ids), 0) > 0 then
    for v_person in
      select * from committee_members(v_event.club_id, v_event.audience_role_ids)
    loop
      perform notify(
        v_person.user_id, 'event', v_event.title,
        to_char(v_event.starts_at at time zone 'Europe/Zurich', 'DD.MM.YYYY HH24:MI'),
        '/tabs/agenda?event=' || p_event_id, v_event.club_id);
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
      '/tabs/agenda?event=' || p_event_id, v_event.club_id
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Der Altbestand (Entscheid 2026-09-13).
--
-- Eine Benachrichtigung merkt sich ihre Quelle nicht – `notifications` hat
-- keine `source_id`. Der Termin lässt sich deshalb nur über das
-- wiedererkennen, was `announce_event()` und `cancel_event()` hineingeschrieben
-- haben: den Titel und, je nach Fall, den formatierten Beginn oder den
-- Absagegrund.
--
-- Text allein reicht nicht. Wer eine Sitzung absagt und gleich eine neue mit
-- demselben Titel zur selben Zeit ansetzt, hat zwei Termine, auf die derselbe
-- Text passt – der Fall steht so in den Daten. Deshalb zählt die Zeit mit:
-- Die Nachricht entsteht in derselben Routine wie der Termin, also kommt nur
-- ein Termin in Frage, den es beim Schreiben schon gab (`e.created_at <=
-- n.created_at`), und von diesen der zuletzt angelegte. Für die Absage von
-- heute ist das die abgesagte Sitzung, für die Ankündigung von heute die neue.
--
-- Bleibt eine Zeile ohne Treffer – ein gelöschter Termin, ein Titel, der sich
-- seither geändert hat –, behält sie ihren Verweis und wechselt weiterhin den
-- Tab. Das ist der bisherige Stand, nicht ein Blatt mit dem falschen Termin.
-- ---------------------------------------------------------------------------
with match as (
  select distinct on (n.id)
         n.id as notification_id,
         e.id as event_id
    from notifications n
    join events e
      on e.club_id = n.club_id
     -- Ein Termin, den es beim Schreiben der Nachricht noch nicht gab, kann
     -- nicht gemeint sein.
     and e.created_at <= n.created_at
     and (
           -- `announce_event()`: Titel des Termins, Beginn im Text.
           (n.title = e.title
            and n.body = to_char(e.starts_at at time zone 'Europe/Zurich',
                                 'DD.MM.YYYY HH24:MI'))
           -- `cancel_event()`: «Abgesagt: …» und der Grund im Text.
        or (n.title = 'Abgesagt: ' || e.title
            and e.cancelled_at is not null
            and n.body is not distinct from e.cancelled_reason)
         )
   where n.category = 'event'
     and n.link = '/tabs/agenda'
   order by n.id, e.created_at desc
)
update notifications n
   set link = '/tabs/agenda?event=' || m.event_id
  from match m
 where n.id = m.notification_id;
