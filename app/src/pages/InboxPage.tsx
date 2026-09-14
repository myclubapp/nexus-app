import { useState } from 'react';
import {
  IonBadge,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
} from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { LinkedDetail } from '../components/LinkedDetail';
import { ListSection } from '../components/ListSection';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { eventQuery, useEvent } from '../hooks/useAgenda';
import { useClub } from '../hooks/useClub';
import { useInbox, useMarkNotificationRead } from '../hooks/useNews';
import { taskQuery, useTask } from '../hooks/useTasks';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import { linkTarget, type LinkTarget } from '../lib/linkTarget';

/** Was die Inbox als Blatt öffnet – ein Termin oder eine Aufgabe. */
type Sheet = Exclude<LinkTarget, { kind: 'page' }>;

interface InboxPageProps {
  /**
   * Wohin der Zurück-Knopf führt. Die Seite hängt zweimal im Baum: unter dem
   * Profil (Voreinstellung) und unter dem Start-Tab hinter `InboxButton` –
   * ein Rücksprung in den jeweils anderen Tab wäre ein Tabwechsel per Knopf.
   */
  backHref?: string;
}

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
 *
 * **Meint die Nachricht einen einzelnen Gegenstand – einen Termin, eine
 * Aufgabe –, öffnet er sich als Blatt über der Liste** und nicht in seinem
 * Tab. Der Tab-Wechsel führte sonst in einen fremden Verlauf: Der Zurück-Weg
 * landet in der Agenda, nicht in der Inbox, aus der man kam. Ionic empfiehlt
 * für Inhalt quer über Tabs das Modal; `linkTarget()` sagt, wann ein Verweis
 * einer ist. Alles Übrige – ganze Seiten wie das Protokoll oder der Puls –
 * bleibt ein `routerLink`.
 */
export function InboxPage({ backHref = '/tabs/profile' }: InboxPageProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeClub } = useClub();
  const inbox = useInbox();
  const markRead = useMarkNotificationRead();

  // Der geöffnete Gegenstand. Nur die Kennung im Zustand, nicht die Zeile:
  // Das Blatt liest sie über `useEvent`/`useTask` aus demselben
  // Zwischenspeicher und zeigt deshalb auch nach einer Antwort darin den
  // neuen Stand, nicht den von vorhin.
  const [opened, setOpened] = useState<Sheet | null>(null);
  // Zwischen Tap und Blatt liegt eine Abfrage. Solange sie läuft, dreht das
  // Rad in der angetippten Zeile – dort, wo der Finger ist.
  const [busyId, setBusyId] = useState<string | null>(null);
  const event = useEvent(opened?.kind === 'event' ? opened.id : null);
  const task = useTask(opened?.kind === 'task' ? opened.id : null);

  /**
   * Den Gegenstand holen und erst dann öffnen.
   *
   * `fetchQuery` und nicht ein Effekt über einer laufenden Abfrage: Die
   * Antwort gehört zu dem Tap, der sie ausgelöst hat. Sie füllt denselben
   * Zwischenspeicher, aus dem `useEvent`/`useTask` gleich darauf lesen – das
   * Blatt steht also ohne zweite Runde.
   *
   * Gibt es den Gegenstand nicht mehr – gelöscht, oder nicht mehr sichtbar –,
   * bleibt die Nachricht stehen und sagt es. Ein Tap, der nichts tut, sieht
   * aus wie ein Fehler der App.
   */
  async function openSheet(sheet: Sheet, rowId: string) {
    setBusyId(rowId);
    try {
      const found =
        sheet.kind === 'event'
          ? await queryClient.fetchQuery(eventQuery(activeClub?.id, sheet.id))
          : await queryClient.fetchQuery(taskQuery(activeClub?.id, sheet.id));
      if (found === null) toast.failure(t('inbox.gone'));
      else setOpened(sheet);
    } catch (cause) {
      toast.failure((cause as Error).message || t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  const entries = inbox.data ?? [];
  const unread = entries.filter((entry) => entry.read_at === null).length;

  return (
    <AppPage title={t('inbox.title')} backHref={backHref} onRefresh={() => inbox.refetch()}>
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
          {entries.map((entry) => {
            const target = linkTarget(entry.link);
            // Ein Gegenstand öffnet sich hier, eine Seite wird angesteuert.
            const sheet = target !== null && target.kind !== 'page' ? target : null;
            return (
              <IonItem
                key={entry.id}
                button
                detail={target !== null && busyId !== entry.id}
                routerLink={sheet === null ? (entry.link ?? undefined) : undefined}
                onClick={() => {
                  if (entry.read_at === null) markRead.mutate(entry.id);
                  if (sheet) void openSheet(sheet, entry.id);
                }}
              >
                <IonLabel className="ion-text-wrap">
                  <h2>{entry.title}</h2>
                  {entry.body && <p>{entry.body}</p>}
                  <IonNote>{formatDateTime(entry.created_at)}</IonNote>
                </IonLabel>
                {busyId === entry.id ? (
                  <IonSpinner slot="end" name="crescent" aria-label={t('common.loading')} />
                ) : (
                  entry.read_at === null && (
                    <IonBadge slot="end" color="primary">
                      {t('inbox.new')}
                    </IonBadge>
                  )
                )}
              </IonItem>
            );
          })}
        </ListSection>
      )}

      {/* Der Termin und die Aufgabe hinter einer Nachricht – als Blatt über
          dieser Liste, damit der Weg zurück der Zurück-Wisch bleibt. */}
      <LinkedDetail
        event={event.data ?? null}
        task={task.data ?? null}
        onDismiss={() => setOpened(null)}
      />
    </AppPage>
  );
}
