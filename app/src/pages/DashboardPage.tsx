import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCol,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonListHeader,
  IonNote,
  IonRow,
  useIonRouter,
} from '@ionic/react';
import { createOutline, documentOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share } from '@capacitor/share';
import { useClub } from '../hooks/useClub';
import { usePlanningScope } from '../hooks/usePlanningScope';
import {
  useMyPoints,
  useMyPointsSummary,
  useNextContributions,
  useRuleLabels,
  useMyStreak,
} from '../hooks/useGamification';
import { useAgenda, useRespondToEvent, type AgendaEvent } from '../hooks/useAgenda';
import { useMembers } from '../hooks/useMembers';
import { useTasks } from '../hooks/useTasks';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { MonthBars } from '../components/MonthBars';
import { useNews } from '../hooks/useNews';
import { useNewsSource } from '../hooks/useNewsSources';
import { useIsNewClub } from '../hooks/useOnboarding';
import { AppPage } from '../components/AppPage';
import { AttendanceStatusIcon } from '../components/AttendanceStatusIcon';
import { DeclineModal } from '../components/DeclineModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { FirstStepsCard } from '../components/FirstStepsCard';
import { InboxButton } from '../components/InboxButton';
import { NewsCard } from '../components/NewsCard';
import { NewsDetailModal } from '../components/NewsDetailModal';
import { NewsFormModal } from '../components/NewsFormModal';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList, SkeletonNewsCards, SkeletonStats } from '../components/Skeletons';
import { formatDate, formatDateTime } from '../lib/format';
import { firstName } from '../lib/member';
import { canShareNatively } from '../lib/invite';
import { bookingLabel, pointsPerMonth } from '../lib/points';
import { holdsShift, respondsViaShifts } from '../lib/attendance';
import { useToast } from '../hooks/useToast';
import type { News } from '../lib/database.types';

