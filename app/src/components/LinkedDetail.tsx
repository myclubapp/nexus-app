import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeclineModal } from './DeclineModal';
import { EventDetailModal } from './EventDetailModal';
import { ShiftListModal } from './ShiftListModal';
import { TaskDetailModal } from './TaskDetailModal';
import { useClub } from '../hooks/useClub';
import { useMembers } from '../hooks/useMembers';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { useRespondToEvent, type AgendaEvent } from '../hooks/useAgenda';
import { useToast } from '../hooks/useToast';
import { shiftCoverage } from '../lib/shift';
import type { TaskWithAssignments } from '../lib/task';

interface LinkedDetailProps {
  /** Der Termin, den der Verweis meint – `null`, wenn keiner offen ist. */
  event: AgendaEvent | null;
  /** Die Aufgabe, die der Verweis meint – `null`, wenn keine offen ist. */
  task: TaskWithAssignments | null;
  /** Beide schliessen: Es ist immer höchstens eines offen. */
  onDismiss: () => void;
}

/**
 * Termin und Aufgabe als Blatt über der Seite, die auf sie verweist.
 *
 * Eine Nachricht in der Inbox zeigt auf einen einzelnen Gegenstand
 * (`linkTarget()`). Ihn im fremden Tab zu öffnen hiesse: Tab-Wechsel,
 * fremder Verlauf, und der Weg zurück in die Inbox muss gesucht werden.
 * Ionic empfiehlt für Inhalt quer über Tabs ausdrücklich das Modal – die
 * Startseite macht es seit UC-037 so, und hier steht dasselbe Bündel.
 *
 * Es ist ein Bündel und nicht ein Blatt, weil Absagen (UC-010 A1) über ein
 * zweites Blatt läuft: Das Detail schliesst, der Grund wird erfasst, die
 * Antwort geht raus. Wer nur `EventDetailModal` einhängt, hat einen Weg, der
 * ins Leere führt.
 */
export function LinkedDetail({ event, task, onDismiss }: LinkedDetailProps) {
  const { t } = useTranslation();
  const { activeMembership, eventLabel } = useClub();
  // C-032: Wer für das Team des Termins plant, sieht darin die Wege des
  // Planens – dieselbe Frage wie in Agenda und Startseite.
  const scope = usePlanningScope();
  const members = useMembers();
  const respond = useRespondToEvent();
  const toast = useToast();

  const [declining, setDeclining] = useState<{ id: string; startsAt: string } | null>(null);
  // UC-012: Bei einem Helfer-Event ist die Schicht die Antwort (BR-196). Ohne
  // diesen Weg wäre das Blatt dort eine Sackgasse – kein «Mein Status», und
  // die Schichten unerreichbar.
  //
  // Nur ein Schalter, nicht der Termin selbst: Das Schicht-Blatt liest ihn
  // weiter aus der Abfrage und zeigt nach einer Übernahme den neuen Stand.
  // Ein `onDismiss()` beim Öffnen nähme ihm die Daten unter den Füssen weg.
  const [shiftsOpen, setShiftsOpen] = useState(false);

  // Dieselbe Grundgesamtheit wie in der Agenda: Wer kein Anmeldekonto hat,
  // lässt sich nicht erreichen und zählt im Detail nicht als «keine Antwort».
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status !== 'left' && m.user_id !== null,
  );
  // Betroffen ist bei einem Team-Termin nur dieses Team, sonst der Verein.
  const affected = event?.team_id
    ? activeMembers.filter((m) => m.teamIds.includes(event.team_id!))
    : activeMembers;

  // BR-041: die Besetzung, und zwar richtig gezählt – eine Absage belegt
  // keinen Platz. Dieselbe Rechnung wie in der Agenda.
  const coverage = (event?.shifts ?? []).map((shift) =>
    shiftCoverage(shift, event?.attendance ?? []),
  );
  const shiftsNeeded = coverage.reduce((sum, c) => sum + c.needed, 0);
  const shiftsFilled = coverage.reduce((sum, c) => sum + c.filled, 0);
  const hasShifts =
    event !== null &&
    shiftsNeeded > 0 &&
    event.published_at !== null &&
    event.cancelled_at === null;

  return (
    <>
      {/* Dasselbe Blatt wie in der Agenda (UC-010): Der Termin sieht überall
          gleich aus. Die Wege des Planens bleiben in der Agenda – hier steht
          der Termin zum Lesen und Antworten.

          `shiftsOpen` schliesst das Detail, statt das Schicht-Blatt darüber
          zu legen: Ein Blatt über einem Blatt nähme das darüberliegende Modal
          als Bezug, und `usePresentingElement()` liefert das äussere Outlet.
          Die Agenda macht es mit `leaveDetailFor()` genauso. */}
      <EventDetailModal
        event={shiftsOpen ? null : event}
        members={event ? affected : []}
        memberId={
          // Antworten kann nur, wen der Termin betrifft: ein Vereinstermin
          // jeden, ein Team-Termin die eigenen Teams.
          event && (event.team_id === null || scope.myTeamIds.includes(event.team_id))
            ? (activeMembership?.id ?? null)
            : null
        }
        isTrainer={event ? scope.canPlanFor(event.team_id) : false}
        eventLabel={eventLabel}
        shiftCoverage={hasShifts ? { filled: shiftsFilled, needed: shiftsNeeded } : null}
        onOpenShifts={hasShifts ? () => setShiftsOpen(true) : undefined}
        onDecline={() => {
          if (!event) return;
          onDismiss();
          setDeclining({ id: event.id, startsAt: event.starts_at });
        }}
        onDismiss={onDismiss}
      />

      {/* UC-010 A1: Absagen mit Grund – derselbe Weg wie in der Agenda. */}
      <DeclineModal
        isOpen={declining !== null}
        startsAt={declining?.startsAt ?? ''}
        isSubmitting={respond.isPending}
        error={respond.error ? (respond.error as Error).message : null}
        onDismiss={() => setDeclining(null)}
        onSubmit={(reason) => {
          if (!declining) return;
          respond.mutate(
            { eventId: declining.id, status: 'excused', reason },
            {
              onSuccess: (result) => {
                setDeclining(null);
                toast.success(
                  result.pointsAwarded > 0
                    ? t('agenda.declinedWithPoints', { points: result.pointsAwarded })
                    : t('agenda.declined'),
                );
              },
            },
          );
        }}
      />

      {/* UC-012 Schritt 2: die Schichten – derselbe Weg wie in der Agenda. */}
      <ShiftListModal
        isOpen={shiftsOpen}
        eventTitle={event?.title ?? ''}
        location={event?.location ?? null}
        why={event?.why ?? null}
        shifts={event?.shifts ?? []}
        attendance={event?.attendance ?? []}
        memberId={activeMembership?.id ?? null}
        onDismiss={() => {
          // Zurück in die Liste, nicht ins Detail – derselbe Weg wie in der
          // Agenda, wo `leaveDetailFor()` das Detail nicht wieder aufmacht.
          setShiftsOpen(false);
          onDismiss();
        }}
      />

      {/* Dasselbe Blatt wie im Marktplatz (UC-018). */}
      <TaskDetailModal
        task={task}
        onDismiss={onDismiss}
        onDone={(outcome, warned) => {
          onDismiss();
          if (outcome === 'claimed') {
            toast.success(t('marketplace.claimed'));
          } else if (outcome === 'submitted') {
            toast.success(t('taskDetail.reported'));
          } else {
            toast.success(t(warned ? 'taskDetail.releasedWarned' : 'taskDetail.released'));
          }
        }}
      />
    </>
  );
}
