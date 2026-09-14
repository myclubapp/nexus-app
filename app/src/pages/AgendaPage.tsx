import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/react';
import {
  calendarOutline,
  checkmarkCircle,
  closeCircle,
  documentOutline,
  optionsOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import {
  useAgenda,
  useAgendaMarks,
  useAgendaMonth,
  useRespondToEvent,
  type AgendaEvent,
} from '../hooks/useAgenda';
import { useRefreshOnEnter } from '../hooks/useRefreshOnEnter';
import { usePublishEvent } from '../hooks/useHelperEvents';
import { useRemindUndecided } from '../hooks/useReminders';
import { useDeleteEvent } from '../hooks/useEvents';
import { useClub } from '../hooks/useClub';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { useMembers } from '../hooks/useMembers';
import { AppPage } from '../components/AppPage';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useTeams } from '../hooks/useInvites';
import { useToast } from '../hooks/useToast';
import { formatDateTime, formatDayLong, formatTime } from '../lib/format';
import { eventTypeIcon } from '../lib/eventIcons';
import { closeSliding } from '../lib/sliding';
import { AttendanceStatusIcon } from '../components/AttendanceStatusIcon';
import { AgendaCalendar } from '../components/AgendaCalendar';
import { CheckInModal } from '../components/CheckInModal';
import { EventDetailModal } from '../components/EventDetailModal';
import { EventFormModal } from '../components/EventFormModal';
import { DeclineModal } from '../components/DeclineModal';
import { HelperEventModal } from '../components/HelperEventModal';
import { ShiftListModal } from '../components/ShiftListModal';
import { ShiftRosterModal } from '../components/ShiftRosterModal';
import { EventQrModal } from '../components/EventQrModal';
import {
  canRespond,
  coverageGap,
  holdsShift,
  respondsViaShifts,
  tallyAttendance,
} from '../lib/attendance';
import { EventEditModal } from '../components/EventEditModal';
import {
  AgendaFilterModal,
  agendaFilterFromParam,
  EMPTY_AGENDA_FILTER,
  countActiveFilters,
  type AgendaFilterState,
} from '../components/AgendaFilterModal';
import { canActOn, isSample } from '../lib/sample';
import { isCheckInOpen } from '../lib/checkInWindow';
import { canRemind, reminderMessage } from '../lib/reminder';
import { shiftCoverage } from '../lib/shift';
import {
  calendarMarks,
  eventsOnDay,
  localDay,
  monthOf,
  parseLocalDay,
} from '../lib/agendaCalendar';

/** Die drei Sichten der Agenda: zwei Listen nach Zeitraum, ein Monatskalender. */
type Range = 'upcoming' | 'past' | 'calendar';

