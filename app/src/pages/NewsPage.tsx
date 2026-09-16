import { useState } from 'react';
import {
  IonCol,
  IonGrid,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRow,
  useIonRouter,
} from '@ionic/react';
import { createOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { NewsCard } from '../components/NewsCard';
import { NewsDetailModal } from '../components/NewsDetailModal';
import { NewsFormModal } from '../components/NewsFormModal';
import { NewsOriginSegment } from '../components/NewsOriginSegment';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonNewsCards } from '../components/Skeletons';
import { useAllNews, useNewsOrigins, useShareNews } from '../hooks/useNews';
import { useClub } from '../hooks/useClub';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { useToast } from '../hooks/useToast';
import type { NewsOrigin } from '../lib/news';
import type { News } from '../lib/database.types';

/**
 * Der ganze Feed (UC-026, A5).
 *
 * Die Startseite zeigt fünf Karten – alles Ältere lag bisher unerreichbar
 * dahinter. Diese Seite ist der Weg dorthin, und sie ist der Ort, an dem die
 * Herkunft wirklich zählt: Auf der Startseite verschiebt die Wahl fünf Karten,
 * hier durchsucht sie 120.
 *
 * Eigene Seite und kein Blatt, aus demselben Grund wie die Punktehistorie: Sie
 * ist zum Blättern da, und die Wahl der Herkunft soll beim Scrollen stehen
 * bleiben. Sie steht deshalb in der zweiten Kopfzeile, wo `AppPage` sie hält.
 *
 * **Der Filter läuft in der Abfrage, nicht über dem Ergebnis.** Ein Verband,
 * der wöchentlich schreibt, füllt die erste Seite allein; ein Filter über den
 * geholten zwanzig Zeilen zeigte in genau dem Fall nichts, für den er gebaut
 * ist. Deshalb ist die Herkunft Teil des Abfrageschlüssels und jede Wahl ein
 * eigener, für sich geblätterter Verlauf.
 */
export function NewsPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const toast = useToast();
  const { activeClub, isTrainer } = useClub();
  // C-032: Ändern darf, wer für das Team der News plant.
  const scope = usePlanningScope();
  const [origin, setOrigin] = useState<NewsOrigin>('all');
  const [openNews, setOpenNews] = useState<News | null>(null);
  const [newsForm, setNewsForm] = useState<{ open: boolean; editing: News | null }>({
    open: false,
    editing: null,
  });

  const news = useAllNews(origin);
  const origins = useNewsOrigins();
  const shareNews = useShareNews();

  useRefreshOnEnter([['news-all'], ['news-origins']]);

  const entries = news.data?.pages.flat() ?? [];
  const hasMore = news.hasNextPage ?? false;

  return (
    <AppPage
      title={t('dashboard.latestNews')}
      backHref="/tabs/dashboard"
      subToolbar={
        <NewsOriginSegment
          inToolbar
          value={origin}
          onChange={setOrigin}
          counts={origins.data}
        />
      }
      createActions={
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
      onRefresh={() => Promise.all([news.refetch(), origins.refetch()])}
    >
      {news.isLoading ? (
        <SkeletonNewsCards />
      ) : news.error ? (
        <ErrorState error={news.error as Error} onRetry={() => void news.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          /* Bei gesetzter Wahl ist der Feed nicht leer, sondern die eine
             Quelle – sonst führte «keine Neuigkeiten» in die Irre. */
          message={origin === 'all' ? t('dashboard.noNews') : t('news.origin.empty')}
          action={
            origin !== 'all'
              ? { label: t('news.origin.all'), onClick: () => setOrigin('all') }
              : isTrainer
                ? {
                    label: t('newsForm.title'),
                    onClick: () => setNewsForm({ open: true, editing: null }),
                  }
                : {
                    label: t('agenda.title'),
                    onClick: () => router.push('/tabs/agenda', 'root'),
                  }
          }
        />
      ) : (
        /* Dasselbe Raster wie auf der Startseite: eine Spalte auf dem Telefon,
           zwei auf dem Tablet, drei auf dem Laptop. */
        <IonGrid className="app-news-grid">
          <IonRow>
            {entries.map((entry) => (
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

      <IonInfiniteScroll
        disabled={!hasMore}
        onIonInfinite={(e) => {
          void news.fetchNextPage().finally(() => void e.target.complete());
        }}
      >
        <IonInfiniteScrollContent loadingText={t('common.loading')} />
      </IonInfiniteScroll>

      {/* A3 und A4 (UC-026): Bearbeiten und Zurückziehen liegen im Detail
          hinter dem Dreipunkt – der Feed bleibt zum Lesen da. */}
      <NewsDetailModal
        entry={openNews}
        fallbackAuthor={activeClub?.name ?? ''}
        isTrainer={openNews ? scope.canPlanFor(openNews.team_id) : false}
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
