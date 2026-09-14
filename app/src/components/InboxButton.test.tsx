import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mailOutline, mailUnread } from 'ionicons/icons';
import { InboxButton } from './InboxButton';
import { renderWithProviders, ionProp } from '../test/utils';
import type { Notification } from '../lib/database.types';

let inbox: Notification[] = [];

vi.mock('../hooks/useNews', () => ({
  useInbox: () => ({ data: inbox, isLoading: false, error: null, refetch: vi.fn() }),
}));

function entry(id: string, read: boolean): Notification {
  return {
    id,
    user_id: 'u1',
    club_id: 'c1',
    category: 'event',
    title: 'Kommst du?',
    body: null,
    link: null,
    read_at: read ? '2026-09-18T11:00:00.000Z' : null,
    created_at: '2026-09-18T10:00:00.000Z',
  } as Notification;
}

/**
 * FR-078: Der Eingang zur Inbox steht auf der Start-Seite, und er sagt, ob
 * dort etwas wartet – wie die Glocke der bisherigen myclub-App.
 */
describe('InboxButton', () => {
  beforeEach(() => {
    inbox = [];
  });

  it('zeigt den gefüllten Umschlag und die Zahl, solange etwas ungelesen ist', () => {
    inbox = [entry('n1', false), entry('n2', false), entry('n3', true)];
    const { container } = renderWithProviders(<InboxButton />);

    expect(ionProp(container.querySelector('ion-icon')!, 'icon')).toBe(mailUnread);
    expect(container.querySelector('ion-badge')).toHaveTextContent('2');
    expect(container.querySelector('ion-button')?.getAttribute('aria-label')).toBe(
      'Nachrichten, 2 ungelesen',
    );
  });

  it('zeigt den Umriss ohne Zahl, wenn nichts ungelesen ist', () => {
    inbox = [entry('n1', true)];
    const { container } = renderWithProviders(<InboxButton />);

    expect(ionProp(container.querySelector('ion-icon')!, 'icon')).toBe(mailOutline);
    expect(container.querySelector('ion-badge')).toBeNull();
    expect(container.querySelector('ion-button')?.getAttribute('aria-label')).toBe('Nachrichten');
  });

  it('führt zur Inbox unter dem Start-Tab, nicht in den Profil-Tab', () => {
    const { container } = renderWithProviders(<InboxButton />);
    expect(ionProp(container.querySelector('ion-button')!, 'routerLink')).toBe(
      '/tabs/dashboard/inbox',
    );
  });
});
