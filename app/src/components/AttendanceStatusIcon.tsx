import type { MouseEvent } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  alertCircle,
  checkmarkCircle,
  checkmarkDoneCircle,
  closeCircle,
  helpCircle,
  informationCircle,
  personRemoveOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import type { AttendanceStatus } from '../lib/database.types';

export interface StatusLook {
  icon: string;
  color: 'success' | 'danger' | 'warning' | 'primary';
  /** Schlüssel unter `agenda.statusLabel` – der Name für Bedienhilfen. */
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
   * Der Termin gilt nicht für diese Person (anderes Team). Dann steht ein
   * kleines «nicht dabei» statt eines Antwortstands.
   */
  isAffected?: boolean;
  /**
   * Tippen wechselt zur Gegenantwort. Ohne Handler ist das Symbol nur
   * Anzeige – etwa in der Vergangenheit oder für andere Personen.
   */
  onToggle?: (next: 'registered' | 'excused') => void;
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
  onToggle,
  slot,
}: AttendanceStatusIconProps) {
  const { t } = useTranslation();

  if (!isAffected) {
    return (
      <IonIcon
        slot={slot}
        className="app-status-icon app-status-icon--small"
        icon={personRemoveOutline}
        color="primary"
        role="img"
        aria-label={t('agenda.statusLabel.notAffected')}
      />
    );
  }

  const look = statusLook(status, { isCancelled, isLocked });
  const label = t(`agenda.statusLabel.${look.labelKey}`);
  const clickable = onToggle !== undefined && !isCancelled && !isLocked;

  if (!clickable) {
    return (
      <IonIcon
        slot={slot}
        className="app-status-icon"
        icon={look.icon}
        color={look.color}
        role="img"
        aria-label={label}
      />
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
      aria-label={label}
      onClick={toggle}
    >
      <IonIcon slot="icon-only" className="app-status-icon" icon={look.icon} color={look.color} />
    </IonButton>
  );
}
