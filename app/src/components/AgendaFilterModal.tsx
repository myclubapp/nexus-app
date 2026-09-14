import { useEffect, useId, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { ListSection } from './ListSection';
import type { EventType } from '../lib/database.types';

/**
 * Die Terminarten des Filters, in der Reihenfolge von `events.type`
 * (0003_agenda.sql, verengt in 0072). Beschriftet über `eventLabel()` – der
 * Verein nennt sie.
 */
export const FILTERABLE_EVENT_TYPES: readonly EventType[] = [
  'training',
  'match',
  'gv',
  'social',
  'helper',
  'meeting',
];

/** Was die Agenda eingrenzt – leer heisst: alles. */
export interface AgendaFilterState {
  /** Nur diese Terminarten; leer heisst alle. */
  types: readonly EventType[];
  /** Nur dieses Team – Vereinstermine ohne Team bleiben immer dabei. */
  teamId: string | null;
}

export const EMPTY_AGENDA_FILTER: AgendaFilterState = { types: [], teamId: null };

/**
 * Der Filter aus der Adresse – `/tabs/agenda?type=helper` aus dem Marktplatz.
 *
 * Mehrere Arten stehen als Liste darin (`type=helper,social`). Was keine
 * bekannte Terminart ist, fällt weg; bleibt nichts übrig, gibt die Funktion
 * `null` zurück und die Agenda lässt den gesetzten Filter in Ruhe – ein
 * verirrter Parameter darf keine Auswahl löschen.
 */
export function agendaFilterFromParam(value: string | null): AgendaFilterState | null {
  const types = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry): entry is EventType =>
      FILTERABLE_EVENT_TYPES.includes(entry as EventType),
    );

  return types.length > 0 ? { types, teamId: null } : null;
}

/**
 * Wie viele Filter gesetzt sind – je Abschnitt einer, nicht je Chip. Die
 * Zahl steht am Filterknopf der Agenda und auf «Anwenden».
 */
export function countActiveFilters(filter: AgendaFilterState): number {
  return (filter.types.length > 0 ? 1 : 0) + (filter.teamId ? 1 : 0);
}

interface Team {
  id: string;
  name: string;
}

interface AgendaFilterFieldsProps {
  value: AgendaFilterState;
  onChange: (next: AgendaFilterState) => void;
  /** Die wählbaren Teams; ohne Teams entfällt der Abschnitt. */
  teams: readonly Team[];
}

/**
 * Der Inhalt des Filter-Blatts: Chips zum Antippen, je Abschnitt eine
 * Gruppe – das Muster der Kundenliste in der venova-App.
 *
 * Die Terminarten sind eine Mehrfachauswahl (zwei Arten zusammen ist ein
 * häufiger Wunsch: «Spiele und Trainings»), das Team eine Einfachauswahl,
 * weil die Abfrage nur eines kennt. Kein «Alle»-Chip: Nichts gewählt heisst
 * alles, der Hinweis darunter sagt es.
 */
export function AgendaFilterFields({ value, onChange, teams }: AgendaFilterFieldsProps) {
  const { t } = useTranslation();
  const { eventLabel } = useClub();

  function toggleType(type: EventType) {
    const types = value.types.includes(type)
      ? value.types.filter((entry) => entry !== type)
      : [...value.types, type];
    onChange({ ...value, types });
  }

  function toggleTeam(teamId: string) {
    onChange({ ...value, teamId: value.teamId === teamId ? null : teamId });
  }

  return (
    <>
      <ListSection title={t('agenda.typeFilter')} footnote={t('agenda.filter.typesHint')}>
        <div className="app-chip-group" role="group" aria-label={t('agenda.typeFilter')}>
          {FILTERABLE_EVENT_TYPES.map((type) => {
            const selected = value.types.includes(type);
            return (
              <IonChip
                key={type}
                role="checkbox"
                aria-checked={selected ? 'true' : 'false'}
                color={selected ? 'primary' : 'medium'}
                outline={!selected}
                onClick={() => toggleType(type)}
              >
                {selected && <IonIcon icon={checkmark} aria-hidden="true" />}
                {eventLabel(type)}
              </IonChip>
            );
          })}
        </div>
      </ListSection>

      {teams.length > 0 && (
        <ListSection title={t('agenda.teamFilter')} footnote={t('agenda.filter.teamsHint')}>
          <div className="app-chip-group" role="group" aria-label={t('agenda.teamFilter')}>
            {teams.map((team) => {
              const selected = value.teamId === team.id;
              return (
                <IonChip
                  key={team.id}
                  role="radio"
                  aria-checked={selected ? 'true' : 'false'}
                  color={selected ? 'primary' : 'medium'}
                  outline={!selected}
                  onClick={() => toggleTeam(team.id)}
                >
                  {selected && <IonIcon icon={checkmark} aria-hidden="true" />}
                  {team.name}
                </IonChip>
              );
            })}
          </div>
        </ListSection>
      )}
    </>
  );
}

interface AgendaFilterModalProps {
  isOpen: boolean;
  /** Der Filter, der gerade gilt – der Entwurf im Blatt beginnt damit. */
  value: AgendaFilterState;
  teams: readonly Team[];
  onApply: (next: AgendaFilterState) => void;
  onDismiss: () => void;
}

/**
 * Das Filter-Blatt der Agenda – nach dem Vorbild des `CustomerFilterModal`
 * der venova-App: Schliessen links, Zurücksetzen rechts, die Chips im
 * Inhalt, «Anwenden» als Block-Knopf in der Fusszeile mit der Zahl der
 * gesetzten Filter.
 *
 * Das Blatt arbeitet auf einem Entwurf und gibt ihn erst mit «Anwenden»
 * heraus: Wer schliesst, behält den Filter, der vorher galt. Kein
 * `FormModal`, weil hier nichts gespeichert wird und der Entwurfswächter
 * bei einem Filter nur stören würde.
 */
export function AgendaFilterModal({
  isOpen,
  value,
  teams,
  onApply,
  onDismiss,
}: AgendaFilterModalProps) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  const modal = useRef<HTMLIonModalElement>(null);
  const titleId = useId();
  const [draft, setDraft] = useDraft(value, isOpen);
  const count = countActiveFilters(draft);

  function dismiss() {
    if (modal.current?.dismiss) void modal.current.dismiss();
    else onDismiss();
  }

  function apply() {
    onApply(draft);
    dismiss();
  }

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={dismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {t('agenda.filter.title')}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton disabled={count === 0} onClick={() => setDraft(EMPTY_AGENDA_FILTER)}>
              {t('common.reset')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent color="light">
        <AgendaFilterFields value={draft} onChange={setDraft} teams={teams} />
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <IonButton expand="block" className="ion-margin-horizontal" onClick={apply}>
            {count > 0 ? t('agenda.filter.applyCount', { count }) : t('agenda.filter.apply')}
          </IonButton>
        </IonToolbar>
      </IonFooter>
    </IonModal>
  );
}

/**
 * Der Entwurf im Blatt: Beim Öffnen frisch vom geltenden Filter, danach
 * unabhängig davon, bis «Anwenden» ihn zurückgibt.
 */
function useDraft(value: AgendaFilterState, isOpen: boolean) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    // Nur der Übergang zu «offen» zählt: Die Seite wendet erst beim
    // Schliessen an, ein neuer `value` bei offenem Blatt kommt nicht vor.
    if (isOpen) setDraft(value);
  }, [isOpen]);
  return [draft, setDraft] as const;
}
