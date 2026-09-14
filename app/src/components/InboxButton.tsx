import { IonBadge, IonButton, IonButtons, IonIcon } from '@ionic/react';
import { mailOutline, mailUnread } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useInbox } from '../hooks/useNews';

/**
 * Der Eingang zur Inbox in der Kopfzeile der Start-Seite (FR-078, NFR-009).
 *
 * Die Inbox ist der Kanal, der alle erreicht – auch ohne Push. Ein Ersatzweg,
 * der nur über Profil → Nachrichten zu finden ist, erfüllt das nicht. Der
 * Umschlag ist gefüllt, solange etwas ungelesen ist, sonst ein Umriss; die
 * Zahl daran ist der Schnitt der Glocke in `news.page.html` der bestehenden
 * myclub-App.
 *
 * Er nutzt dieselbe Abfrage wie die Inbox-Seite; ein eigener Zähler wäre eine
 * zweite Wahrheit. Frisch ist er damit so weit wie die Abfrage: beim Betreten
 * des Tabs, nach eigenen Aktionen und nach `staleTime`. Eine Meldung, die
 * eintrifft, während die App offen ist, kommt erst mit Realtime auf
 * `notifications` (Architektur, offen).
 *
 * Das Ziel liegt unter dem Start-Tab (`/tabs/dashboard/inbox`), nicht unter
 * dem Profil: Ein Knopf, der den Tab wechselt, ist bei Ionic ein Fehler.
 */
export function InboxButton() {
  const { t } = useTranslation();
  const inbox = useInbox();
  const unread = (inbox.data ?? []).filter((entry) => entry.read_at === null).length;
  const unreadLabel = t('inbox.unread', { count: unread });
  // Die Beschriftung des Knopfs ersetzt für Bedienhilfen seinen Inhalt; die
  // Zahl muss deshalb in ihr stehen, nicht nur am Badge (§2, Zähler als Badge).
  const label = unread > 0 ? `${t('inbox.title')}, ${unreadLabel}` : t('inbox.title');

  return (
    <IonButtons slot="end">
      <IonButton className="app-inbox-button" aria-label={label} routerLink="/tabs/dashboard/inbox">
        <IonIcon slot="icon-only" icon={unread > 0 ? mailUnread : mailOutline} />
        {unread > 0 && (
          <IonBadge color="primary" className="app-inbox-button__count" aria-label={unreadLabel}>
            {unread}
          </IonBadge>
        )}
      </IonButton>
    </IonButtons>
  );
}
