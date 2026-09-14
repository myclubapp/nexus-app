import type { MouseEvent } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  alertCircle,
  checkmarkCircle,
  checkmarkDoneCircle,
  closeCircle,
  helpCircle,
  informationCircle,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus, EventType } from '../lib/database.types';
import { eventTypeIcon } from '../lib/eventIcons';

export interface StatusLook {
  icon: string;
  color: 'success' | 'danger' | 'warning' | 'primary';
  /**
   * Schlüssel unter `agenda.statusLabel` – der Name für Bedienhilfen. Drei
   * davon lassen sich umschalten und bekommen als Knopf den Zusatz aus
   * `agenda.statusAction`.
   */
  labelKey: 'open' | 'registered' | 'present' | 'excused' | 'absent' | 'cancelled' | 'locked';
}

interface StatusContext {
  isCancelled?: boolean;
  /** Der Termin hat begonnen – ohne Antwort gibt es nichts mehr zu tun (BR-038). */
  isLocked?: boolean;
}

/**
 * Symbol und Farbe zu einem Antwortstand – dieselbe Zuordnung wie das
 * `StatusIcon` der bestehenden myclub-App: gelbes Fragezeichen für «noch
 * offen», grüner Haken für «zugesagt», rotes Kreuz für «abgesagt», rotes
 * Ausrufezeichen für einen abgesagten Termin. Wer die alte App kennt, liest
 * die Agenda hier ohne Legende.
 */
export function statusLook(
  status: AttendanceStatus | null,
  { isCancelled = false, isLocked = false }: StatusContext = {},
): StatusLook {
  if (isCancelled) return { icon: alertCircle, color: 'danger', labelKey: 'cancelled' };
  if (status === null && isLocked) {
    return { icon: informationCircle, color: 'primary', labelKey: 'locked' };
  }
  switch (status) {
    case 'registered':
      return { icon: checkmarkCircle, color: 'success', labelKey: 'registered' };
    case 'present':
      // Anwesend ist mehr als zugesagt – der doppelte Haken sagt es.
      return { icon: checkmarkDoneCircle, color: 'success', labelKey: 'present' };
    case 'excused':
      return { icon: closeCircle, color: 'danger', labelKey: 'excused' };
    case 'absent':
      return { icon: closeCircle, color: 'danger', labelKey: 'absent' };
    default:
      return { icon: helpCircle, color: 'warning', labelKey: 'open' };
  }
}

/** Die Gegenantwort zum aktuellen Stand – was ein Tippen auslöst. */
export function nextResponse(status: AttendanceStatus | null): 'registered' | 'excused' {
  return status === 'registered' || status === 'present' ? 'excused' : 'registered';
}

interface AttendanceStatusIconProps extends StatusContext {
  status: AttendanceStatus | null;
  /**
   * Der Termin gilt nicht für diese Person (anderes Team). Dann steht statt
   * des Antwortstands das Symbol der Terminart – es sagt, worum es geht,
   * wo es nichts zu antworten gibt.
   */
  isAffected?: boolean;
  /** Die Terminart – nur gebraucht, solange kein Antwortstand zu zeigen ist. */
  eventType?: EventType | null;
  /**
   * Ein eigener Name für Bedienhilfen. Nötig, wo derselbe Stand etwas
   * anderes heisst als eine Terminzusage – eine Schicht wird «übernommen»,
   * nicht «zugesagt», und «voll» ist kein begonnener Termin.
   */
  label?: string;
  /**
   * Tippen wechselt zur Gegenantwort. Ohne Handler ist das Symbol nur
   * Anzeige – etwa in der Vergangenheit oder für andere Personen.
   */
  onToggle?: (next: 'registered' | 'excused') => void;
  /** Während die Antwort unterwegs ist, nimmt der Knopf kein zweites Tippen an. */
  disabled?: boolean;
  slot?: string;
}

/**
 * Der eigene Antwortstand als Symbol am Zeilenanfang (UC-010).
 *
 * Nachbau des `app-status-icon` der bestehenden myclub-App: 28 px gross,
 * gefüllt, in der Ampelfarbe, und ein Tippen darauf schaltet um. Als Knopf
 * gebaut, damit die Trefferfläche 44 px hat und Bedienhilfen den Stand
 * vorlesen – das Symbol allein wäre stumm.
 */
export function AttendanceStatusIcon({
  status,
  isCancelled = false,
  isLocked = false,
  isAffected = true,
  eventType,
  label,
  onToggle,
  disabled = false,
  slot,
}: AttendanceStatusIconProps) {
  const { t } = useTranslation();

  if (!isAffected) {
    return (
      <span
        slot={slot}
        className="app-status-slot"
        role="img"
        aria-label={label ?? t('agenda.statusLabel.notAffected')}
      >
        <IonIcon
          className="app-status-icon app-status-icon--small"
          icon={eventTypeIcon(eventType)}
          color="primary"
          aria-hidden="true"
        />
      </span>
    );
  }

  const look = statusLook(status, { isCancelled, isLocked });
  const clickable = onToggle !== undefined && !isCancelled && !isLocked;
  // Der Name sagt den Stand, der Zusatz sagt, was ein Tippen täte – und den
  // gibt es nur, wo sich wirklich tippen lässt. Ein «tippen zum Zusagen» an
  // einem Symbol, das nur anzeigt (die Startseite, eine gehaltene Schicht),
  // verspräche Bedienhilfen eine Handlung, die keine ist.
  const stateName = t(`agenda.statusLabel.${look.labelKey}`);
  const actionable =
    look.labelKey === 'open' || look.labelKey === 'registered' || look.labelKey === 'excused';
  const name =
    label ??
    (clickable && actionable
      ? `${stateName} – ${t(`agenda.statusAction.${nextResponse(status)}`)}`
      : stateName);

  if (!clickable) {
    // Kein Knopf, aber dieselbe Spalte wie einer: `app-status-slot` hält die
    // Textkante der Zeile an derselben Stelle (Befund 15).
    return (
      <span slot={slot} className="app-status-slot" role="img" aria-label={name}>
        <IonIcon
          className="app-status-icon"
          icon={look.icon}
          color={look.color}
          aria-hidden="true"
        />
      </span>
    );
  }

  function toggle(event: MouseEvent) {
    // Die Zeile darunter öffnet das Detail – das Umschalten soll das nicht.
    event.stopPropagation();
    onToggle?.(nextResponse(status));
  }

  return (
    <IonButton
      slot={slot}
      fill="clear"
      className="app-status-button"
      aria-label={name}
      disabled={disabled}
      onClick={toggle}
    >
      {/* Der Knopf trägt den Namen; das Symbol darin ist Schmuck (ion-icon
          Accessibility: Icons in beschrifteten Knöpfen sind dekorativ). */}
      <IonIcon
        slot="icon-only"
        className="app-status-icon"
        icon={look.icon}
        color={look.color}
        aria-hidden="true"
      />
    </IonButton>
  );
}
