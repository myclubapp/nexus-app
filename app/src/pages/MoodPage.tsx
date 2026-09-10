import { useState } from 'react';
import {
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { CheckinPrompt } from '../components/CheckinPromptModal';
import { TrendChart } from '../components/TrendChart';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import {
  useMyCheckinResponses,
  useMyCheckinTrend,
  useOpenCheckins,
  useShareCheckin,
  useTeamMood,
} from '../hooks/useContextCheckin';
import { useClub } from '../hooks/useClub';
import { useMyTeams } from '../hooks/useGamification';
import { useToast } from '../hooks/useToast';
import { formatDate, formatDateTime } from '../lib/format';
import { trendAverage, type CheckinInvitation } from '../lib/contextCheckin';

/**
 * Befinden (UC-032).
 *
 * Drei Abschnitte, in dieser Reihenfolge: die offenen Check-ins, weil sie eine
 * Handlung erwarten; der eigene Verlauf, weil er nur dieser Person gehört
 * (FR-105); und – für Trainer:innen – der Team-Wert, der erst ab fünf
 * Antworten überhaupt erscheint (BR-140).
 *
 * Was hier **nicht** steht: eine Liste, wer geantwortet hat und wer nicht. Die
 * Policy gibt sie nicht heraus, und die Seite fragt gar nicht erst danach –
 * schon die Teilnahmequote an einer Befindensfrage wäre eine Auskunft über
 * Befinden (BR-139).
 */
export function MoodPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isTrainer } = useClub();
  const open = useOpenCheckins();
  const trend = useMyCheckinTrend();
  const given = useMyCheckinResponses();
  const share = useShareCheckin();
  const myTeams = useMyTeams();

  const [answering, setAnswering] = useState<CheckinInvitation | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const teams = myTeams.data ?? [];
  // Ohne ausdrückliche Wahl der erste eigene Kader – sonst bliebe der
  // Abschnitt leer, bis jemand eine Auswahl trifft.
  const shownTeam = teamId ?? teams[0]?.id ?? null;
  const mood = useTeamMood(isTrainer ? shownTeam : null);

  const rows = open.data ?? [];
  const points = trend.data ?? [];
  const average = trendAverage(points);

  return (
    <AppPage
      title={t('checkin.pageTitle')}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([open.refetch(), trend.refetch()])}
    >
      {open.isLoading || trend.isLoading ? (
        <SkeletonList />
      ) : (open.error ?? trend.error) ? (
        <ErrorState
          error={(open.error ?? trend.error) as Error}
          onRetry={() => void Promise.all([open.refetch(), trend.refetch()])}
        />
      ) : (
        <>
          {rows.length > 0 && (
            <ListSection title={t('checkin.openTitle')} footnote={t('checkin.openHint')}>
              {rows.map((invitation) => (
                <IonItem
                  key={invitation.id}
                  button
                  detail
                  onClick={() => setAnswering(invitation)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`checkin.context.${invitation.context}`)}</h2>
                    {invitation.eventTitle && <p>{invitation.eventTitle}</p>}
                    <IonNote>{formatDate(invitation.askedOn)}</IonNote>
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {/* FR-105: der eigene Verlauf. Für niemanden sonst lesbar. */}
          {points.length > 0 ? (
            <ListSection title={t('checkin.trendTitle')} footnote={t('checkin.trendHint')}>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <TrendChart
                    points={points}
                    description={t('checkin.trendDescription', {
                      count: points.length,
                      average: average ?? 0,
                    })}
                  />
                  <IonNote>
                    {t('checkin.trendSummary', {
                      count: points.length,
                      average: average ?? 0,
                    })}
                  </IonNote>
                </IonLabel>
              </IonItem>
            </ListSection>
          ) : (
            rows.length === 0 && <EmptyState message={t('checkin.empty')} />
          )}

          {/* A5: eine bereits gegebene Antwort nachträglich zeigen.
              Ohne diesen Abschnitt liesse sich die Sichtbarkeit **nur vorher**
              wählen – und der Ablauf, den A5 beschreibt, wäre unerreichbar. */}
          {(given.data ?? []).length > 0 && (
            <ListSection title={t('checkin.givenTitle')} footnote={t('checkin.givenHint')}>
              {(given.data ?? []).map((response) => (
                <IonItemSliding key={response.id}>
                  <IonItem>
                    <IonLabel className="ion-text-wrap">
                      <h2>{response.question}</h2>
                      {response.value !== null && (
                        <p>{t(`checkin.step.emoji5.${response.value}`)}</p>
                      )}
                      {response.text && <p>{response.text}</p>}
                      <IonNote>
                        {t(`checkin.visibility.${response.visibility}`)} ·{' '}
                        {formatDateTime(response.createdAt)}
                      </IonNote>
                    </IonLabel>
                  </IonItem>

                  {/* Teilen geht nur nach vorn: Was einmal gezeigt wurde,
                      lässt sich nicht zurücknehmen – deshalb erscheint die
                      Aktion nur an einer noch privaten Antwort, und nur an
                      einer, die zu einem Termin gehört. */}
                  {response.visibility === 'private' && response.eventId !== null && (
                    <IonItemOptions side="end">
                      <IonItemOption
                        onClick={() =>
                          share.mutate(response.id, {
                            onSuccess: () => toast.success(t('checkin.shared')),
                            onError: (error) => toast.failure((error as Error).message),
                          })
                        }
                      >
                        {t('checkin.share')}
                      </IonItemOption>
                    </IonItemOptions>
                  )}
                </IonItemSliding>
              ))}
            </ListSection>
          )}

          {/* FR-106: der Team-Wert – anonym, aggregiert und erst ab fünf. */}
          {isTrainer && teams.length > 0 && (
            <ListSection title={t('checkin.teamTitle')} footnote={t('checkin.teamHint')}>
              {teams.length > 1 && (
                <IonItem>
                  <IonSelect
                    label={t('checkin.teamLabel')}
                    labelPlacement="stacked"
                    value={shownTeam}
                    cancelText={t('common.cancel')}
                    okText={t('common.ok')}
                    onIonChange={(e) => setTeamId(e.detail.value as string)}
                  >
                    {teams.map((team) => (
                      <IonSelectOption key={team.id} value={team.id}>
                        {team.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              )}

              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  {mood.data ? (
                    <>
                      <h2>{mood.data.average.toFixed(1)}</h2>
                      <IonNote>
                        {t('checkin.teamResponses', { count: mood.data.responses })}
                      </IonNote>
                    </>
                  ) : (
                    // BR-140: keine Zahl, kein Balken, kein «zu wenige Daten»
                    // mit einem Wert daneben – nur der Satz.
                    <p>{t('checkin.teamTooSmall')}</p>
                  )}
                </IonLabel>
              </IonItem>
            </ListSection>
          )}
        </>
      )}

      {answering && (
        <CheckinPrompt
          invitation={answering}
          onDismiss={() => setAnswering(null)}
          onDone={(outcome) => {
            setAnswering(null);
            toast.success(t(`checkin.done.${outcome}`));
          }}
        />
      )}
    </AppPage>
  );
}
