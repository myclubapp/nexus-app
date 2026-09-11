import {
  IonButton,
  IonCol,
  IonGrid,
  IonItem,
  IonLabel,
  IonNote,
  IonRow,
} from '@ionic/react';
import { createOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Share } from '@capacitor/share';
import { useClub } from '../hooks/useClub';
import {
  useMyPoints,
  useMyPointsSummary,
  useNextContributions,
  useRuleLabels,
  useMyStreak,
} from '../hooks/useGamification';
import { useAgenda } from '../hooks/useAgenda';
import { MonthBars } from '../components/MonthBars';
import { useNews } from '../hooks/useNews';
import { useNewsSource } from '../hooks/useNewsSources';
import { useIsNewClub } from '../hooks/useOnboarding';
import { AppPage } from '../components/AppPage';
import { FirstStepsCard } from '../components/FirstStepsCard';
import { NewsCard } from '../components/NewsCard';
import { NewsDetailModal } from '../components/NewsDetailModal';
import { NewsFormModal } from '../components/NewsFormModal';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList, SkeletonNewsCards, SkeletonStats } from '../components/Skeletons';
import { formatDate, formatDateTime } from '../lib/format';
import { canShareNatively } from '../lib/invite';
import { bookingLabel, pointsPerMonth } from '../lib/points';
import { useToast } from '../hooks/useToast';
import type { News } from '../lib/database.types';

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { activeClub, activeMembership, eventLabel, isTrainer } = useClub();
  const toast = useToast();
  const [newsForm, setNewsForm] = useState<{ open: boolean; editing: News | null }>({
    open: false,
    editing: null,
  });
  // Die geöffnete News – das Detail-Blatt mit Bild und Volltext.
  const [openNews, setOpenNews] = useState<News | null>(null);
  const isNewClub = useIsNewClub();
  const points = useMyPoints();
  const summary = useMyPointsSummary();
  const streak = useMyStreak();
  const suggestions = useNextContributions(5);
  const rules = useRuleLabels();
  const agenda = useAgenda('upcoming');
  const news = useNews(5);
  const newsSource = useNewsSource();

  const nextEvents = (agenda.data ?? []).slice(0, 3);
  const recent = points.transactions.slice(0, 3);
  // Konzept §7.1: der Saisonverlauf – Punkte je Monat seit Saisonstart.
  const months = pointsPerMonth(points.transactions, activeClub?.season_start);
  const hasTrend = months.some((entry) => entry.points > 0);
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

  /**
   * Eine übernommene News weitergeben – über das Teilen-Blatt des Geräts,
   * im Browser als kopierter Link. Geteilt wird die Quelle, nicht die App:
   * Der Verweis führt Aussenstehende auf die Website des Vereins.
   */
  async function shareNews(entry: News) {
    const url = entry.external_url;
    if (!url) return;
    if (canShareNatively()) {
      try {
        await Share.share({ title: entry.title, url });
        return;
      } catch {
        // Abbruch im Teilen-Dialog ist kein Fehler – dann bleibt Kopieren.
      }
    }
    await navigator.clipboard?.writeText(url);
    toast.success(t('news.linkCopied'));
  }

  return (
    <AppPage
      title={t('dashboard.title')}
      largeTitle={t('dashboard.greeting', {
        name: activeMembership?.display_name ?? '',
      })}
      createActions={
        /* Schritt 1: «News schreiben» steht dort, wo News gelesen werden. */
        isTrainer
          ? [
              {
                icon: createOutline,
                label: t('newsForm.title'),
                onClick: () => setNewsForm({ open: true, editing: null }),
              },
            ]
          : undefined
      }
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

      {/* Konzept §4.1 Säule 1 und §10: die Trainingsserie und der Weg zum
          nächsten Bonus – ein Satz, keine Warnung. */}
      {(streak.data ?? 0) > 0 && (
        <ListSection>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('dashboard.streak', { count: streak.data ?? 0 })}</h2>
              <IonNote>
                {t('dashboard.streakHint', { count: 4 - ((streak.data ?? 0) % 4) })}
              </IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {hasTrend && (
        <ListSection title={t('dashboard.seasonTrend')} footnote={t('dashboard.seasonTrendHint')}>
          <IonItem lines="none">
            <IonLabel>
              <MonthBars
                months={months}
                description={t('dashboard.seasonTrendDescription', {
                  count: months.length,
                  points: summary.data?.seasonPoints ?? 0,
                })}
              />
            </IonLabel>
          </IonItem>
        </ListSection>
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
          <EmptyState
            message={t('dashboard.nothingOpen')}
            action={{ label: t('marketplace.title'), routerLink: '/tabs/marketplace' }}
          />
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
          <EmptyState
            message={t('agenda.empty')}
            action={{ label: t('agenda.title'), routerLink: '/tabs/agenda' }}
          />
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

      {/* Die News als Karten im Raster der bestehenden myclub-App: eine Spalte
          auf dem Telefon, zwei auf dem Tablet, drei auf dem Laptop. */}
      <ListSection title={t('dashboard.latestNews')} inset={false}>
        {news.isLoading ? (
          <SkeletonNewsCards />
        ) : (news.data ?? []).length === 0 ? (
          <EmptyState
            message={t('dashboard.noNews')}
            action={
              isTrainer
                ? {
                    label: t('newsForm.title'),
                    onClick: () => setNewsForm({ open: true, editing: null }),
                  }
                : { label: t('agenda.title'), routerLink: '/tabs/agenda' }
            }
          />
        ) : (
          <IonGrid className="app-news-grid">
            <IonRow>
              {(news.data ?? []).map((entry) => (
                <IonCol key={entry.id} size="12" sizeSm="6" sizeMd="6" sizeLg="4">
                  <NewsCard
                    entry={entry}
                    fallbackAuthor={activeClub?.name ?? ''}
                    onOpen={setOpenNews}
                    onShare={(item) => void shareNews(item)}
                  />
                </IonCol>
              ))}
            </IonRow>
          </IonGrid>
        )}
      </ListSection>

      {/* A3 und A4 (UC-026): Bearbeiten und Zurückziehen liegen im Detail
          hinter dem Dreipunkt – der Feed bleibt zum Lesen da. */}
      <NewsDetailModal
        entry={openNews}
        fallbackAuthor={activeClub?.name ?? ''}
        isTrainer={isTrainer}
        onShare={(item) => void shareNews(item)}
        onEdit={(entry) => {
          setOpenNews(null);
          setNewsForm({ open: true, editing: entry });
        }}
        onDismiss={() => setOpenNews(null)}
      />

      <NewsFormModal
        isOpen={newsForm.open}
        editing={newsForm.editing}
        onDismiss={() => setNewsForm({ open: false, editing: null })}
        onDone={(edited) => {
          setNewsForm({ open: false, editing: null });
          toast.success(edited ? t('newsForm.saved') : t('newsForm.published'));
        }}
      />
    </AppPage>
  );
}
