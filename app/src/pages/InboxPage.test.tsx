import { fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxPage } from './InboxPage';
import { renderWithProviders, ionProp } from '../test/utils';
import type { Notification } from '../lib/database.types';

const markRead = vi.fn();
const failure = vi.fn();
let inbox: Notification[] = [];
let isLoading = false;
let error: Error | null = null;
/** Was die Abfrage zum angetippten Gegenstand findet – `null` heisst «weg». */
let found: { id: string } | null = { id: 'e1' };

vi.mock('../hooks/useNews', () => ({
  useInbox: () => ({ data: inbox, isLoading, error, refetch: vi.fn() }),
  useMarkNotificationRead: () => ({ mutate: markRead, isPending: false, error: null }),
}));

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ activeClub: { id: 'c1' }, activeMembership: { id: 'm1' } }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), failure }),
}));

// Die Abfragen zum Gegenstand: `eventQuery`/`taskQuery` treiben das Öffnen,
// `useEvent`/`useTask` füttern das Blatt. Beide lesen in der App denselben
// Zwischenspeicher – hier reicht dieselbe Antwort.
vi.mock('../hooks/useAgenda', () => ({
  eventQuery: (_clubId: string | undefined, id: string) => ({
    queryKey: ['agenda', 'c1', 'one', id],
    queryFn: async () => found,
  }),
  useEvent: (id: string | null) => ({ data: id === null ? undefined : found }),
}));

vi.mock('../hooks/useTasks', () => ({
  taskQuery: (_clubId: string | undefined, id: string) => ({
    queryKey: ['tasks', 'c1', 'one', id],
    queryFn: async () => found,
  }),
  useTask: (id: string | null) => ({ data: id === null ? undefined : found }),
}));

// Das Blatt selbst ist anderswo geprüft (EventDetailModal, TaskDetailModal);
// hier zählt nur, dass es den richtigen Gegenstand bekommt. IonModal rendert
// seinen Inhalt in jsdom ohnehin nicht (docs/TESTING.md).
vi.mock('../components/LinkedDetail', () => ({
  LinkedDetail: ({ event, task }: { event: { id: string } | null; task: { id: string } | null }) => (
    <div data-testid="linked-detail">{event?.id ?? task?.id ?? ''}</div>
  ),
}));

function entry(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    user_id: 'u1',
    club_id: 'c1',
    category: 'event',
    title: 'Kommst du?',
    body: 'Training – 20.09.2026 19:00',
    link: '/tabs/agenda?event=e1',
    read_at: null,
    created_at: '2026-09-18T10:00:00.000Z',
    ...overrides,
  } as Notification;
}

/** Der geöffnete Gegenstand, wie ihn `LinkedDetail` bekommt. */
const opened = (container: HTMLElement) =>
  container.querySelector('[data-testid="linked-detail"]')?.textContent;

/**
 * FR-078 und NFR-009: Die Inbox ist der vollständige Ersatzweg für jede
 * Zustellung. Geprüft wird, dass eine Nachricht dorthin führt, wohin sie
 * zeigt (UC-015 BR-062) und dass Ungelesenes als solches erkennbar ist.
 */
