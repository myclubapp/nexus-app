import { useId } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { QrCode } from './QrCode';
import { ListSection } from './ListSection';
import { EmptyState, ErrorState } from './StateViews';
import { SkeletonList } from './Skeletons';
import {
  useEventQrToken,
  useEventRoster,
  useMarkAttendance,
} from '../hooks/useCheckIn';
import { useToast } from '../hooks/useToast';
import { checkInErrorKey } from '../lib/checkInError';

interface EventQrProps {
  eventId: string;
}

/**
 * Den Check-in-Code anzeigen und die Anwesenheit erfassen (UC-014).
 *
 * Beides auf einem Blatt, weil beides derselbe Moment ist: Die Trainer:in hält
 * den Code hin, und wer nicht scannen kann, wird von ihr eingetragen (A6). Ein
 * zweiter Weg über eine andere Ansicht wäre ein Weg zu viel.
 *
 * Eigene Komponente ohne Blatt-Hülle, weil `IonModal` seinen Inhalt im Test
 * nicht rendert (docs/TESTING.md).
 */
export function EventQr({ eventId }: EventQrProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const token = useEventQrToken(eventId);
  const roster = useEventRoster(eventId);
  const mark = useMarkAttendance(eventId);

  const entries = roster.data ?? [];

  return (
    <>
      {token.isLoading ? (
        <SkeletonList />
      ) : token.error ? (
        // Die Meldungen der Datenbank sind deutsch und für Entwickler
        // geschrieben; übersetzt gehören sie auch hier (C-007).
        <ErrorState
          error={new Error(t(`checkIn.error.${checkInErrorKey(
            (token.error as Error).message,
          )}`))}
          onRetry={() => void token.refetch()}
        />
      ) : (
        // Der Code ist keine Listenzeile, sondern ein Bild – ein `IonItem`
        // darum wäre das Item als Allzweck-Container (ion-item: «should not
        // be used as a general purpose container»). Eigener Block, darunter
        // die Fussnote im selben Stil wie unter einer Liste.
        <>
          <div className="app-qr">
            {/* BR-055: Das Token gehört zu genau diesem Termin. */}
            <QrCode value={token.data ?? ''} label={t('checkIn.qrLabel')} />
          </div>
          <IonNote className="app-footnote">{t('checkIn.qrHint')}</IonNote>
        </>
      )}

      {/* A6: Wer nicht scannen kann, war deswegen nicht weniger anwesend. */}
      {roster.isLoading ? (
        <SkeletonList />
      ) : roster.error ? (
        <ErrorState
          error={new Error(t(`checkIn.error.${checkInErrorKey(
            (roster.error as Error).message,
          )}`))}
          onRetry={() => void roster.refetch()}
        />
      ) : entries.length === 0 ? (
        <EmptyState message={t('checkIn.rosterEmpty')} />
      ) : (
        <ListSection
          title={t('checkIn.roster', { count: entries.length })}
          footnote={t('checkIn.rosterHint')}
        >
          {entries.map((entry) => {
            const isPresent = entry.status === 'present';
            return (
              <IonItem key={entry.memberId}>
                <IonLabel className="ion-text-wrap">
                  <h2>{entry.displayName}</h2>
                  <IonNote>{t(`checkIn.status.${entry.status}`)}</IonNote>
                </IonLabel>
                <IonButton
                  slot="end"
                  size="small"
                  fill={isPresent ? 'solid' : 'outline'}
                  disabled={mark.isPending}
                  onClick={() =>
                    mark.mutate(
                      { memberId: entry.memberId, present: !isPresent },
                      {
                        onSuccess: (points) =>
                          toast.success(
                            isPresent
                              ? t('checkIn.unmarked')
                              : points > 0
                                ? t('checkIn.markedWithPoints', {
                                    name: entry.displayName,
                                    points,
                                  })
                                : t('checkIn.marked', { name: entry.displayName }),
                          ),
                        onError: (cause) =>
                          toast.failure(t(`checkIn.error.${checkInErrorKey(cause.message)}`)),
                      },
                    )
                  }
                >
                  {/* Zwei gegensätzliche Aktionen brauchen zwei Namen: «gefüllt
                      heisst zurücknehmen» erkennt niemand, der die App vorgelesen
                      bekommt (NFR-027). */}
                  {isPresent ? t('checkIn.unmark') : t('checkIn.markPresent')}
                </IonButton>
              </IonItem>
            );
          })}
        </ListSection>
      )}
    </>
  );
}

/** Blatt-Hülle; der Code entsteht erst beim Öffnen. */
export function EventQrModal({
  eventId,
  onDismiss,
}: {
  eventId: string | null;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  // Das Blatt ist ein `role="dialog"` und braucht einen Namen (ion-modal:
  // «developers must properly label their modals»); der Titel ist er.
  const titleId = useId();

  return (
    <IonModal
      isOpen={Boolean(eventId)}
      onDidDismiss={onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader translucent>
        <IonToolbar>
          {/* Schliessen steht links, wie in jedem Blatt (guidelines §2). */}
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {t('checkIn.showQr')}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        {eventId && <EventQr eventId={eventId} />}
      </IonContent>
    </IonModal>
  );
}
