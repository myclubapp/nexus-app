import { useState } from 'react';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  useIonRouter,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { CheckinPromptModal } from '../components/CheckinPromptModal';
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
import { usePlanningScope } from '../hooks/usePlanningScope';
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
  const router = useIonRouter();
  const toast = useToast();
  const { isTrainer } = useClub();
  const open = useOpenCheckins();
  const trend = useMyCheckinTrend();
  const given = useMyCheckinResponses();
  const share = useShareCheckin();
  // C-032: Der Team-Wert gehört, wer für das Team plant – dem Vorstand für
  // alle Teams, einer Trainer:in für ihre eigenen; `team_mood()` prüft dasselbe.
  const scope = usePlanningScope();

  const [answering, setAnswering] = useState<CheckinInvitation | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);

  const teams = scope.teams;
  // Ohne ausdrückliche Wahl der erste Kader – sonst bliebe der Abschnitt
  // leer, bis jemand eine Auswahl trifft. Für Mitglieder ist die Liste leer.
  const shownTeam = teamId ?? teams[0]?.id ?? null;
  const mood = useTeamMood(shownTeam);

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

          {/* FR-105: der eigene Verlauf. Für niemanden sonst lesbar. Das
              Diagramm steht in einer Karte – ein Item ist eine Zeile, kein
              Behälter für eine Grafik. */}
          {points.length > 0 ? (
            <>
              <IonListHeader>
                <IonLabel>{t('checkin.trendTitle')}</IonLabel>
              </IonListHeader>
              <IonCard>
                <IonCardContent>
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
                </IonCardContent>
              </IonCard>
              <IonNote className="app-footnote">{t('checkin.trendHint')}</IonNote>
            </>
          ) : (
            rows.length === 0 && (
              <EmptyState
                message={t('checkin.empty')}
                /* Ein anderer Tab: `root` startet ihn dort, ohne Fremd-History. */
                action={{
                  label: t('agenda.title'),
                  onClick: () => router.push('/tabs/agenda', 'root'),
                }}
              />
            )
          )}

          {/* A5: eine bereits gegebene Antwort nachträglich zeigen.
              Ohne diesen Abschnitt liesse sich die Sichtbarkeit **nur vorher**
              wählen – und der Ablauf, den A5 beschreibt, wäre unerreichbar. */}
          {(given.data ?? []).length > 0 && (
            <ListSection title={t('checkin.givenTitle')} footnote={t('checkin.givenHint')}>
              {(given.data ?? []).map((response) => {
                // Teilen geht nur nach vorn: Was einmal gezeigt wurde, lässt
                // sich nicht zurücknehmen – deshalb erscheint die Aktion nur an
                // einer noch privaten Antwort, und nur an einer, die zu einem
                // Termin gehört.
                const canShare =
                  response.visibility === 'private' && response.eventId !== null;
                const shareResponse = () =>
                  share.mutate(response.id, {
                    onSuccess: () => toast.success(t('checkin.shared')),
                    onError: (error) => toast.failure((error as Error).message),
                  });

                return (
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
                      {/* Der zweite Weg neben dem Wischen: Eine Wischoption
                          ist weder per Tastatur noch per Rotor erreichbar. */}
                      {canShare && (
                        <IonButton
                          slot="end"
                          fill="clear"
                          size="small"
                          disabled={share.isPending}
                          onClick={shareResponse}
                        >
                          {t('checkin.share')}
                        </IonButton>
                      )}
                    </IonItem>

                    {canShare && (
                      <IonItemOptions side="end">
                        <IonItemOption onClick={shareResponse}>
                          {t('checkin.share')}
                        </IonItemOption>
                      </IonItemOptions>
                    )}
                  </IonItemSliding>
                );
              })}
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

      <CheckinPromptModal
        invitation={answering}
        onDismiss={() => setAnswering(null)}
        onDone={(outcome) => {
          setAnswering(null);
          toast.success(t(`checkin.done.${outcome}`));
        }}
      />
    </AppPage>
  );
}
