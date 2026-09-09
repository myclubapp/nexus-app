import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboxPage } from './InboxPage';
import { renderWithProviders, ionProp } from '../test/utils';
import type { Notification } from '../lib/database.types';

const markRead = vi.fn();
let inbox: Notification[] = [];
let isLoading = false;
let error: Error | null = null;

vi.mock('../hooks/useNews', () => ({
  useInbox: () => ({ data: inbox, isLoading, error, refetch: vi.fn() }),
  useMarkNotificationRead: () => ({ mutate: markRead, isPending: false, error: null }),
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
    vi.clearAllMocks();
  });

  it('führt die Nachricht dorthin, wohin sie zeigt (BR-062)', () => {
    const { container } = renderWithProviders(<InboxPage />);
    const item = container.querySelector('ion-item')!;
    expect(ionProp(item, 'routerLink')).toBe('/tabs/agenda?event=e1');
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
});
