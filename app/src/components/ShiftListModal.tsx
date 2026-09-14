import { useId, useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
  IonButtons,
} from '@ionic/react';
import { calendarOutline, checkmarkCircle, closeCircle } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { AttendanceStatusIcon } from './AttendanceStatusIcon';
import { ListSection } from './ListSection';
import { TextSection } from './TextSection';
import { InlineError } from './StateViews';
import { OVERLAP_SIGNAL, useReleaseShift, useTakeShift } from '../hooks/useShifts';
import { shiftCoverage } from '../lib/shift';
import { formatDateTime } from '../lib/format';
import { addToDeviceCalendar, shiftCalendarEntry } from '../lib/calendar';
import { closeSliding } from '../lib/sliding';
import { useToast } from '../hooks/useToast';
import type { Attendance, AttendanceStatus, EventShift } from '../lib/database.types';

/**
 * Der Name des eigenen Stands an einer Schicht – für Bedienhilfen, und bei
 * den antippbaren Ständen mit dem Hinweis, was ein Tippen auslöst.
 *
 * Die Zuordnung steht neben der Ampel des Termins (`agenda.statusLabel`),
 * heisst aber anders: Eine Schicht wird übernommen, nicht zugesagt.
 */
function shiftStatusKey({
  status,
  isLocked,
  isOver,
  isFull,
}: {
  status: AttendanceStatus | null;
  isLocked: boolean;
  isOver: boolean;
  isFull: boolean;
}): string {
  if (status === 'present') return 'confirmed';
  if (status === 'absent') return 'absent';
  if (status === 'registered') return 'taken';
  if (status === 'excused') return isLocked ? 'declinedFinal' : 'declined';
  if (isOver) return 'over';
  if (isFull) return 'full';
  return 'open';
}

interface ShiftListProps {
  /** Der Anlass, zu dem die Schichten gehören – für den Kalendereintrag (FR-156). */
  eventTitle: string;
  location: string | null;
  /** Das Warum des Aufrufs – Schritt 2 nennt es vor den Schichten. */
  why: string | null;
  shifts: EventShift[];
  attendance: Attendance[];
  /** Die eigene Mitgliedschaft; entscheidet, welche Schicht «meine» ist. */
  memberId: string | null;
}

/**
 * Die Schichten eines Helfer-Events (UC-012, Schritt 2).
 *
 * Zuerst das Warum, dann die Schichten: Wer weiss, wozu ein Einsatz dient,
 * entscheidet anders als wer nur eine Lücke sieht (K3a, FR-051). Deshalb
 * steht es oben und nicht als Fussnote.
 *
 * Eigene Komponente ohne die Blatt-Hülle, weil `IonModal` seinen Inhalt im
 * Test nicht rendert (docs/TESTING.md).
 */
