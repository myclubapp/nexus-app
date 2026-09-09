import { useState } from 'react';
import {
  IonActionSheet,
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';
import { EmptyState, ErrorState, InlineSuccess } from './StateViews';
import { SkeletonList } from './Skeletons';
import {
  useConfirmShift,
  useSetShiftAbsence,
  useShiftCandidates,
  useShiftRoster,
} from '../hooks/useShiftRoster';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import type { EventShift } from '../lib/database.types';

interface ShiftRosterProps {
  shifts: EventShift[];
  onDismiss: () => void;
}

/**
 * Einsätze bestätigen (UC-013).
 *
 * Eine Schicht nach der anderen, weil die Bestätigung an der Schicht hängt:
 * Ihr Punktwert wird gebucht, und sie ist die Quelle, über die der Ledger
 * dedupliziert. Ein Blatt über alle Schichten hinweg verwischte genau das.
 *
 * Eigene Komponente ohne Blatt-Hülle, weil `IonModal` seinen Inhalt im Test
 * nicht rendert (docs/TESTING.md).
 */
export function ShiftRoster({ shifts, onDismiss }: ShiftRosterProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [shiftId, setShiftId] = useState<string | null>(shifts[0]?.id ?? null);
  // Schritt 6: die Zusammenfassung dessen, was gerade gebucht wurde.
  const [awarded, setAwarded] = useState(0);

  // A1 verlangt beides: auslassen **oder** als entschuldigt markieren.
  const [absenceFor, setAbsenceFor] = useState<string | null>(null);
  // A2: jemanden ergänzen, der mitgeholfen hat, ohne eingetragen zu sein.
  const [isAdding, setAdding] = useState(false);

  const shift = shifts.find((entry) => entry.id === shiftId);
  const roster = useShiftRoster(shiftId);
  const candidates = useShiftCandidates(shiftId);
  const confirm = useConfirmShift(shiftId);
  const absence = useSetShiftAbsence(shiftId);

  const entries = roster.data ?? [];

  function markAbsence(memberId: string, status: 'excused' | 'absent') {
    absence.mutate(
      { memberId, status },
      {
        onSuccess: () => toast.success(t('roster.markedAbsent')),
        onError: (cause) => toast.failure(cause.message),
      },
    );
    setAbsenceFor(null);
  }

  function confirmMember(memberId: string, name: string) {
    confirm.mutate(memberId, {
      onSuccess: (result) => {
        setAwarded((total) => total + result.points);
        toast.success(
          !result.booked
            ? t('roster.alreadyAwarded')
            : result.points > 0
              ? t('roster.awarded', { name, points: result.points })
              : // Nur-Dank: bestätigt, ohne Zahl. Das ist kein Fehlschlag.
                t('roster.confirmedNoPoints', { name }),
        );
      },
      onError: (cause) => toast.failure(cause.message),
    });
  }

  return (
    <>
      {/* Bei mehreren Schichten die Wahl; bei einer wäre sie Zierde. */}
      {shifts.length > 1 && (
        <IonSegment
          value={shiftId ?? undefined}
          onIonChange={(e) => {
            setShiftId(String(e.detail.value));
            setAwarded(0);
          }}
        >
          {shifts.map((entry) => (
            <IonSegmentButton key={entry.id} value={entry.id}>
              <IonLabel>{entry.title}</IonLabel>
            </IonSegmentButton>
          ))}
        </IonSegment>
      )}

      {shift && (
        <ListSection footnote={t('roster.hint')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <h2>{shift.title}</h2>
              <IonNote>
                {formatDateTime(shift.starts_at)} – {formatDateTime(shift.ends_at)}
                {' · '}+{shift.points}
              </IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {roster.isLoading ? (
        <SkeletonList />
      ) : roster.error ? (
        <ErrorState error={roster.error as Error} onRetry={() => void roster.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState message={t('roster.empty')} />
      ) : (
        <ListSection title={t('roster.registered', { count: entries.length })}>
          {entries.map((entry) => (
            <IonItem key={entry.memberId}>
              <IonLabel className="ion-text-wrap">
                <h2>{entry.displayName}</h2>
                <IonNote>{t(`roster.status.${entry.status}`)}</IonNote>
              </IonLabel>

              {entry.confirmed ? (
                // BR-052: Eine Bestätigung wird nicht zurückgenommen, sondern
                // durch eine Gegenbuchung korrigiert (UC-021).
                <IonNote slot="end" color="success">
                  {t('roster.confirmed')}
                </IonNote>
              ) : (
                <IonButtons slot="end">
                  <IonButton
                    size="small"
                    fill="outline"
                    disabled={confirm.isPending}
                    onClick={() => confirmMember(entry.memberId, entry.displayName)}
                  >
                    {t('roster.confirm')}
                  </IonButton>
                  {/* A1: nicht erschienen – kein Punkt, aber ein Status.
                      Entschuldigt oder abwesend ist ein Unterschied, den die
                      Spezifikation macht, also macht ihn auch das Blatt. */}
                  <IonButton
                    size="small"
                    fill="clear"
                    color="medium"
                    disabled={absence.isPending}
                    onClick={() => setAbsenceFor(entry.memberId)}
                  >
                    {t('roster.notThere')}
                  </IonButton>
                </IonButtons>
              )}
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* Schritt 6 */}
      {awarded > 0 && <InlineSuccess message={t('roster.summary', { points: awarded })} />}

      {/* A2: Wer mitgeholfen hat, ohne eingetragen zu sein, wird eingetragen
          und bestätigt in einem Schritt. */}
      <div className="app-actions">
        <IonButton
          expand="block"
          fill="outline"
          disabled={(candidates.data ?? []).length === 0}
          onClick={() => setAdding(true)}
        >
          {t('roster.add')}
        </IonButton>
        <IonNote>{t('roster.addHint')}</IonNote>
      </div>

      <IonActionSheet
        isOpen={absenceFor !== null}
        header={t('roster.absenceTitle')}
        onDidDismiss={() => setAbsenceFor(null)}
        buttons={[
          {
            text: t('roster.status.excused'),
            handler: () => {
              if (absenceFor) markAbsence(absenceFor, 'excused');
            },
          },
          {
            text: t('roster.status.absent'),
            handler: () => {
              if (absenceFor) markAbsence(absenceFor, 'absent');
            },
          },
          { text: t('common.cancel'), role: 'cancel' },
        ]}
      />

      <IonAlert
        isOpen={isAdding}
        header={t('roster.add')}
        onDidDismiss={() => setAdding(false)}
        inputs={(candidates.data ?? []).map((candidate) => ({
          type: 'radio' as const,
          label: candidate.displayName,
          value: candidate.memberId,
        }))}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('roster.confirm'),
            handler: (memberId: string) => {
              const candidate = (candidates.data ?? []).find(
                (entry) => entry.memberId === memberId,
              );
              if (candidate) confirmMember(candidate.memberId, candidate.displayName);
            },
          },
        ]}
      />

      <div className="app-actions">
        <IonButton expand="block" fill="clear" onClick={onDismiss}>
          {t('common.close')}
        </IonButton>
      </div>
    </>
  );
}

/** Blatt-Hülle; der Inhalt entsteht erst beim Öffnen. */
export function ShiftRosterModal({
  isOpen,
  ...props
}: ShiftRosterProps & { isOpen: boolean }) {
  const { t } = useTranslation();

  return (
    <IonModal isOpen={isOpen} onDidDismiss={props.onDismiss}>
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('roster.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={props.onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {isOpen && <ShiftRoster {...props} />}
      </IonContent>
    </IonModal>
  );
}