describe('InboxPage', () => {
  beforeEach(() => {
    inbox = [entry()];
    isLoading = false;
    error = null;
    found = { id: 'e1' };
    vi.clearAllMocks();
  });

  it('öffnet den Termin als Blatt statt im Agenda-Tab (BR-062)', async () => {
    // Ein Tab-Wechsel für einen einzelnen Termin liesse den Weg zurück in die
    // Inbox in einem fremden Verlauf enden.
    const { container } = renderWithProviders(<InboxPage />);
    const item = container.querySelector('ion-item')!;
    expect(ionProp(item, 'routerLink')).toBeUndefined();

    fireEvent.click(item);

    await waitFor(() => expect(opened(container)).toBe('e1'));
  });

  it('öffnet auch die Aufgabe als Blatt (BR-070)', async () => {
    inbox = [entry({ category: 'task', link: '/tabs/marketplace?task=t1' })];
    found = { id: 't1' };
    const { container } = renderWithProviders(<InboxPage />);

    fireEvent.click(container.querySelector('ion-item')!);

    await waitFor(() => expect(opened(container)).toBe('t1'));
  });

  it('steuert eine ganze Seite weiterhin an', () => {
    // Für eine Seite gibt es kein Blatt – das Protokoll ist der Tab.
    inbox = [entry({ category: 'meeting', link: '/tabs/profile/meeting' })];
    const { container } = renderWithProviders(<InboxPage />);
    expect(ionProp(container.querySelector('ion-item')!, 'routerLink')).toBe(
      '/tabs/profile/meeting',
    );
  });

  it('sagt es, wenn der Gegenstand nicht mehr da ist', async () => {
    // Die Nachricht bleibt stehen, der Termin ist gelöscht. Ein Tap, der
    // nichts tut, sähe aus wie ein Fehler der App.
    found = null;
    const { container } = renderWithProviders(<InboxPage />);

    fireEvent.click(container.querySelector('ion-item')!);

    await waitFor(() =>
      expect(failure).toHaveBeenCalledWith('Dieser Eintrag ist nicht mehr da.'),
    );
    expect(opened(container)).toBe('');
  });

  it('markiert beim Öffnen als gelesen', async () => {
    const { container } = renderWithProviders(<InboxPage />);
    fireEvent.click(container.querySelector('ion-item')!);
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('n1'));
  });

  it('kennzeichnet Ungelesenes', () => {
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.querySelector('ion-badge')).toHaveTextContent('Neu');
    expect(container.querySelector('ion-list-header')).toHaveTextContent('1 ungelesen');
  });

  it('kennzeichnet Gelesenes nicht mehr', () => {
    inbox = [entry({ read_at: '2026-09-18T11:00:00.000Z' })];
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.querySelector('ion-badge')).toBeNull();
  });

  it('führt zurück, wo sie geöffnet wurde – ins Profil oder auf die Start-Seite', () => {
    const profile = renderWithProviders(<InboxPage />);
    expect(ionProp(profile.container.querySelector('ion-back-button')!, 'defaultHref')).toBe(
      '/tabs/profile',
    );
    profile.unmount();

    const dashboard = renderWithProviders(<InboxPage backHref="/tabs/dashboard" />);
    expect(ionProp(dashboard.container.querySelector('ion-back-button')!, 'defaultHref')).toBe(
      '/tabs/dashboard',
    );
  });

  it('zeigt Titel, Text und Zeitpunkt', () => {
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('Kommst du?');
    expect(container.textContent).toContain('Training');
  });

  it('erklärt, wofür die Inbox da ist (NFR-009)', () => {
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('auch ohne Push');
  });

  it('zeigt eine leere Inbox erklärt statt leer (NFR-037)', () => {
    inbox = [];
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('Keine Nachrichten');
  });

  it('zeigt beim Laden ein Gerüst', () => {
    isLoading = true;
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.querySelector('ion-skeleton-text')).not.toBeNull();
  });

  it('zeigt einen Fehler mit Ausweg', () => {
    error = new Error('kaputt');
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('kaputt');
  });

  it('markiert beim Aufbau nichts als gelesen', () => {
    renderWithProviders(<InboxPage />);
    expect(markRead).not.toHaveBeenCalled();
  });

  // FR-183: Jede Zeile sagt, warum sie da ist – der Satz des Auslösers, sonst
  // der Standardsatz der Kategorie. Eine Meldung, deren Zweck man erraten
  // muss, ist eine Aufforderung.
  it('zeigt den Standardsatz der Kategorie als Warum', () => {
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('Warum:');
    expect(container.textContent).toContain('Der Verein plant mit deiner Antwort');
  });

  it('zieht das Warum des Auslösers dem Standardsatz vor', () => {
    inbox = [
      entry({
        category: 'task',
        title: 'Kuchenstand am Turnier',
        why: 'Der Erlös finanziert die Trikots der Junioren.',
      }),
    ];
    const { container } = renderWithProviders(<InboxPage />);
    expect(container.textContent).toContain('Der Erlös finanziert die Trikots der Junioren.');
    expect(container.textContent).not.toContain('Hände braucht');
  });
});
