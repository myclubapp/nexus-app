import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useClub } from '../hooks/useClub';
import {
  useMyPoints,
  useMyPointsSummary,
  useNextContributions,
  useRuleLabels,
} from '../hooks/useGamification';
import { useAgenda } from '../hooks/useAgenda';
import { useNews } from '../hooks/useNews';
import { useNewsSource } from '../hooks/useNewsSources';
import { useIsNewClub } from '../hooks/useOnboarding';
import { AppPage } from '../components/AppPage';
import { FirstStepsCard } from '../components/FirstStepsCard';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonCard, SkeletonList, SkeletonStats } from '../components/Skeletons';
import { formatDate, formatDateTime } from '../lib/format';
import { bookingLabel } from '../lib/points';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeClub, activeMembership, eventLabel } = useClub();
  const isNewClub = useIsNewClub();
  const points = useMyPoints();
  const summary = useMyPointsSummary();
  const suggestions = useNextContributions(5);
  const rules = useRuleLabels();
  const agenda = useAgenda('upcoming');
  const news = useNews(5);
  const newsSource = useNewsSource();

  const nextEvents = (agenda.data ?? []).slice(0, 3);
  const recent = points.transactions.slice(0, 3);
  // A1: Wer noch keine Buchung hat, bekommt keinen leeren Stand, sondern eine
  // Begrüssung – und darunter den nächsten erreichbaren Beitrag.
  const isNewcomer = summary.isSuccess && summary.data.bookingCount === 0;

  /** Schritt 6: Der Vorschlag führt dorthin, wo er eingelöst wird. */
  function openSuggestion(kind: string, refId: string) {
    navigate(
      kind === 'task'
        ? `/tabs/marketplace?task=${refId}`
        : `/tabs/agenda?event=${refId}`,
    );
  }

  return (
    <AppPage
      title={t('dashboard.title')}
      largeTitle={t('dashboard.greeting', {
        name: activeMembership?.display_name ?? '',
      })}
      onRefresh={() =>
        Promise.all([
          summary.refetch(),
          points.refetch(),
          suggestions.refetch(),
          agenda.refetch(),
          news.refetch(),
        ])
      }
    >
      {isNewClub.data && activeClub && (
        <FirstStepsCard
          clubName={activeClub.name}
          /* Erst wenn feststeht, dass keine Website verbunden ist – sonst
             blitzt die Zeile auf und verschwindet wieder. */
          offerNewsImport={newsSource.isSuccess && !newsSource.data}
        />
      )}

      {/* BR-081: Saison und Gesamt getrennt. BR-084: keine Vergleichszahl –
          hier steht der eigene Beitrag, der Rang gehört in die Rangliste. */}
      {summary.isLoading ? (
        <SkeletonStats />
      ) : summary.error ? (
        <ErrorState
          error={summary.error as Error}
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <div className="app-stat-row">
          <StatCard
            value={summary.data?.seasonPoints ?? 0}
            label={t('dashboard.seasonPoints')}
          />
          <StatCard
            value={summary.data?.careerPoints ?? 0}
            label={t('dashboard.careerPoints')}
            accent="tertiary"
          />
        </div>
      )}

      {isNewcomer && (
        <ListSection footnote={t('dashboard.welcomeHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('dashboard.welcome')}</h2>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* Schritt 4: konkrete Beiträge statt Regeln. */}
      <ListSection title={t('dashboard.nextPoints')} footnote={t('dashboard.nextPointsHint')}>
        {suggestions.isLoading ? (
          <SkeletonList />
        ) : suggestions.error ? (
          <ErrorState
            error={suggestions.error as Error}
            onRetry={() => void suggestions.refetch()}
          />
        ) : (suggestions.data ?? []).length === 0 ? (
          /* A4: sagen, dass gerade nichts ansteht – statt eines leeren Feldes. */
          <EmptyState message={t('dashboard.nothingOpen')} />
        ) : (
          (suggestions.data ?? []).map((entry) => (
            <IonItem
              key={`${entry.kind}-${entry.refId}`}
              button
              detail
              onClick={() => openSuggestion(entry.kind, entry.refId)}
            >
              <IonLabel className="ion-text-wrap">
                <h2>{entry.title}</h2>
                <IonNote>
                  {t(`dashboard.kind.${entry.kind}`)}
                  {entry.whenAt ? ` · ${formatDate(entry.whenAt)}` : ''}
                </IonNote>
              </IonLabel>
              {/* Ohne hinterlegte Regel steht hier keine Zahl – eine Null wäre
                  eine Behauptung über den Wert des Beitrags. */}
              {entry.points !== null && entry.points > 0 && (
                <IonNote slot="end" color="primary">
                  +{entry.points}
                </IonNote>
              )}
            </IonItem>
          ))
        )}
      </ListSection>

      {/* Schritt 3: die letzten Buchungen mit Datum, Anlass und Wert. */}
      {recent.length > 0 && (
        <ListSection
          title={t('dashboard.recentBookings')}
          action={
            <IonButton fill="clear" size="small" routerLink="/tabs/profile/points">
              {t('dashboard.allBookings')}
            </IonButton>
          }
        >
          {recent.map((entry) => (
            <IonItem key={entry.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{bookingLabel(entry, rules.data ?? [])}</h2>
                <IonNote>{formatDateTime(entry.created_at)}</IonNote>
              </IonLabel>
              <IonNote slot="end" color={entry.points >= 0 ? 'primary' : 'danger'}>
                {entry.points >= 0 ? `+${entry.points}` : entry.points}
              </IonNote>
            </IonItem>
          ))}
        </ListSection>
      )}

      <ListSection title={t('dashboard.upcoming')}>
        {nextEvents.length === 0 ? (
          <EmptyState message={t('agenda.empty')} />
        ) : (
          nextEvents.map((event) => (
            <IonItem key={event.id} button detail onClick={() => navigate('/tabs/agenda')}>
              <IonLabel className="ion-text-wrap">
                <h2>{event.title}</h2>
                <IonNote>
                  {eventLabel(event.type)} · {formatDateTime(event.starts_at)}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))
        )}
      </ListSection>

      <ListSection title={t('dashboard.latestNews')} inset={false}>
        {news.isLoading ? (
          <SkeletonCard />
        ) : (news.data ?? []).length === 0 ? (
          <EmptyState message={t('dashboard.noNews')} />
        ) : (
          (news.data ?? []).map((entry) => (
            <IonCard key={entry.id}>
              <IonCardHeader>
                <IonCardSubtitle>{formatDateTime(entry.published_at)}</IonCardSubtitle>
                <IonCardTitle>{entry.title}</IonCardTitle>
              </IonCardHeader>
              {entry.body && <IonCardContent>{entry.body}</IonCardContent>}
            </IonCard>
          ))
        )}
      </ListSection>
    </AppPage>
  );
}