export function ShiftList({
  eventTitle,
  location,
  why,
  shifts,
  attendance,
  memberId,
}: ShiftListProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const take = useTakeShift();
  const release = useReleaseShift();
  // A4: Die Überschneidung ist eine Rückfrage, kein Verbot.
  const [overlapShiftId, setOverlapShiftId] = useState<string | null>(null);

  const error =
    (take.error as Error | null)?.message === OVERLAP_SIGNAL
      ? null
      : ((take.error as Error | null)?.message ??
        (release.error as Error | null)?.message ??
        null);

  // FR-156: Die Schicht dem Kalender des Geräts anbieten – nach dem Eintrag
  // von selbst, danach über das Symbol an der Zeile. Der Eintrag in der
  // Schicht steht davor und bleibt, was die Person im Blatt des Systems auch
  // wählt (BR-187).
  function offerCalendar(shift: EventShift) {
    void addToDeviceCalendar(
      shiftCalendarEntry(shift, { title: eventTitle, location, why }),
    ).catch(() => toast.failure(t('agenda.calendarFailed')));
  }

  function takeShift(shiftId: string, acceptOverlap = false) {
    take.mutate(
      { shiftId, acceptOverlap },
      {
        onSuccess: () => {
          setOverlapShiftId(null);
          // Schritt 6: Die Punkte kommen erst mit der Bestätigung (BR-045).
          toast.success(t('shifts.taken'));
          const shift = shifts.find((entry) => entry.id === shiftId);
          if (shift) offerCalendar(shift);
        },
        onError: (cause) => {
          if (cause.message === OVERLAP_SIGNAL) {
            setOverlapShiftId(shiftId);
            return;
          }
          toast.failure(cause.message);
        },
      },
    );
  }

  /**
   * Absagen (A2, BR-047). Seit 0077 hält der Server die Absage als `excused`
   * fest, statt die Zeile zu löschen – auch für jemanden, der nie eingetragen
   * war. Nur wer eingetragen **war**, gibt dabei einen Platz zurück; nur dann
   * spricht die Meldung von einem frei gewordenen Platz.
   */
  function declineShift(shiftId: string, wasRegistered: boolean) {
    release.mutate(shiftId, {
      onSuccess: (result) =>
        toast.success(
          !wasRegistered
            ? t('shifts.declined')
            : result.warned
              ? t('shifts.releasedWarned')
              : t('shifts.released'),
        ),
      onError: (cause) => toast.failure(cause.message),
    });
  }

  return (
    <>
      {/* Das Warum ist Fliesstext, keine Listenzeile – ein Item mit einem
          Absatz darin hätte sein Format verloren (Befund 13). */}
      {why && (
        <TextSection title={t('helperEvent.whyTitle')} preserveLines>
          {why}
        </TextSection>
      )}

      {error && <InlineError message={error} />}

      <ListSection
        title={t('helperEvent.shifts', { count: shifts.length })}
        footnote={t('shifts.pointsHint')}
      >
        {shifts.map((shift) => {
          const coverage = shiftCoverage(shift, attendance);
          const isOver = new Date(shift.ends_at) <= new Date();
          // Der eigene Eintrag, nicht nur «bin ich drin»: Der Vorstand hält in
          // der Einsatzliste auch fest, wer entschuldigt war oder gefehlt hat
          // (`useSetShiftAbsence`). Dann gehört das rote Kreuz an die Zeile
          // und nicht das gelbe «noch offen».
          const own =
            attendance.find(
              (entry) => entry.shift_id === shift.id && entry.member_id === memberId,
            ) ?? null;
          const status = own?.status ?? null;
          const mine = status === 'registered' || status === 'present';
          // BR-046: Eine volle Schicht nimmt niemanden mehr auf, eine
          // vergangene ebenso wenig – bei einem mehrtägigen Aufruf stünde die
          // Schicht von gestern sonst weiter zur Wahl. Ein bestätigter Einsatz
          // wiederum lässt sich nicht zurücknehmen (`release_shift`). In all
          // diesen Fällen gibt es nichts zu entscheiden: Der Stand steht da,
          // aber weder Tippen noch Wischen ändert ihn.
          const isLocked =
            status === 'present' ||
            status === 'absent' ||
            (!mine && (coverage.isFull || isOver));
          const busy = take.isPending || release.isPending;
          const statusLabel = t(
            `shifts.statusLabel.${shiftStatusKey({
              status,
              isLocked,
              isOver,
              isFull: coverage.isFull,
            })}`,
          );

          return (
            <IonItemSliding key={shift.id}>
              <IonItem>
                {/* Derselbe Stand wie am Termin: das Ampel-Symbol am
                    Zeilenanfang, und ein Tippen darauf schaltet um. Die Zeile
                    ist kein `button` – der Knopf darin ist deshalb erlaubt,
                    und er ist der Weg, den Tastatur und Bedienhilfen nehmen
                    (die Wischgeste erreichen sie nicht). */}
                <AttendanceStatusIcon
                  slot="start"
                  status={status}
                  isLocked={isLocked}
                  label={statusLabel}
                  disabled={busy}
                  onToggle={(next) =>
                    next === 'registered'
                      ? takeShift(shift.id)
                      : declineShift(shift.id, mine)
                  }
                />
                <IonLabel className="ion-text-wrap">
                  <h2>{shift.title}</h2>
                  <IonNote>
                    {formatDateTime(shift.starts_at)} – {formatDateTime(shift.ends_at)}
                    {' · '}+{shift.points}
                  </IonNote>
                </IonLabel>

                {mine && !isOver && (
                  <IonButton
                    slot="end"
                    size="small"
                    fill="clear"
                    aria-label={t('agenda.addToCalendar')}
                    onClick={() => offerCalendar(shift)}
                  >
                    <IonIcon slot="icon-only" icon={calendarOutline} aria-hidden="true" />
                  </IonButton>
                )}

                {/* BR-041: die Unterdeckung, jederzeit sichtbar – rechts am
                    Zeilenende wie die Zahlen der Agenda, im Badge nur die
                    Zahl und der Wortlaut für Bedienhilfen. */}
                <IonBadge
                  slot="end"
                  color={coverage.isFull ? 'success' : 'tertiary'}
                  aria-label={t('agenda.shiftNeeded', {
                    filled: coverage.filled,
                    needed: coverage.needed,
                  })}
                >
                  {coverage.filled}/{coverage.needed}
                </IonBadge>
              </IonItem>

              {/* Übernehmen und Absagen durch Wischen nach rechts, wie die Zu-
                  und Absage in der Agenda: grün der Haken, rot das Kreuz – und
                  nur die Antwort, die der aktuelle Stand noch offen lässt. Die
                  Option trägt den Namen, das Symbol ist Schmuck. */}
              {!isLocked && (
                <IonItemOptions side="start">
                  {!mine && (
                    <IonItemOption
                      color="success"
                      aria-label={t('shifts.take')}
                      disabled={take.isPending}
                      onClick={(e) => {
                        closeSliding(e);
                        takeShift(shift.id);
                      }}
                    >
                      <IonIcon slot="icon-only" icon={checkmarkCircle} aria-hidden="true" />
                    </IonItemOption>
                  )}
                  {/* BR-047: Austragen ist jederzeit möglich – keine Sperrfrist.
                      Und wer nie eingetragen war, sagt hier ab, statt die Frage
                      offen zu lassen. */}
                  {status !== 'excused' && (
                    <IonItemOption
                      color="danger"
                      aria-label={t('shifts.release')}
                      disabled={release.isPending}
                      onClick={(e) => {
                        closeSliding(e);
                        declineShift(shift.id, mine);
                      }}
                    >
                      <IonIcon slot="icon-only" icon={closeCircle} aria-hidden="true" />
                    </IonItemOption>
                  )}
                </IonItemOptions>
              )}
            </IonItemSliding>
          );
        })}
      </ListSection>

      {/* A4: nachfragen statt abweisen – die Person kennt ihren Tag besser. */}
      <IonAlert
        isOpen={overlapShiftId !== null}
        header={t('shifts.overlapTitle')}
        message={t('shifts.overlapMessage')}
        onDidDismiss={() => setOverlapShiftId(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('shifts.overlapConfirm'),
            handler: () => {
              if (overlapShiftId) takeShift(overlapShiftId, true);
            },
          },
        ]}
      />
    </>
  );
}

/**
 * Blatt-Hülle. Kein `FormModal`: Hier wird nichts erfasst und nichts
 * bestätigt – jede Schicht trägt ihre eigene Aktion.
 */
export function ShiftListModal({
  isOpen,
  ...props
}: ShiftListProps & { isOpen: boolean; onDismiss: () => void }) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  // Das Blatt ist ein `role="dialog"` und braucht einen Namen (ion-modal:
  // «developers must properly label their modals»); der Titel ist er.
  const titleId = useId();

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={props.onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader translucent>
        <IonToolbar>
          {/* Schliessen steht links, wie in jedem Blatt (guidelines §2). */}
          <IonButtons slot="start">
            <IonButton onClick={props.onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {t('shifts.title')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <ShiftList {...props} />
      </IonContent>
    </IonModal>
  );
}