export function AgendaPage() {
  const { t } = useTranslation();
  const { activeMembership, eventLabel, isAdmin, isTrainer } = useClub();
  // C-032: Wer für einen Termin plant, hängt am Team des Termins – der
  // Vorstand für alle, eine Trainer:in für ihre eigenen.
  const scope = usePlanningScope();
  const toast = useToast();
  const [range, setRange] = useState<Range>('upcoming');
  const isCalendar = range === 'calendar';
  // Die Kalenderübersicht: ein gewählter Tag, dessen Monat geladen ist. Beginnt heute.
  const [selectedDay, setSelectedDay] = useState(() => localDay(new Date()));
  const [checkInEventId, setCheckInEventId] = useState<string | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [isHelperOpen, setHelperOpen] = useState(false);
  // UC-012 Schritt 1: Der Aufruf öffnet sich aus der Agenda heraus.
  const [shiftEventId, setShiftEventId] = useState<string | null>(null);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  // Der Filter nach Terminart und Team: Trainingsserie und Verbandsspiele
  // füllen die Agenda, Anlässe, Einsätze und Versammlungen gehen darin unter.
  // Gesetzt wird er im Filter-Blatt, hier gilt er.
  const [filter, setFilter] = useState<AgendaFilterState>(EMPTY_AGENDA_FILTER);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const activeFilters = countActiveFilters(filter);
  const hasFilter = activeFilters > 0;
  // UC-013 Schritt 1: der vergangene Aufruf, dessen Einsätze zu bestätigen sind.
  const [rosterEventId, setRosterEventId] = useState<string | null>(null);
  // UC-014 Schritt 1: Die Trainer:in zeigt den Code und erfasst, wer da ist.
  const [qrEventId, setQrEventId] = useState<string | null>(null);
  // UC-010 Schritt 1: Der Termin öffnet sich als Blatt mit Eckdaten und Stand.
  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [decliningEvent, setDecliningEvent] = useState<{
    id: string;
    startsAt: string;
  } | null>(null);

  // BR-062: Die Erinnerung verlinkt `/tabs/agenda?event=<id>` und soll «direkt
  // zur Antwortmöglichkeit» führen – nicht in eine Liste, in der die Person
  // ihren Termin erst sucht.
  const location = useLocation();
  const highlightId = new URLSearchParams(location.search).get('event');
  const highlightRef = useRef<HTMLIonItemElement | null>(null);

  // «Mehr anzeigen» im Marktplatz führt mit `/tabs/agenda?type=helper` hierher:
  // Der Verweis setzt den Filter, statt die Person ihn von Hand nachbauen zu
  // lassen. `location.key` steht in den Abhängigkeiten, damit derselbe Verweis
  // ein zweites Mal wieder greift – auch wenn der Filter zwischendurch von
  // Hand gelöscht wurde. Ohne Parameter bleibt der Filter, wie er ist.
  const typeParam = new URLSearchParams(location.search).get('type');
  useEffect(() => {
    const fromLink = agendaFilterFromParam(typeParam);
    if (!fromLink) return;
    setFilter(fromLink);
    // Der Verweis meint das Kommende, nicht den Monat und nicht das Vergangene.
    setRange('upcoming');
  }, [typeParam, location.key]);

  const members = useMembers();
  // Dieselbe Grundgesamtheit wie `count_undecided()` auf dem Server: wer kein
  // Anmeldekonto hat, lässt sich nicht erreichen und zählt deshalb auch nicht
  // als «noch offen». Sonst nennt die Rückfrage eine Zahl, die niemand erhält.
  const activeMembers = (members.data ?? []).filter(
    (m) => m.status !== 'left' && m.user_id !== null,
  );
  /** Solange die Mitglieder nicht geladen sind, ist die Zahl unbekannt. */
  const membersKnown = members.data !== undefined && !members.error;
  /** Die eigenen Teams – entscheiden, ob ein Team-Termin einen betrifft. */
  const myTeamIds =
    activeMembers.find((m) => m.id === activeMembership?.id)?.teamIds ?? [];
  // Beide Filter laufen in der Abfrage – siehe `AgendaFilter` in useAgenda.
  // Drei Sichten, drei Abfragen, immer nur die laufende: die Liste nach
  // Zeitraum, im Kalender der gewählte Monat (vollständig, für Zeile und
  // Detail) und die Markierungen rundherum (nur die Tage).
  // Ohne Teamwahl bleibt die Agenda offen: Sie zeigt, was lesbar ist – für den
  // Vorstand also den ganzen Vereinskalender. Der Filter grenzt auf ein Team
  // ein; die Startseite grenzt fest auf die eigenen ein.
  const agendaFilter = {
    teamIds: filter.teamId ? [filter.teamId] : undefined,
    types: filter.types,
  };
  const agenda = useAgenda(isCalendar ? 'upcoming' : range, agendaFilter, {
    enabled: !isCalendar,
  });
  const month = monthOf(selectedDay);
  const monthAgenda = useAgendaMonth(month, agendaFilter, { enabled: isCalendar });
  const marks = useAgendaMarks(month, agendaFilter, { enabled: isCalendar });
  const highlightedDates = useMemo(() => calendarMarks(marks.data ?? []), [marks.data]);
  const source = isCalendar ? monthAgenda : agenda;
  const today = localDay(new Date());
  // Ionic hält den Tab gemountet; erst `ionViewWillEnter` frischt beim
  // Wiederkommen auf (Befund 1). Hier, in der gerouteten Komponente.
  useRefreshOnEnter([['agenda']]);
  const respond = useRespondToEvent();
  const publish = usePublishEvent();
  const remind = useRemindUndecided();
  const deleteEvent = useDeleteEvent();
  const [deletingEvent, setDeletingEvent] = useState<{ id: string; title: string } | null>(
    null,
  );
  // UC-015 Schritt 4: Erst sagen, wie viele es trifft, dann fragen.
  const [remindEvent, setRemindEvent] = useState<{
    id: string;
    undecided: number;
  } | null>(null);
  // Team-Filter für den Vorstand, der alle Teams sieht – wie der Chip in der
  // Trainingsliste der bestehenden myclub-App. Mitglieder und Trainer:innen
  // sehen seit C-032 (`0073`) ohnehin nur ihre Teams und den Verein.
  const teams = useTeams();
  const filterableTeams = scope.isBoard && (teams.data ?? []).length > 1 ? (teams.data ?? []) : [];
  const events = source.data ?? [];
  /** Im Kalender nur der gewählte Tag; die Blätter finden ihren Termin im ganzen Monat. */
  const visibleEvents = isCalendar ? eventsOnDay(events, selectedDay) : events;
  const shiftEvent = events.find((entry) => entry.id === shiftEventId);
  const rosterEvent = events.find((entry) => entry.id === rosterEventId);
  const editEvent = events.find((entry) => entry.id === editEventId);
  const detailEvent = events.find((entry) => entry.id === detailEventId) ?? null;

  /** Betroffen ist bei einem Team-Termin nur dieses Team, sonst der ganze Verein. */
  function affectedMembers(teamId: string | null) {
    return teamId ? activeMembers.filter((m) => m.teamIds.includes(teamId)) : activeMembers;
  }

  function register(eventId: string) {
    respond.mutate(
      { eventId, status: 'registered' },
      {
        onSuccess: () => toast.success(t('agenda.attending')),
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  /** A2 zu Ende gedacht: Der gesicherte Entwurf lässt sich ausschreiben. */
  function publishEvent(eventId: string) {
    publish.mutate(eventId, {
      onSuccess: (result) =>
        // Auch der gedrosselte Aufruf ist ergangen – die Schreibaktion war
        // erfolgreich (§5).
        toast.success(result.muted ? t('helperEvent.mutedHint') : t('helperEvent.published')),
      onError: (cause) => toast.failure(cause.message),
    });
  }

  /**
   * Was die Zeile und das Detail über einen Termin wissen müssen – einmal
   * gerechnet, damit beide dasselbe sagen.
   */
  function eventFacts(event: AgendaEvent) {
    // Seit 0025 trägt `attendance` je Schicht eine eigene Zeile. Die Antwort
    // auf den **Termin** ist die ohne Schicht – ohne diesen Filter behauptete
    // die App eine Zusage, sobald jemand eine Schicht übernommen hat.
    const mine = event.attendance?.find(
      (entry) => entry.member_id === activeMembership?.id && entry.shift_id === null,
    );
    const isCancelled = event.cancelled_at !== null;
    // A2: Ein Entwurf ist nur für Trainer:innen und den Vorstand überhaupt
    // sichtbar – die Policy aus 0018 blendet ihn für alle anderen aus. Wer
    // ihn sieht, soll ihn auch als Entwurf erkennen.
    const isDraft = event.published_at === null;
    const hasStarted = new Date(event.starts_at) <= new Date();
    // Ein Team-Termin gilt nur für das Team – wer nicht dazugehört, bekommt
    // keinen Antwortstand, sondern ein «nicht dabei».
    const isAffected = event.team_id === null || myTeamIds.includes(event.team_id);
    // BR-196: Bei einem Termin mit Schichten ist die Schicht die Antwort. Es
    // gibt keine Zusage zum Anlass – also kein Wischen, kein «Mein Status»,
    // keine Erinnerung; die Zeile zeigt stattdessen, ob man eine Schicht hält.
    const viaShifts = respondsViaShifts(event);
    const respondable =
      !isDraft && isAffected && canRespond({ isCancelled, hasStarted, viaShifts });
    const hasMyShift = viaShifts && holdsShift(event.attendance ?? [], activeMembership?.id);
    // Der Check-in folgt seinem eigenen Fenster (BR-054) und nicht der
    // Einteilung der Agenda: Die teilt bei `starts_at`, das Fenster reicht
    // aber bis zum Ende. Wer um 19:05 die Halle betritt, fände den Termin
    // sonst nur unter «Vergangen» – ohne Weg, obwohl der Server bis 20:30 bucht.
    const checkInOpen = isCheckInOpen({
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      isCancelled,
      isDraft,
    });
    // Nähme man immer die Vereinsgrösse, stünde bei jedem Team-Termin eine
    // zu hohe Zahl Unentschlossener.
    const affectedCount = affectedMembers(event.team_id).length;
    // Aus demselben Grund zählt der Teilnehmerstand nur Antworten auf den
    // Termin. Zwei Personen mit je zwei Schichten ergäben sonst vier Zusagen
    // – und UC-015 erbte den Fehler.
    const eventAnswers = (event.attendance ?? []).filter((entry) => entry.shift_id === null);
    const tally = tallyAttendance(eventAnswers, affectedCount);
    const attending = tally.registered + tally.present;
    // FR-029: Wie viele Zusagen fehlen noch bis zum hinterlegten Bedarf? Ohne
    // Bedarf null – ein Termin ohne ihn ist nie zu leer. Und nur, solange
    // sich noch etwas ändern lässt.
    const gap =
      !isDraft && !isCancelled && !hasStarted ? coverageGap(event.capacity_needed, tally) : 0;
    // BR-041: die Unterdeckung, und zwar richtig gezählt. Eine Absage belegt
    // keinen Platz – wer nur `shift_id` zählt, hält eine Schicht für besetzt,
    // aus der sich längst jemand abgemeldet hat.
    const coverage = (event.shifts ?? []).map((shift) =>
      shiftCoverage(shift, event.attendance ?? []),
    );
    const shiftsFilled = coverage.reduce((sum, c) => sum + c.filled, 0);
    const shiftsNeeded = coverage.reduce((sum, c) => sum + c.needed, 0);
    // UC-015: A2 blendet den Weg aus, sobald alle geantwortet haben –
    // erinnern liesse sich dann ohnehin niemand.
    // C-032: Planen, erinnern und ändern darf, wer für dieses Team plant.
    const plannable = scope.canPlanFor(event.team_id);
    const remindable = canRemind({
        isDraft,
        isCancelled,
        hasStarted,
        undecided: membersKnown ? tally.undecided : null,
        isTrainer: plannable,
        viaShifts,
      });
    const editable = !isDraft && plannable && canActOn(event);

    return {
      mine,
      isCancelled,
      isDraft,
      hasStarted,
      isAffected,
      viaShifts,
      hasMyShift,
      respondable,
      checkInOpen,
      tally,
      attending,
      gap,
      shiftsFilled,
      shiftsNeeded,
      remindable,
      editable,
    };
  }

  /**
   * Ein Weg aus dem Detail in ein anderes Blatt löst das Detail ab, statt
   * sich auf seine Karte zu legen – zwei Karten übereinander stünden auf
   * derselben Ebene (guidelines §2), wie schon beim Absagen.
   */
  function leaveDetailFor(open: () => void) {
    return () => {
      setDetailEventId(null);
      open();
    };
  }

  const detailFacts = detailEvent ? eventFacts(detailEvent) : null;

  useEffect(() => {
    if (!highlightId) return;
    // Erst nach dem Zeichnen: Vorher hat die Liste den Eintrag noch nicht.
    const timer = window.setTimeout(
      () => highlightRef.current?.scrollIntoView({ block: 'center' }),
      120,
    );
    return () => window.clearTimeout(timer);
  }, [highlightId, events.length]);

  return (
    <AppPage
      title={t('agenda.title')}
      createActions={
        // BR-033: Termine erfassen Trainer:innen und der Vorstand. Der
        // Helferaufruf dagegen erreicht den ganzen Verein und kennt kein
        // Team – ihn schreibt nur der Vorstand aus (UC-011 Precondition).
        // Der Termin steht zuerst: Er ist der häufigere Weg und liegt damit
        // in der aufgeklappten Liste am nächsten beim Plus.
        isTrainer
          ? [
              {
                icon: calendarOutline,
                label: t('eventForm.title'),
                onClick: () => setFormOpen(true),
              },
              ...(isAdmin
                ? [
                    {
                      icon: eventTypeIcon('helper'),
                      label: t('helperEvent.title'),
                      onClick: () => setHelperOpen(true),
                    },
                  ]
                : []),
            ]
          : undefined
      }
      toolbarEnd={
        // Guidelines: Filtern legt nichts an und bleibt in der Kopfzeile. Die
        // Zahl am Symbol sagt, dass die Liste gerade nicht alles zeigt.
        <IonButtons slot="end">
          <IonButton
            className="app-filter-button"
            aria-label={t('agenda.filter.title')}
            onClick={() => setFilterOpen(true)}
          >
            <IonIcon slot="icon-only" icon={optionsOutline} />
            {hasFilter && (
              <IonBadge color="primary" className="app-filter-button__count">
                {activeFilters}
              </IonBadge>
            )}
          </IonButton>
        </IonButtons>
      }
      largeTitleEnd={
        // «Heute» gehört zum Kalender direkt darunter: in der Zeile des
        // grossen Titels, sobald die Kalenderansicht auf einem anderen Tag
        // steht – nicht neben dem Filter und nicht in der Liste.
        isCalendar && selectedDay !== today ? (
          <IonButtons slot="end">
            <IonButton onClick={() => setSelectedDay(today)}>{t('agenda.today')}</IonButton>
          </IonButtons>
        ) : undefined
      }
      subToolbar={
        <IonSegment value={range} onIonChange={(e) => setRange(e.detail.value as Range)}>
          <IonSegmentButton value="upcoming">
            <IonLabel>{t('agenda.upcoming')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="past">
            <IonLabel>{t('agenda.past')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="calendar">
            <IonLabel>{t('agenda.calendar')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      }
      onRefresh={() =>
        isCalendar ? Promise.all([monthAgenda.refetch(), marks.refetch()]) : agenda.refetch()
      }
    >
      {isCalendar && (
        <>
          {/* Die Monatsübersicht (Ionic-Doku «Using Array»): Tage mit Terminen
              sind eingefärbt, der gewählte Tag steht darunter als Liste. «Heute»
              führt zurück, sobald ein anderer Tag gewählt ist – der Knopf dafür
              steht in der Zeile des grossen Titels (`largeTitleEnd`). */}
          <AgendaCalendar
            value={selectedDay}
            onChange={setSelectedDay}
            marks={highlightedDates}
          />
          <IonListHeader>
            <IonLabel>{formatDayLong(parseLocalDay(selectedDay))}</IonLabel>
          </IonListHeader>
        </>
      )}

      {source.isLoading ? (
        <SkeletonList />
      ) : source.error ? (
        <ErrorState error={source.error as Error} onRetry={() => void source.refetch()} />
      ) : visibleEvents.length === 0 ? (
        <EmptyState
          message={
            isCalendar
              ? t('agenda.emptyDay')
              : hasFilter
                ? t('agenda.emptyFiltered')
                : t('agenda.empty')
          }
          action={
            // Guidelines §3: Ist die Liste nur wegen des Filters leer, führt
            // der Knopf zurück zur ganzen Agenda – nicht ins Formular. Ein
            // leerer Kalendertag führt zur Liste der kommenden Termine.
            hasFilter
              ? {
                  label: t('agenda.resetFilter'),
                  onClick: () => setFilter(EMPTY_AGENDA_FILTER),
                }
              : isTrainer
                ? { label: t('eventForm.title'), onClick: () => setFormOpen(true) }
                : isCalendar
                  ? { label: t('agenda.upcoming'), onClick: () => setRange('upcoming') }
                  : { label: t('marketplace.title'), routerLink: '/tabs/marketplace' }
          }
        />
      ) : (
        <IonList inset>
          {visibleEvents.map((event) => {
            const {
              mine,
              isCancelled,
              isDraft,
              hasStarted,
              isAffected,
              viaShifts,
              hasMyShift,
              respondable,
              attending,
              gap,
              shiftsFilled,
              shiftsNeeded,
              editable,
            } = eventFacts(event);

            const isHighlighted = event.id === highlightId;
            const openDetail = () => setDetailEventId(event.id);
            const openDecline = () =>
              setDecliningEvent({ id: event.id, startsAt: event.starts_at });
            const canPublish = isDraft && isAdmin;

            return (
              <IonItemSliding key={event.id}>
                {/* Die Zeile selbst ist der Knopf, der das Detail öffnet – ein
                    `IonItem button` mit `detail`, nicht ein Klick auf Label
                    oder Badge, den keine Tastatur erreicht. Darin steckt
                    nichts Interaktives mehr; Ionic ist da eindeutig: «Items
                    should never render nested interactives.» Der Antwortstand
                    links ist deshalb nur Anzeige – umschalten geht über das
                    Wischen nach rechts und über «Mein Status» im Detail. Was
                    sonst als Knopf in der Zeile stand (Erinnern, Check-in,
                    Code, Ausschreiben), steht jetzt im Detail. */}
                <IonItem
                  ref={isHighlighted ? highlightRef : undefined}
                  color={isHighlighted ? 'light' : undefined}
                  button
                  detail
                  onClick={openDetail}
                >
                  {isDraft ? (
                    // Ein Entwurf hat keinen Antwortstand – in ihn antwortet
                    // niemand. Der Platzhalter hält die Textkante in der
                    // Liste an derselben Stelle (Befund 15).
                    <span slot="start" className="app-status-slot" aria-hidden="true">
                      <IonIcon
                        className="app-status-icon"
                        icon={documentOutline}
                        color="medium"
                      />
                    </span>
                  ) : viaShifts && isAffected && !isCancelled ? (
                    // BR-196: kein Antwortstand, denn auf den Anlass antwortet
                    // niemand – ein gelbes «noch offen» neben «7/7» läse sich
                    // wie eine Frage, die sich nicht beantworten lässt. Wer
                    // eine Schicht hält, sieht den Haken; sonst steht das
                    // Symbol der Terminart – gleich gross und gleich gefärbt
                    // wie dort, wo es keinen Antwortstand zu zeigen gibt
                    // (`AttendanceStatusIcon`), und die Besetzung rechts sagt
                    // den Rest.
                    hasMyShift ? (
                      <AttendanceStatusIcon slot="start" status="registered" />
                    ) : (
                      <span slot="start" className="app-status-slot" aria-hidden="true">
                        <IonIcon
                          className="app-status-icon app-status-icon--small"
                          icon={eventTypeIcon(event.type)}
                          color="primary"
                        />
                      </span>
                    )
                  ) : (
                    <AttendanceStatusIcon
                      slot="start"
                      status={mine?.status ?? null}
                      isCancelled={isCancelled}
                      isLocked={hasStarted}
                      isAffected={isAffected}
                      eventType={event.type}
                    />
                  )}

                  <IonLabel className="ion-text-wrap">
                    <h2>{event.title}</h2>
                    {/* Ein Sekundärtext: Datum und Ort. Typ, Warum, Stand in
                        Zahlen und Unterdeckung stehen im Detail (Befund 14). */}
                    <p>
                      {/* BR-160: Beispielinhalte sind immer gekennzeichnet. */}
                      {isSample(event) && <IonNote>{t('sample.badge')} · </IonNote>}
                      {formatDateTime(event.starts_at)}
                      {event.ends_at ? ` – ${formatTime(event.ends_at)}` : ''}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                    {/* UC-039/BR-180: Das Resultat kommt vom Verband – gezeigt,
                        nicht gerechnet; Tabellen bleiben FR-128. */}
                    {event.result && <p>{t('agenda.result', { result: event.result })}</p>}
                  </IonLabel>

                  {/* Rechts genau ein Status-Element. */}
                  {isDraft ? (
                    <IonBadge slot="end" color="medium">
                      {t('agenda.draft')}
                    </IonBadge>
                  ) : isCancelled ? (
                    // A3: Ein abgesagter Termin sagt es hier; der Grund steht
                    // im Detail.
                    <IonNote slot="end" color="danger">
                      {t('agenda.cancelled')}
                    </IonNote>
                  ) : shiftsNeeded > 0 ? (
                    // BR-041: die Besetzung der Schichten – die Zahl, die bei
                    // einem Aufruf zählt. Der volle Wortlaut für Bedienhilfen.
                    <IonBadge
                      slot="end"
                      color={shiftsFilled >= shiftsNeeded ? 'success' : 'tertiary'}
                      aria-label={t('agenda.shiftNeeded', {
                        filled: shiftsFilled,
                        needed: shiftsNeeded,
                      })}
                    >
                      {shiftsFilled}/{shiftsNeeded}
                    </IonBadge>
                  ) : (
                    // Die Zahl der Zusagen, wie in der alten App. FR-029: Fehlen
                    // welche bis zum Bedarf, warnt die Farbe – für alle, denn
                    // ein Termin, dem Leute fehlen, ist genau der, bei dem die
                    // eigene Zusage zählt.
                    <IonBadge slot="end" color={gap > 0 ? 'warning' : 'primary'}>
                      {attending}
                    </IonBadge>
                  )}
                </IonItem>

                {/* Zeilenaktionen nach links gewischt – der Schnitt der
                    bestehenden myclub-App und guidelines §2: kein dritter
                    Knopf in der Zeile. Höchstens drei je Seite, und jede hat
                    ihren zweiten Weg im Detail: Die Wischgeste erreicht weder
                    Tastatur noch VoiceOver-Rotor. */}
                {(canPublish || (!isDraft && shiftsNeeded > 0) || editable) && (
                  <IonItemOptions side="end">
                    {canPublish && (
                      <IonItemOption
                        color="primary"
                        disabled={publish.isPending}
                        onClick={(e) => {
                          closeSliding(e);
                          publishEvent(event.id);
                        }}
                      >
                        {t('helperEvent.publish')}
                      </IonItemOption>
                    )}
                    {!isDraft && shiftsNeeded > 0 && !isCancelled && (
                      <IonItemOption
                        color="tertiary"
                        onClick={(e) => {
                          closeSliding(e);
                          setShiftEventId(event.id);
                        }}
                      >
                        {t('shifts.open')}
                      </IonItemOption>
                    )}
                    {!isDraft && shiftsNeeded > 0 && isAdmin && hasStarted && (
                      <IonItemOption
                        color="secondary"
                        onClick={(e) => {
                          closeSliding(e);
                          setRosterEventId(event.id);
                        }}
                      >
                        {t('roster.open')}
                      </IonItemOption>
                    )}
                    {editable && (
                      <IonItemOption
                        color="medium"
                        onClick={(e) => {
                          closeSliding(e);
                          setEditEventId(event.id);
                        }}
                      >
                        {t('eventEdit.open')}
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}

                {/* Zu- und Absagen durch Wischen nach rechts: grün der Haken,
                    rot das Kreuz – nur die Gegenantwort zum aktuellen Stand.
                    Die Option trägt den Namen, das Symbol ist Schmuck. */}
                {!hasStarted && respondable && (
                  <IonItemOptions side="start">
                    {mine?.status !== 'registered' && (
                      <IonItemOption
                        color="success"
                        aria-label={t('agenda.attend')}
                        disabled={respond.isPending}
                        onClick={(e) => {
                          closeSliding(e);
                          register(event.id);
                        }}
                      >
                        <IonIcon slot="icon-only" icon={checkmarkCircle} aria-hidden="true" />
                      </IonItemOption>
                    )}
                    {mine?.status !== 'excused' && (
                      <IonItemOption
                        color="danger"
                        aria-label={t('agenda.decline')}
                        disabled={respond.isPending}
                        onClick={(e) => {
                          closeSliding(e);
                          openDecline();
                        }}
                      >
                        <IonIcon slot="icon-only" icon={closeCircle} aria-hidden="true" />
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                )}
              </IonItemSliding>
            );
          })}
        </IonList>
      )}

      <CheckInModal
        eventId={checkInEventId}
        onDismiss={() => setCheckInEventId(null)}
      />

      {/* Schritte 4 und 5: Die Zahl steht in der Frage, nicht erst in der
          Antwort – wer bestätigt, weiss, wie viele Geräte gleich klingeln. */}
      <IonAlert
        isOpen={remindEvent !== null}
        header={t('reminder.title')}
        message={t('reminder.confirm', { count: remindEvent?.undecided ?? 0 })}
        onDidDismiss={() => setRemindEvent(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('reminder.send'),
            handler: () => {
              if (!remindEvent) return;
              remind.mutate(remindEvent.id, {
                onSuccess: (result) => {
                  const message = reminderMessage(result);
                  if (message.kind === 'sent') {
                    toast.success(t('reminder.sent', { count: message.count }));
                  } else if (message.kind === 'tooSoon') {
                    // A1: Die Frist läuft noch – der Zeitpunkt erklärt es.
                    toast.success(
                      t('reminder.tooSoon', {
                        when: formatDateTime(message.lastReminder),
                      }),
                    );
                  } else {
                    // A2: Zwischenzeitlich haben alle geantwortet. Das ist
                    // keine Erinnerung von gestern, sondern gar keine.
                    toast.success(t('reminder.noneLeft'));
                  }
                },
                onError: (cause) => toast.failure(cause.message),
              });
            },
          },
        ]}
      />

      <EventQrModal eventId={qrEventId} onDismiss={() => setQrEventId(null)} />

      {/* UC-010 Schritt 2: Eckdaten, «Mein Status» und die Namen hinter den
          Zahlen. Absagen schliesst das Blatt und öffnet das mit dem Grund –
          zwei Karten übereinander stünden sonst auf derselben Ebene. Dasselbe
          gilt für Check-in, Code, Bearbeiten und Einsätze; nur die Erinnerung
          (ein Alert) und das Ausschreiben laufen über dem Detail. */}
      <EventDetailModal
        event={detailEvent}
        members={detailEvent ? affectedMembers(detailEvent.team_id) : []}
        memberId={detailFacts?.isAffected ? (activeMembership?.id ?? null) : null}
        isTrainer={detailEvent ? scope.canPlanFor(detailEvent.team_id) : false}
        eventLabel={eventLabel}
        coverageGap={detailFacts?.gap ?? 0}
        shiftCoverage={
          detailFacts && detailFacts.shiftsNeeded > 0
            ? { filled: detailFacts.shiftsFilled, needed: detailFacts.shiftsNeeded }
            : null
        }
        onDecline={() => {
          if (!detailEvent) return;
          setDetailEventId(null);
          setDecliningEvent({ id: detailEvent.id, startsAt: detailEvent.starts_at });
        }}
        onCheckIn={
          detailEvent && detailFacts?.checkInOpen
            ? leaveDetailFor(() => setCheckInEventId(detailEvent.id))
            : undefined
        }
        onShowQr={
          detailEvent && detailFacts?.checkInOpen && scope.canPlanFor(detailEvent.team_id)
            ? leaveDetailFor(() => setQrEventId(detailEvent.id))
            : undefined
        }
        onRemind={
          detailEvent && detailFacts?.remindable
            ? () =>
                setRemindEvent({ id: detailEvent.id, undecided: detailFacts.tally.undecided })
            : undefined
        }
        onEdit={
          detailEvent && detailFacts?.editable
            ? leaveDetailFor(() => setEditEventId(detailEvent.id))
            : undefined
        }
        onOpenShifts={
          detailEvent &&
          detailFacts &&
          !detailFacts.isDraft &&
          !detailFacts.isCancelled &&
          detailFacts.shiftsNeeded > 0
            ? leaveDetailFor(() => setShiftEventId(detailEvent.id))
            : undefined
        }
        onOpenRoster={
          detailEvent &&
          detailFacts &&
          !detailFacts.isDraft &&
          detailFacts.shiftsNeeded > 0 &&
          isAdmin &&
          detailFacts.hasStarted
            ? leaveDetailFor(() => setRosterEventId(detailEvent.id))
            : undefined
        }
        onPublish={
          detailEvent && detailFacts?.isDraft && isAdmin
            ? () => publishEvent(detailEvent.id)
            : undefined
        }
        isPublishing={publish.isPending}
        onDelete={
          detailEvent && detailFacts?.editable
            ? leaveDetailFor(() =>
                setDeletingEvent({ id: detailEvent.id, title: detailEvent.title }),
              )
            : undefined
        }
        onDismiss={() => setDetailEventId(null)}
      />

      {/* Löschen fragt zuerst (guidelines §2): Der Termin ist danach weg, samt
          Antworten und Schichten. Einen Termin mit gebuchten Punkten hält
          `delete_event()` fest und sagt, dass nur noch Absagen geht. */}
      <IonAlert
        isOpen={deletingEvent !== null}
        header={t('eventEdit.delete')}
        message={t('eventEdit.deleteConfirm', { title: deletingEvent?.title ?? '' })}
        onDidDismiss={() => setDeletingEvent(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('eventEdit.delete'),
            role: 'destructive',
            handler: () => {
              const id = deletingEvent?.id;
              if (!id) return;
              deleteEvent.mutate(id, {
                onSuccess: () => toast.success(t('eventEdit.deleted')),
                onError: (cause) => toast.failure(cause.message),
              });
            },
          },
        ]}
      />

      {/* UC-009 A2 und FR-023. Das Blatt entsteht erst mit dem Termin: Ohne
          ihn hätte es nichts zu bearbeiten, und `IonModal` behielte den Stand
          des zuletzt geöffneten. */}
      <EventEditModal
        event={editEvent ?? null}
        onDismiss={() => setEditEventId(null)}
        onDone={(outcome) => {
          setEditEventId(null);
          toast.success(
            t(outcome === 'cancelled' ? 'eventEdit.cancelled' : 'eventEdit.changed'),
          );
        }}
      />

      <ShiftRosterModal
        isOpen={rosterEventId !== null}
        shifts={rosterEvent?.shifts ?? []}
        onDismiss={() => setRosterEventId(null)}
      />

      <ShiftListModal
        isOpen={shiftEventId !== null}
        eventTitle={shiftEvent?.title ?? ''}
        location={shiftEvent?.location ?? null}
        why={shiftEvent?.why ?? null}
        shifts={shiftEvent?.shifts ?? []}
        attendance={shiftEvent?.attendance ?? []}
        memberId={activeMembership?.id ?? null}
        onDismiss={() => setShiftEventId(null)}
      />

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
                // A1 Schritt 4: Die Prämie wird genannt, wenn sie entstand.
                toast.success(
                  result.pointsAwarded > 0
                    ? t('agenda.declinedWithPoints', { points: result.pointsAwarded })
                    : t('agenda.declined'),
                );
              },
              onError: (cause) => toast.failure(cause.message),
            },
          );
        }}
      />

      <HelperEventModal
        isOpen={isHelperOpen}
        onDismiss={() => setHelperOpen(false)}
        onDone={(published, muted) => {
          setHelperOpen(false);
          if (!published) {
            toast.success(t('helperEvent.draftSaved'));
          } else {
            // A3: Sichtbar, aber ohne Push. Die Schreibaktion ist trotzdem
            // durchgegangen – der Grund gehört genannt, nicht als Fehler (§5).
            toast.success(
              muted ? t('helperEvent.mutedHint') : t('helperEvent.published'),
            );
          }
        }}
      />

      <EventFormModal
        isOpen={isFormOpen}
        onDismiss={() => setFormOpen(false)}
        onDone={() => {
          setFormOpen(false);
          toast.success(t('eventForm.created'));
        }}
      />

      <AgendaFilterModal
        isOpen={isFilterOpen}
        value={filter}
        teams={filterableTeams}
        onApply={setFilter}
        onDismiss={() => setFilterOpen(false)}
      />
    </AppPage>
  );
}
