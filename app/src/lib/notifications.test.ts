import { describe, expect, it } from 'vitest';
import {
  EMPTY_SETTINGS,
  PUSH_CATEGORIES,
  hasQuietHours,
  isPushEnabled,
  isQuietWindowValid,
  type NotificationSettings,
} from './notifications';

function settings(overrides: Partial<NotificationSettings> = {}): NotificationSettings {
  return { ...EMPTY_SETTINGS, ...overrides };
}

describe('isPushEnabled', () => {
  it('erlaubt eine Kategorie, die nicht dasteht', () => {
    // Sonst wäre jede neue Kategorie stillschweigend stummgeschaltet.
    expect(isPushEnabled(settings(), 'event')).toBe(true);
  });

  it('achtet die Abwahl je Kategorie (BR-118)', () => {
    const chosen = settings({ push: { event: false, task: true } });
    expect(isPushEnabled(chosen, 'event')).toBe(false);
    expect(isPushEnabled(chosen, 'task')).toBe(true);
    expect(isPushEnabled(chosen, 'news')).toBe(true);
  });
});

describe('isQuietWindowValid', () => {
  it('lässt gar keine stille Zeit zu', () => {
    expect(isQuietWindowValid(settings())).toBe(true);
  });

  it('weist ein halbes Fenster ab – wie der Server', () => {
    expect(isQuietWindowValid(settings({ quietFrom: '22:00' }))).toBe(false);
    expect(isQuietWindowValid(settings({ quietTo: '07:00' }))).toBe(false);
  });

  it('lässt ein Fenster über Mitternacht zu – den häufigeren Fall', () => {
    expect(
      isQuietWindowValid(settings({ quietFrom: '22:00', quietTo: '07:00' })),
    ).toBe(true);
  });

  it('weist ein Fenster ohne Dauer ab', () => {
    expect(
      isQuietWindowValid(settings({ quietFrom: '22:00', quietTo: '22:00' })),
    ).toBe(false);
  });
});

describe('hasQuietHours', () => {
  it('erkennt eingeschaltete stille Zeiten', () => {
    expect(hasQuietHours(settings())).toBe(false);
    expect(hasQuietHours(settings({ quietFrom: '22:00', quietTo: '07:00' }))).toBe(true);
  });
});

describe('PUSH_CATEGORIES', () => {
  it('deckt jede Kategorie ab, unter der zugestellt wird', () => {
    // Die Werte stammen aus den `notify()`-Aufrufen der Migrationen. Fehlt
    // einer, liesse er sich nie abwählen.
    expect([...PUSH_CATEGORIES]).toEqual([
      'event', 'points', 'task', 'news', 'pulse', 'health', 'join_request',
    ]);
  });
});
