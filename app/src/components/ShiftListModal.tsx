import { useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
  IonButtons,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { OVERLAP_SIGNAL, useReleaseShift, useTakeShift } from '../hooks/useShifts';
import { shiftCoverage } from '../lib/shift';
import { formatDateTime } from '../lib/format';
import { useToast } from '../hooks/useToast';
import type { Attendance, EventShift } from '../lib/database.types';

interface ShiftListProps {
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

  function takeShift(shiftId: string, acceptOverlap = false) {
    take.mutate(
      { shiftId, acceptOverlap },
      {
        onSuccess: () => {
          setOverlapShiftId(null);
          // Schritt 6: Die Punkte kommen erst mit der Bestätigung (BR-045).
          toast.success(t('shifts.taken'));
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

  return (
    <>
      {why && (
        <ListSection title={t('helperEvent.whyTitle')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">{why}</IonLabel>
          </IonItem>
        </ListSection>
      )}

      {error && <InlineError message={error} />}

      <ListSection
        title={t('helperEvent.shifts', { count: shifts.length })}
        footnote={t('shifts.pointsHint')}
      >
        {shifts.map((shift) => {
          const coverage = shiftCoverage(shift, attendance);
          const isOver = new Date(shift.ends_at) <= new Date();
          const mine = attendance.some(
            (entry) =>
              entry.shift_id === shift.id &&
              entry.member_id === memberId &&
              (entry.status === 'registered' || entry.status === 'present'),
          );

          return (
            <IonItem key={shift.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{shift.title}</h2>
                <IonNote>
                  {formatDateTime(shift.starts_at)} – {formatDateTime(shift.ends_at)}
                  {' · '}+{shift.points}
                </IonNote>
                <p>
                  {/* BR-041: die Unterdeckung, jederzeit sichtbar. */}
                  <IonBadge
                    color={coverage.isFull ? 'success' : 'tertiary'}
                    aria-label={t('agenda.shiftNeeded', {
                      filled: coverage.filled,
                      needed: coverage.needed,
                    })}
                  >
                    {coverage.filled}/{coverage.needed}
                  </IonBadge>
                </p>
              </IonLabel>

              {mine ? (
                // BR-047: Austragen ist jederzeit möglich – keine Sperrfrist.
                <IonButton
                  slot="end"
                  size="small"
                  fill="clear"
                  color="medium"
                  disabled={release.isPending}
                  onClick={() =>
                    release.mutate(shift.id, {
                      onSuccess: (result) =>
                        toast.success(
                          result.warned ? t('shifts.releasedWarned') : t('shifts.released'),
                        ),
                      onError: (cause) => toast.failure(cause.message),
                    })
                  }
                >
                  {t('shifts.release')}
                </IonButton>
              ) : (
                <IonButton
                  slot="end"
                  size="small"
                  fill="outline"
                  // BR-046: Eine volle Schicht nimmt niemanden mehr auf. Eine
                  // vergangene ebenso wenig – bei einem mehrtägigen Aufruf
                  // stünde die Schicht von gestern sonst weiter zur Wahl.
                  disabled={coverage.isFull || isOver || take.isPending}
                  onClick={() => takeShift(shift.id)}
                >
                  {isOver
                    ? t('shifts.over')
                    : coverage.isFull
                      ? t('shifts.full')
                      : t('shifts.take')}
                </IonButton>
              )}
            </IonItem>
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

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={props.onDismiss}
      presentingElement={presentingElement}
    >
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('shifts.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={props.onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <ShiftList {...props} />
      </IonContent>
    </IonModal>
  );
}