export function DashboardPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const { activeClub, activeMembership, eventLabel, isTrainer } = useClub();
  // C-032: Ändern darf, wer für das Team der News oder des Termins plant.
  const scope = usePlanningScope();
  const toast = useToast();
  const [newsForm, setNewsForm] = useState<{ open: boolean; editing: News | null }>({
    open: false,
    editing: null,
  });
  // Die geöffnete News – das Detail-Blatt mit Bild und Volltext.
  const [openNews, setOpenNews] = useState<News | null>(null);
  // Termin und Aufgabe öffnen sich hier als Blatt statt in ihrem Tab: Ionic
  // will keinen Knopf, der von Tab 1 nach Tab 2 führt – für Inhalt quer über
  // Tabs empfiehlt es das Modal (Navigation-Kapitel). Nur die Kennung im
  // Zustand: Das Blatt zeigt so immer den Stand der Liste.
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [decliningEvent, setDecliningEvent] = useState<{
    id: string;
    startsAt: string;
  } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const isNewClub = useIsNewClub();
  const points = useMyPoints();
  const summary = useMyPointsSummary();
  const streak = useMyStreak();
  const suggestions = useNextContributions(5);
  const rules = useRuleLabels();
  // Die Startseite ist persönlich: Hier stehen die eigenen Teams und das, was
  // dem ganzen Verein gilt – nicht der Kalender aller Teams. Die RLS grenzt
  // Mitglieder und Trainer:innen ohnehin so ab (`event_in_scope()`, `0073`);
  // der Vorstand liest den ganzen Verein und bekäme sonst hier die Trainings
  // fremder Teams. Der Filter läuft in der Abfrage, nicht über dem Ergebnis:
  // Die Liste bricht nach 100 Zeilen ab, und eine fremde Trainingsserie füllt
  // die längst. Bis die eigenen Teams da sind, fragt sie nicht – sonst liefe
  // sie zweimal, das erste Mal mit der falschen Eingrenzung.
  const agenda = useAgenda(
    'upcoming',
    { teamIds: scope.myTeamIds },
    { enabled: !scope.isLoading },
  );
  const tasks = useTasks();
  const members = useMembers();
  const respond = useRespondToEvent();
  const news = useNews(5);
  const newsSource = useNewsSource();

  // Die Tab-Seite bleibt gemountet; erst das erneute Betreten lädt nach, was
  // nach `staleTime` veraltet ist (Lifecycle-Kapitel).
  useRefreshOnEnter([
    ['points'],
    ['points-summary'],
    ['my-streak'],
    ['next-contributions'],
    ['rule-labels'],
    ['agenda'],
    ['tasks'],
    ['members'],
    ['news'],
    ['news-source'],
    ['club-is-new'],
    ['inbox'],
  ]);

  const nextEvents = (agenda.data ?? []).slice(0, 3);
  const recent = points.transactions.slice(0, 3);
  // Konzept §7.1: der Saisonverlauf – Punkte je Monat seit Saisonstart.
  const months = pointsPerMonth(points.transactions, activeClub?.season_start);
  const hasTrend = months.some((entry) => entry.points > 0);
  // A1: Wer noch keine Buchung hat, bekommt keinen leeren Stand, sondern eine
  // Begrüssung – und darunter den nächsten erreichbaren Beitrag.
  const isNewcomer = summary.isSuccess && summary.data.bookingCount === 0;

  // Dieselbe Grundgesamtheit wie in der Agenda: wer kein Anmeldekonto hat,
  // lässt sich nicht erreichen und zählt im Detail nicht als «keine Antwort».
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status !== 'left' && m.user_id !== null,
  );
  const detailEvent = (agenda.data ?? []).find((entry) => entry.id === detailEventId) ?? null;
  const openTask = (tasks.data ?? []).find((entry) => entry.id === openTaskId) ?? null;

  /**
   * Der eigene Antwortstand zu einem Termin – die Ampel aus der Agenda
   * (UC-010), hier nur zum Lesen: Geantwortet wird im Detail, das die Zeile
   * öffnet. Eine kurze Fassung von `eventFacts()` der Agenda; was die Zeile
   * hier nicht zeigt (Zahlen, Unterdeckung, Erinnern), rechnet sie auch nicht.
   */
  function eventFacts(event: AgendaEvent) {
    // Seit 0025 trägt `attendance` je Schicht eine eigene Zeile. Die Antwort
    // auf den **Termin** ist die ohne Schicht – ohne diesen Filter behauptete
    // die Ampel eine Zusage, sobald jemand eine Schicht übernommen hat.
    const mine = (event.attendance ?? []).find(
      (entry) => entry.member_id === activeMembership?.id && entry.shift_id === null,
    );
    return {
      // Ein Entwurf hat keinen Antwortstand – in ihn antwortet niemand. Er
      // steht hier, weil die Policy aus 0018 ihn Planenden zeigt (A2).
      isDraft: event.published_at === null,
      isCancelled: event.cancelled_at !== null,
      // BR-196: Bei einem Termin mit Schichten ist die Schicht die Antwort.
      // Ein gelbes «noch offen» daneben wäre eine Frage ohne Antwortweg.
      viaShifts: respondsViaShifts(event),
      hasMyShift: holdsShift(event.attendance ?? [], activeMembership?.id),
      status: mine?.status ?? null,
      // Die Liste zeigt nur Kommendes. Die Minutenrundung der Abfrage lässt
      // aber einen eben begonnenen Termin stehen – dann gibt es nichts mehr
      // zu antworten (BR-038).
      hasStarted: new Date(event.starts_at) <= new Date(),
    };
  }

  /** Betroffen ist bei einem Team-Termin nur dieses Team, sonst der ganze Verein. */
  function affectedMembers(teamId: string | null) {
    return teamId ? activeMembers.filter((m) => m.teamIds.includes(teamId)) : activeMembers;
  }

  /**
   * Schritt 6: Der Vorschlag führt dorthin, wo er eingelöst wird – als Blatt
   * über dieser Seite. Nur wenn die Liste den Gegenstand (noch) nicht kennt,
   * wechselt die Seite in den Tab, und zwar als dessen Wurzel: So bleibt
   * keine Fremd-History, über die der Android-Zurück-Knopf wanderte.
   */
  function openSuggestion(kind: string, refId: string) {
    if (kind === 'task') {
      if ((tasks.data ?? []).some((entry) => entry.id === refId)) setOpenTaskId(refId);
      else router.push(`/tabs/marketplace?task=${refId}`, 'root');
      return;
    }
    if ((agenda.data ?? []).some((entry) => entry.id === refId)) setDetailEventId(refId);
    else router.push(`/tabs/agenda?event=${refId}`, 'root');
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
        name: firstName(activeMembership?.display_name),
      })}
      toolbarEnd={
        /* FR-078: Die Inbox ist der Kanal, der alle erreicht – ihr Eingang
           steht deshalb hier oben, nicht nur unter Profil → Nachrichten. */
        <InboxButton />
      }
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

      {/* Was als Nächstes ansteht, steht oben: Der eigene Punktestand ist die
          Auskunft, der nächste Termin die Handlung. Die Termine öffnen ihr
          Detail hier als Blatt – kein Sprung in die Agenda. */}
      <IonListHeader>
        <IonLabel>{t('dashboard.upcoming')}</IonLabel>
      </IonListHeader>
      {agenda.isPending ? (
        <SkeletonList />
      ) : agenda.error ? (
        <ErrorState error={agenda.error as Error} onRetry={() => void agenda.refetch()} />
      ) : nextEvents.length === 0 ? (
        <EmptyState
          message={t('agenda.empty')}
          action={{
            label: t('agenda.title'),
            onClick: () => router.push('/tabs/agenda', 'root'),
          }}
        />
      ) : (
        <ListSection
          /* Nur für den Vorstand: Er liest den ganzen Vereinskalender und
             sähe hier sonst mehr – der Hinweis sagt, wo der Rest steht. */
          footnote={scope.isBoard ? t('dashboard.upcomingHint') : undefined}
        >
          {nextEvents.map((event) => {
            const facts = eventFacts(event);
            return (
              <IonItem key={event.id} button detail onClick={() => setDetailEventId(event.id)}>
                {facts.isDraft ? (
                  /* Derselbe Platzhalter wie in der Agenda – er hält die
                     Textkante der Zeile an derselben Stelle (Befund 15). */
                  <span slot="start" className="app-status-slot" aria-hidden="true">
                    <IonIcon
                      className="app-status-icon"
                      icon={documentOutline}
                      color="medium"
                    />
                  </span>
                ) : facts.viaShifts && !facts.isCancelled ? (
                  /* BR-196: Wer eine Schicht hält, sieht den Haken; sonst
                     steht das Symbol der Terminart, denn auf den Anlass
                     selbst antwortet niemand. */
                  <AttendanceStatusIcon
                    slot="start"
                    status={facts.hasMyShift ? 'registered' : null}
                    isAffected={facts.hasMyShift}
                    eventType={event.type}
                    label={t(`agenda.shiftStatus.${facts.hasMyShift ? 'held' : 'open'}`)}
                  />
                ) : (
                  <AttendanceStatusIcon
                    slot="start"
                    status={facts.status}
                    isCancelled={facts.isCancelled}
                    isLocked={facts.hasStarted}
                  />
                )}
                <IonLabel className="ion-text-wrap">
                  <h2>{event.title}</h2>
                  <IonNote>
                    {eventLabel(event.type)} · {formatDateTime(event.starts_at)}
                  </IonNote>
                </IonLabel>
              </IonItem>
            );
          })}
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

      {/* Schritt 4: konkrete Beiträge statt Regeln. Skelett, Fehler und
          Leerzustand stehen neben der Liste, nicht in ihr. */}
      <IonListHeader>
        <IonLabel>{t('dashboard.nextPoints')}</IonLabel>
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
          message={t('dashboard.nothingOpen')}
          action={{
            label: t('marketplace.title'),
            onClick: () => router.push('/tabs/marketplace', 'root'),
          }}
        />
      ) : (
        <ListSection footnote={t('dashboard.nextPointsHint')}>
          {(suggestions.data ?? []).map((entry) => (
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
          ))}
        </ListSection>
      )}

      {/* Der Rückblick steht unter dem, was ansteht: erst die nächste
          Handlung, dann die eigene Bilanz. Das Diagramm steht in einer Karte –
          ein Item ist eine Zeile, kein Behälter für eine Grafik. */}
      {hasTrend && (
        <>
          <IonListHeader>
            <IonLabel>{t('dashboard.seasonTrend')}</IonLabel>
          </IonListHeader>
          <IonCard>
            <IonCardContent>
              <MonthBars
                months={months}
                description={t('dashboard.seasonTrendDescription', {
                  count: months.length,
                  points: summary.data?.seasonPoints ?? 0,
                })}
              />
            </IonCardContent>
          </IonCard>
          <IonNote className="app-footnote">{t('dashboard.seasonTrendHint')}</IonNote>
        </>
      )}

      {/* Schritt 3: die letzten Buchungen mit Datum, Anlass und Wert. */}
      {recent.length > 0 && (
        <ListSection
          title={t('dashboard.recentBookings')}
          action={
            /* Eine Unterseite des Profil-Tabs: `root` startet den Tab dort,
               ohne Fremd-History. */
            <IonButton
              fill="clear"
              size="small"
              routerLink="/tabs/profile/points"
              routerDirection="root"
            >
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

      {/* Die News als Karten im Raster der bestehenden myclub-App: eine Spalte
          auf dem Telefon, zwei auf dem Tablet, drei auf dem Laptop. Das Raster
          steht unter der Überschrift, nicht in einer Liste. */}
      <IonListHeader>
        <IonLabel>{t('dashboard.latestNews')}</IonLabel>
      </IonListHeader>
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
              : {
                  label: t('agenda.title'),
                  onClick: () => router.push('/tabs/agenda', 'root'),
                }
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

      {/* Dasselbe Blatt wie in der Agenda (UC-010): Der Termin sieht hier
          gleich aus wie dort. */}
      <EventDetailModal
        event={detailEvent}
        members={detailEvent ? affectedMembers(detailEvent.team_id) : []}
        memberId={
          detailEvent &&
          (detailEvent.team_id === null || scope.myTeamIds.includes(detailEvent.team_id))
            ? (activeMembership?.id ?? null)
            : null
        }
        isTrainer={detailEvent ? scope.canPlanFor(detailEvent.team_id) : false}
        eventLabel={eventLabel}
        onDecline={() => {
          if (!detailEvent) return;
          setDetailEventId(null);
          setDecliningEvent({ id: detailEvent.id, startsAt: detailEvent.starts_at });
        }}
        onDismiss={() => setDetailEventId(null)}
      />

      {/* UC-010 A1: Absagen mit Grund – derselbe Weg wie in der Agenda. */}
      <DeclineModal
        isOpen={decliningEvent !== null}
        startsAt={decliningEvent?.startsAt ?? ''}
        isSubmitting={respond.isPending}
        error={respond.error ? (respond.error as Error).message : null}
        onDismiss={() => setDecliningEvent(null)}
        onSubmit={(reason) => {
          if (!decliningEvent) return;
          respond.mutate(
            { eventId: decliningEvent.id, status: 'excused', reason },
            {
              onSuccess: (result) => {
                setDecliningEvent(null);
                toast.success(
                  result.pointsAwarded > 0
                    ? t('agenda.declinedWithPoints', { points: result.pointsAwarded })
                    : t('agenda.declined'),
                );
              },
            },
          );
        }}
      />

      {/* Dasselbe Blatt wie im Marktplatz (UC-018). */}
      <TaskDetailModal
        task={openTask}
        onDismiss={() => setOpenTaskId(null)}
        onDone={(outcome, warned) => {
          setOpenTaskId(null);
          if (outcome === 'claimed') {
            toast.success(t('marketplace.claimed'));
          } else if (outcome === 'submitted') {
            toast.success(t('taskDetail.reported'));
          } else {
            toast.success(t(warned ? 'taskDetail.releasedWarned' : 'taskDetail.released'));
          }
        }}
      />
    </AppPage>
  );
}
