import {
  IonBadge,
  IonItem,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useInbox, useMarkNotificationRead } from '../hooks/useNews';
import { formatDateTime } from '../lib/format';

/**
 * Die In-App-Inbox (FR-078, NFR-009).
 *
 * Sie ist der vollständige Ersatzweg für jede Zustellung: Ohne sie erreicht
 * eine Benachrichtigung nur, wer Push erlaubt hat – und eine Erinnerung, die
 * niemand abholen kann, ist keine Erinnerung (UC-015, Postcondition).
 *
 * Antippen führt dorthin, wohin die Nachricht zeigt, und markiert sie
 * zugleich als gelesen. Ein eigener Knopf dafür wäre ein Tap, den niemand
 * braucht.
 */
export function InboxPage() {
  const { t } = useTranslation();
  const inbox = useInbox();
  const markRead = useMarkNotificationRead();

  const entries = inbox.data ?? [];
  const unread = entries.filter((entry) => entry.read_at === null).length;

  return (
    <AppPage title={t('inbox.title')} backHref="/tabs/profile" onRefresh={() => inbox.refetch()}>
      {inbox.isLoading ? (
        <SkeletonList />
      ) : inbox.error ? (
        <ErrorState error={inbox.error as Error} onRetry={() => void inbox.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          message={t('inbox.empty')}
          action={{ label: t('dashboard.title'), routerLink: '/tabs/dashboard' }}
        />
      ) : (
        <ListSection
          title={unread > 0 ? t('inbox.unread', { count: unread }) : t('inbox.all')}
          footnote={t('inbox.hint')}
        >
          {entries.map((entry) => (
            <IonItem
              key={entry.id}
              button
              detail={Boolean(entry.link)}
              routerLink={entry.link ?? undefined}
              onClick={() => {
                if (entry.read_at === null) markRead.mutate(entry.id);
              }}
            >
              <IonLabel className="ion-text-wrap">
                <h2>{entry.title}</h2>
                {entry.body && <p>{entry.body}</p>}
                <IonNote>{formatDateTime(entry.created_at)}</IonNote>
              </IonLabel>
              {entry.read_at === null && (
                <IonBadge slot="end" color="primary">
                  {t('inbox.new')}
                </IonBadge>
              )}
            </IonItem>
          ))}
        </ListSection>
      )}
    </AppPage>
  );
}
