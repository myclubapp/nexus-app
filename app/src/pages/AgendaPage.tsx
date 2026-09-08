import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useAgenda, useRespondToEvent } from '../hooks/useAgenda';
import { useClub } from '../hooks/useClub';
import { AppPage } from '../components/AppPage';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import { CheckInModal } from '../components/CheckInModal';
import { EventFormModal } from '../components/EventFormModal';

type Range = 'upcoming' | 'past';

export function AgendaPage() {
  const { t } = useTranslation();
  const { activeMembership, eventLabel, isTrainer } = useClub();
  const toast = useToast();
  const [range, setRange] = useState<Range>('upcoming');
  const [checkInEventId, setCheckInEventId] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);

  const agenda = useAgenda(range);
  const respond = useRespondToEvent();
  const events = agenda.data ?? [];

  return (
    <AppPage
      title={t('agenda.title')}
      toolbarEnd={
        // BR-033: Termine erfassen Trainer:innen und der Vorstand.
        isTrainer ? (
          <IonButtons slot="end">
            <IonButton onClick={() => setFormOpen(true)}>
              <IonIcon
                slot="icon-only"
                icon={addOutline}
                aria-label={t('eventForm.title')}
              />
            </IonButton>
          </IonButtons>
        ) : undefined
      }
      subToolbar={
        <IonSegment
          value={range}
          onIonChange={(e) => setRange(e.detail.value as Range)}
        >
          <IonSegmentButton value="upcoming">
            <IonLabel>{t('agenda.upcoming')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="past">
            <IonLabel>{t('agenda.past')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      }
      onRefresh={() => agenda.refetch()}
    >
      {agenda.isLoading ? (
        <SkeletonList />
      ) : agenda.error ? (
        <ErrorState error={agenda.error as Error} onRetry={() => void agenda.refetch()} />
      ) : events.length === 0 ? (
        <EmptyState message={t('agenda.empty')} />
      ) : (
        <IonList inset>
          {events.map((event) => {
            const mine = event.attendance?.find(
              (entry) => entry.member_id === activeMembership?.id,
            );
            const shiftsFilled = event.attendance?.filter((a) => a.shift_id).length ?? 0;
            const shiftsNeeded =
              event.shifts?.reduce((sum, shift) => sum + shift.needed, 0) ?? 0;

            return (
              <IonItem key={event.id}>
                <IonLabel className="ion-text-wrap">
                  <h2>{event.title}</h2>
                  <IonNote>
                    {eventLabel(event.type)} · {formatDateTime(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ''}
                  </IonNote>

                  {shiftsNeeded > 0 && (
                    <p>
                      <IonBadge color="tertiary">
                        {t('agenda.shiftNeeded', {
                          filled: shiftsFilled,
                          needed: shiftsNeeded,
                        })}
                      </IonBadge>
                    </p>
                  )}

                  {range === 'upcoming' && (
                    <IonButtons>
                      <IonButton
                        size="small"
                        fill={mine?.status === 'registered' ? 'solid' : 'outline'}
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate(
                            { eventId: event.id, status: 'registered' },
                            { onError: (cause) => toast.failure(cause.message) },
                          )
                        }
                      >
                        {t('agenda.attend')}
                      </IonButton>
                      <IonButton
                        size="small"
                        color="medium"
                        fill={mine?.status === 'excused' ? 'solid' : 'outline'}
                        disabled={respond.isPending}
                        onClick={() =>
                          respond.mutate(
                            { eventId: event.id, status: 'excused' },
                            { onError: (cause) => toast.failure(cause.message) },
                          )
                        }
                      >
                        {t('agenda.decline')}
                      </IonButton>
                      <IonButton size="small" onClick={() => setCheckInEventId(event.id)}>
                        {t('agenda.checkIn')}
                      </IonButton>
                    </IonButtons>
                  )}
                </IonLabel>

                {mine?.status === 'present' && (
                  <IonBadge slot="end" color="success">
                    {t('agenda.checkedIn')}
                  </IonBadge>
                )}
              </IonItem>
            );
          })}
        </IonList>
      )}

      <CheckInModal
        eventId={checkInEventId}
        onDismiss={() => setCheckInEventId(null)}
      />

      <EventFormModal
        isOpen={isFormOpen}
        onDismiss={() => setFormOpen(false)}
        onDone={() => {
          setFormOpen(false);
          toast.success(t('eventForm.created'));
        }}
      />
    </AppPage>
  );
}
