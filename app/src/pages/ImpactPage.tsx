import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonListHeader,
  IonNote,
  useIonRouter,
} from '@ionic/react';
import { calendarOutline, listOutline, podiumOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import {
  useMyPoints,
  useMyPointsSummary,
  useMyStreak,
  useNextContributions,
  useRuleLabels,
} from '../hooks/useGamification';
import { useMyContributionGoal } from '../hooks/useContributionGoal';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { AppPage } from '../components/AppPage';
import { ContributionGoalCard } from '../components/ContributionGoalCard';
import { ListSection } from '../components/ListSection';
import { MonthBars } from '../components/MonthBars';
import { StatCard } from '../components/StatCard';
import { StrengthsSection } from '../components/StrengthsSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList, SkeletonStats } from '../components/Skeletons';
import { formatDate, formatDateTime } from '../lib/format';
import { bookingLabel, pointsPerMonth } from '../lib/points';

/**
 * «Meine Wirkung» – der dritte Tab (UC-020, UC-024, UC-042).
 *
 * Hier stand bis zum 16.09.2026 die Rangliste. Den Platz hatte sie aus der
 * alten myclub-App geerbt, wo der Trophäen-Tab die **Meisterschaftstabelle**
 * des Verbands zeigte und nur Vereinen mit freigeschaltetem Modul erschien.
 * Übernommen wurde das Symbol, nicht der Inhalt: Aus dem Tabellenstand des
 * Teams wurde ein Vergleich der Mitglieder untereinander – und der bekam
 * damit einen Dauerplatz in der Fusszeile, während BR-084 ihn einen Tab
 * weiter auf der Startseite verbietet. Das Manifest sagt «Wir vor Rangliste»;
 * die Rangliste liegt deshalb eine Ebene tiefer (`impact/ranking`).
 *
 * Die Seite erzählt die eigene Geschichte in dieser Reihenfolge: Wo stehe ich
 * (Ziel und Punktestand), woraus besteht mein Beitrag (die fünf Dimensionen),
 * was kann ich als Nächstes tun (Vorschläge), was war (Verlauf und
 * Buchungen). Erst ganz unten steht der Verein als Ganzes.
 */
export function ImpactPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const { activeClub } = useClub();
  const points = useMyPoints();
  const summary = useMyPointsSummary();
  const streak = useMyStreak();
  const rules = useRuleLabels();
  const suggestions = useNextContributions(5);
  const goal = useMyContributionGoal();

  // Die Tab-Seite bleibt gemountet; erst das erneute Betreten lädt nach, was
  // nach `staleTime` veraltet ist (Lifecycle-Kapitel).
  useRefreshOnEnter([
    ['points'],
    ['points-summary'],
    ['my-streak'],
    ['rule-labels'],
    ['next-contributions'],
    ['contribution-goal'],
    ['dimensions'],
  ]);

  const recent = points.transactions.slice(0, 3);
  // Konzept §7.1: der Saisonverlauf – Punkte je Monat seit Saisonstart.
  const months = pointsPerMonth(points.transactions, activeClub?.season_start);
  const hasTrend = months.some((entry) => entry.points > 0);
  // A1: Wer noch keine Buchung hat, bekommt keinen leeren Stand, sondern eine
  // Begrüssung – und darunter den nächsten erreichbaren Beitrag.
  const isNewcomer = summary.isSuccess && summary.data.bookingCount === 0;
  // BR-265: Unter dem Zielbalken steht nur, was diesen Balken auch bewegt –
  // die Zielkarte bringt ihre eigene, gefilterte Liste mit. Die allgemeine
  // Liste erscheint deshalb nur, wenn dort keine steht; sonst stünden
  // dieselben drei Aufgaben zweimal auf derselben Seite.
  const goalSuggests = Boolean(goal.data) && goal.data?.state !== 'reached';

  /**
   * Der Vorschlag führt dorthin, wo er eingelöst wird – in den Tab, der ihn
   * kennt, und zwar als dessen Wurzel: So bleibt keine Fremd-History, über
   * die der Android-Zurück-Knopf wanderte. Anders als auf der Startseite
   * öffnet sich hier kein Blatt: Diese Seite hält weder die Aufgabenliste
   * noch die Agenda, und beide nur für ein Blatt zu laden, wäre ein zweiter
   * Ort, an dem dieselbe Zeile anders aussieht.
   */
  function openSuggestion(kind: string, refId: string) {
    if (kind === 'task') router.push(`/tabs/marketplace?task=${refId}`, 'root');
    else router.push(`/tabs/agenda?event=${refId}`, 'root');
  }

  return (
    <AppPage
      title={t('impact.title')}
      onRefresh={() =>
        Promise.all([
          points.refetch(),
          summary.refetch(),
          streak.refetch(),
          suggestions.refetch(),
          goal.refetch(),
        ])
      }
    >
      {/* UC-042: Wo stehe ich – aber nur, wenn das Modul läuft und ein Ziel
          gilt. Sonst gibt der Hook `null` und die Karte erscheint nicht. */}
      <ContributionGoalCard />

      {/* BR-081: Saison und Gesamt getrennt. BR-084: keine Vergleichszahl –
          hier steht der eigene Beitrag, der Rang liegt eine Ebene tiefer. */}
      {summary.isLoading ? (
        <SkeletonStats />
      ) : summary.error ? (
        <ErrorState
          error={summary.error as Error}
          onRetry={() => void summary.refetch()}
        />
      ) : (
        <div className="app-stat-row">
          <StatCard value={summary.data?.seasonPoints ?? 0} label={t('impact.seasonPoints')} />
          <StatCard
            value={summary.data?.careerPoints ?? 0}
            label={t('impact.careerPoints')}
            accent="tertiary"
          />
        </div>
      )}

      {isNewcomer && (
        <ListSection footnote={t('impact.welcomeHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('impact.welcome')}</h2>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* Konzept §4.1 Säule 1 und §10: die Trainingsserie und der Weg zum
          nächsten Bonus – ein Satz, keine Warnung. */}
      {(streak.data ?? 0) > 0 && (
        <ListSection>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('impact.streak', { count: streak.data ?? 0 })}</h2>
              <IonNote>{t('impact.streakHint', { count: 4 - ((streak.data ?? 0) % 4) })}</IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* UC-024: woraus der Beitrag besteht. Das Netzdiagramm ist der Kern
          dieses Tabs – es benennt eine Stärke und nie eine Lücke (BR-101). */}
      <IonListHeader>
        <IonLabel>{t('impact.strengths')}</IonLabel>
      </IonListHeader>
      <StrengthsSection />

      {/* UC-020 Schritt 4: konkrete Beiträge statt Regeln. */}
      {!goalSuggests && (
        <>
          <IonListHeader>
            <IonLabel>{t('impact.nextPoints')}</IonLabel>
          </IonListHeader>
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
              message={t('impact.nothingOpen')}
              action={{
                label: t('marketplace.title'),
                onClick: () => router.push('/tabs/marketplace', 'root'),
              }}
            />
          ) : (
            <ListSection footnote={t('impact.nextPointsHint')}>
              {(suggestions.data ?? []).map((entry) => (
                <IonItem
                  key={`${entry.kind}-${entry.refId}`}
                  button
                  detail
                  onClick={() => openSuggestion(entry.kind, entry.refId)}
                >
                  <IonIcon
                    slot="start"
                    icon={entry.kind === 'task' ? listOutline : calendarOutline}
                    color="medium"
                    aria-hidden="true"
                  />
                  <IonLabel className="ion-text-wrap">
                    <h2>{entry.title}</h2>
                    <IonNote>
                      {t(`impact.kind.${entry.kind}`)}
                      {entry.whenAt ? ` · ${formatDate(entry.whenAt)}` : ''}
                    </IonNote>
                  </IonLabel>
                  {/* Ohne hinterlegte Regel steht hier keine Zahl – eine Null
                      wäre eine Behauptung über den Wert des Beitrags. */}
                  {entry.points !== null && entry.points > 0 && (
                    <IonNote slot="end" color="primary">
                      +{entry.points}
                    </IonNote>
                  )}
                </IonItem>
              ))}
            </ListSection>
          )}
        </>
      )}

      {/* Der Rückblick steht unter dem, was ansteht: erst die nächste
          Handlung, dann die eigene Bilanz. Das Diagramm steht in einer Karte –
          ein Item ist eine Zeile, kein Behälter für eine Grafik. */}
      {hasTrend && (
        <>
          <IonListHeader>
            <IonLabel>{t('impact.seasonTrend')}</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <MonthBars
                months={months}
                description={t('impact.seasonTrendDescription', {
                  count: months.length,
                  points: summary.data?.seasonPoints ?? 0,
                })}
              />
            </IonCardContent>
          </IonCard>
          <IonNote className="app-footnote">{t('impact.seasonTrendHint')}</IonNote>
        </>
      )}

      {/* UC-020 Schritt 3: die letzten Buchungen mit Datum, Anlass und Wert. */}
      {recent.length > 0 && (
        <ListSection
          title={t('impact.recentBookings')}
          action={
            /* Eine Unterseite des Profil-Tabs: `root` startet den Tab dort,
               ohne Fremd-History. */
            <IonButton
              fill="clear"
              size="small"
              routerLink="/tabs/profile/points"
              routerDirection="root"
            >
              {t('impact.allBookings')}
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

      {/* Zuletzt der Verein: die Ranglisten liegen als Unterseite dieses Tabs
          (FR-048, FR-049). Ein gewöhnlicher Vorwärts-Übergang – dieselbe
          Route, eine Ebene tiefer, kein Tab-Wechsel. */}
      <ListSection footnote={t('impact.rankingHint')}>
        <IonItem button detail routerLink="/tabs/impact/ranking">
          <IonIcon slot="start" icon={podiumOutline} color="medium" aria-hidden="true" />
          <IonLabel>{t('impact.ranking')}</IonLabel>
        </IonItem>
      </ListSection>
    </AppPage>
  );
}
