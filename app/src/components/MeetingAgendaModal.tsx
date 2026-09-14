import { IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useMeetingAgenda } from '../hooks/useMeeting';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { EmptyState, ErrorState } from './StateViews';
import { SkeletonList } from './Skeletons';
import { groupAgenda, isAgendaEmpty } from '../lib/meeting';
import type { AppEvent } from '../lib/database.types';

interface MeetingAgendaProps {
  meeting: AppEvent;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Die Sammelansicht einer Sitzung (UC-031, A2, FR-101).
 *
 * BR-135 zählt abschliessend auf, was hier steht: die zugeordneten offenen
 * Inputs und die zwei Dauerthemen – vakante Ämter und offene Helfereinsätze.
 * **Mehr nicht.** Es gibt in dieser Ansicht keine Stelle, an der ein Traktandum
 * entstehen könnte, und das ist die Umsetzung von BR-132.
 *
 * Sortiert wird nichts von Hand: `groupAgenda()` teilt die eine Liste aus
 * `meeting_agenda()` in ihre drei Körbe, und alles, was keiner davon ist, fällt
 * heraus.
 */
export function MeetingAgenda({ meeting, onDismiss, isOpen = true }: MeetingAgendaProps) {
  const { t } = useTranslation();
  const agenda = useMeetingAgenda(meeting.id);

  const grouped = groupAgenda(agenda.data ?? []);

  return (
    // Ein Blatt, das nur anzeigt: «Schliessen» steht einmal in der Kopfzeile.
    <FormModal isOpen={isOpen} title={meeting.title} onDismiss={onDismiss}>
      {agenda.isLoading ? (
        <SkeletonList />
      ) : agenda.error ? (
        <ErrorState
          error={agenda.error as Error}
          onRetry={() => void agenda.refetch()}
        />
      ) : isAgendaEmpty(grouped) ? (
        <EmptyState message={t('meeting.agendaEmpty')} />
      ) : (
        <>
          {grouped.inputs.length > 0 && (
            <ListSection
              title={t('meeting.agendaInputs')}
              footnote={t('meeting.agendaHint')}
            >
              {grouped.inputs.map((row) => (
                <IonItem key={row.refId}>
                  {/* Der Vorschlag ist der Primärtext der Zeile, der Stand die Notiz. */}
                  <IonLabel className="ion-text-wrap">
                    <h2 className="app-clamp-3">{row.title}</h2>
                    {row.detail && (
                      <IonNote>{t(`meeting.status.${row.detail}`)}</IonNote>
                    )}
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {grouped.vacancies.length > 0 && (
            <ListSection
              title={t('meeting.agendaVacancies')}
              footnote={t('meeting.agendaVacanciesHint')}
            >
              {grouped.vacancies.map((row) => (
                <IonItem key={row.refId}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{row.title}</h2>
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {grouped.shifts.length > 0 && (
            <ListSection title={t('meeting.agendaShifts')}>
              {grouped.shifts.map((row) => (
                <IonItem key={row.refId}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{row.title}</h2>
                    {row.detail && <IonNote>{row.detail}</IonNote>}
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}
        </>
      )}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function MeetingAgendaModal({
  meeting,
  ...props
}: Omit<MeetingAgendaProps, 'meeting'> & { meeting: AppEvent | null }) {
  const sheet = useSheetProps(meeting ? { meeting, ...props } : null);
  return sheet && <MeetingAgenda {...sheet} />;
}
