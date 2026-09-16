import {
  IonButton,
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
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { useAgenda, useRespondToEvent, type AgendaEvent } from '../hooks/useAgenda';
import { useMembers } from '../hooks/useMembers';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { useNews, useNewsOrigins, useShareNews } from '../hooks/useNews';
import { useNewsSource } from '../hooks/useNewsSources';
import { useIsNewClub } from '../hooks/useOnboarding';
import { AppPage } from '../components/AppPage';
import { AttendanceStatusIcon } from '../components/AttendanceStatusIcon';
import { DeclineModal } from '../components/DeclineModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { FirstStepsCard } from '../components/FirstStepsCard';
import { ProfileSetupCard } from '../components/ProfileSetupCard';
import { InboxButton } from '../components/InboxButton';
import { NewsCard } from '../components/NewsCard';
import { NewsOriginSegment } from '../components/NewsOriginSegment';
import { NewsDetailModal } from '../components/NewsDetailModal';
import { NewsFormModal } from '../components/NewsFormModal';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList, SkeletonNewsCards } from '../components/Skeletons';
import { formatDateTime } from '../lib/format';
import { firstName } from '../lib/member';
import { holdsShift, respondsViaShifts } from '../lib/attendance';
import { useToast } from '../hooks/useToast';
import {
  PROFILE_SETUP_ROUTE,
  shouldOfferSetupCard,
  shouldStartSetup,
} from '../lib/profileSetup';
import type { NewsOrigin } from '../lib/news';
import type { News } from '../lib/database.types';

export function DashboardPage() {
  const { t } = useTranslation();
  const router = useIonRouter();
  const { user } = useAuth();
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
  // Welche Herkunft der Feed zeigt. Er startet bei «alle» – die Wahl ist ein
  // Griff für den Ausnahmefall, keine Voreinstellung, die etwas versteckt.
  const [origin, setOrigin] = useState<NewsOrigin>('all');
  // Der Termin öffnet sich hier als Blatt statt in der Agenda: Ionic will
  // keinen Knopf, der von Tab 1 nach Tab 2 führt – für Inhalt quer über Tabs
  // empfiehlt es das Modal (Navigation-Kapitel). Nur die Kennung im Zustand:
  // Das Blatt zeigt so immer den Stand der Liste.
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [decliningEvent, setDecliningEvent] = useState<{
    id: string;
    startsAt: string;
  } | null>(null);
  const isNewClub = useIsNewClub();
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
  const members = useMembers();
  const respond = useRespondToEvent();
  const news = useNews(5, origin);
  const newsOrigins = useNewsOrigins();
  const newsSource = useNewsSource();
  const shareNews = useShareNews();

  // Die Tab-Seite bleibt gemountet; erst das erneute Betreten lädt nach, was
  // nach `staleTime` veraltet ist (Lifecycle-Kapitel).
  useRefreshOnEnter([
    ['agenda'],
    ['members'],
    ['news'],
    ['news-origins'],
    ['news-source'],
    ['club-is-new'],
    ['inbox'],
  ]);

  /**
   * Der Profil-Assistent geht einmal von selbst auf (UC-053, FR-200).
   *
   * **Hier und nicht in einer Weiche.** `RequireClub` tauscht sein
   * Zwischenbild innerhalb derselben Route – genau der Fall, den CLAUDE.md
   * beschreibt: Die Seite stünde vollständig im DOM und bliebe unsichtbar.
   * Ein Routenwechsel aus einer eingeblendeten Seite heraus hat dieses
   * Problem nicht.
   *
   * Der Merker verhindert die Schleife: Nach dem Ausstieg kehrt die Person
   * hierher zurück, und bis die aufgefrischte Mitgliedschaft eintrifft, sagt
   * der Zwischenstand noch «nie gefragt».
   */
  const setupOffered = useRef(false);
  useEffect(() => {
    if (setupOffered.current || !activeMembership) return;
    if (!shouldStartSetup({ profileSetupAt: activeMembership.profile_setup_at })) return;

    setupOffered.current = true;
    router.push(PROFILE_SETUP_ROUTE, 'forward');
  }, [activeMembership, router]);

  const offerSetupCard =
    Boolean(activeMembership) &&
    shouldOfferSetupCard({
      avatarUrl: activeMembership?.avatar_url,
      displayName: activeMembership?.display_name,
      accountEmail: user?.email,
      profileSetupAt: activeMembership?.profile_setup_at,
    });

  const nextEvents = (agenda.data ?? []).slice(0, 3);

  // Dieselbe Grundgesamtheit wie in der Agenda: wer kein Anmeldekonto hat,
  // lässt sich nicht erreichen und zählt im Detail nicht als «keine Antwort».
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status !== 'left' && m.user_id !== null,
  );
  const detailEvent = (agenda.data ?? []).find((entry) => entry.id === detailEventId) ?? null;

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
          agenda.refetch(),
          news.refetch(),
        ])
      }
    >
      {/* UC-053: der Weg zurück, wenn der Assistent übersprungen wurde. Über
          der Vereinskarte, weil er die Person betrifft und nicht den Verein –
          und weil er in zwei Fingertipps erledigt und dann weg ist. */}
      {offerSetupCard && <ProfileSetupCard />}

      {isNewClub.data && activeClub && (
        <FirstStepsCard
          clubName={activeClub.name}
          /* Erst wenn feststeht, dass keine Website verbunden ist – sonst
             blitzt die Zeile auf und verschwindet wieder. */
          offerNewsImport={newsSource.isSuccess && !newsSource.data}
        />
      )}

      {/* Was als Nächstes ansteht, steht zuoberst: Die Startseite beantwortet
          «was läuft im Verein», nicht «wo stehe ich» – das steht seit dem
          16.09.2026 auf dem Wirkungs-Tab. Die Termine öffnen ihr Detail hier
          als Blatt – kein Sprung in die Agenda. */}
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

      {/* Die News als Karten im Raster der bestehenden myclub-App: eine Spalte
          auf dem Telefon, zwei auf dem Tablet, drei auf dem Laptop. Das Raster
          steht unter der Überschrift, nicht in einer Liste. */}
      <IonListHeader>
        <IonLabel>{t('dashboard.latestNews')}</IonLabel>
        {/* Eine Unterseite **desselben** Tabs, wie die Inbox – deshalb der
            gewöhnliche Vorwärts-Übergang und kein `root` wie bei «Alle
            Buchungen», das in den Profil-Tab wechselt. Ein Knopf, der den Tab
            wechselt, ist bei Ionic ein Fehler. */}
        <IonButton fill="clear" size="small" routerLink="/tabs/dashboard/news">
          {t('dashboard.allNews')}
        </IonButton>
      </IonListHeader>
      {/* Dieselbe Leiste wie auf der News-Seite, damit «Verband» an beiden
          Orten dasselbe heisst. Sie zeigt sich nur bei mehr als einer
          Herkunft und nur mit den Herkünften, die es wirklich gibt. */}
      <NewsOriginSegment value={origin} onChange={setOrigin} counts={newsOrigins.data} />
      {news.isLoading ? (
        <SkeletonNewsCards />
      ) : (news.data ?? []).length === 0 ? (
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

    </AppPage>
  );
}
