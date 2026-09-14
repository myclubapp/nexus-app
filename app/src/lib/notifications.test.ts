import { describe, expect, it } from 'vitest';
import {
  EMAIL_CATEGORIES,
  EMPTY_SETTINGS,
  MAIL_EXCLUDED_CATEGORIES,
  PUSH_CATEGORIES,
  hasQuietHours,
  isEmailEnabled,
  isPushEnabled,
  isQuietWindowValid,
  toEmailMode,
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
      'event', 'points', 'task', 'news', 'pulse', 'health',
      // Seit UC-030 stellt `notify()` unter `input` zu, seit UC-032 unter
      // `checkin`. Fehlte eine davon hier, liesse sie sich nie abwählen.
      // Seit UC-035 kommt `system` dazu: technische Meldungen zu Anschlüssen.
      // Seit UC-046 `invoice`: neue Rechnung, Fälligkeit, Storno.
      'input', 'checkin', 'system', 'invoice', 'join_request',
    ]);
  });
});

describe('isEmailEnabled (UC-044)', () => {
  it('erlaubt eine Kategorie, die nicht dasteht – wie bei Push', () => {
    expect(isEmailEnabled(settings(), 'event')).toBe(true);
  });

  it('lässt Fürsorge und Befinden nie per E-Mail hinaus (BR-210), auch nicht ausdrücklich erlaubt', () => {
    const chosen = settings({ email: { health: true, checkin: true }, emailMode: 'immediate' });
    expect(isEmailEnabled(chosen, 'health')).toBe(false);
    expect(isEmailEnabled(chosen, 'checkin')).toBe(false);
  });

  it('schaltet mit dem Modus «aus» alles ab', () => {
    const off = settings({ emailMode: 'off', email: { event: true } });
    expect(isEmailEnabled(off, 'event')).toBe(false);
  });

  it('achtet die Abwahl je Kategorie', () => {
    const chosen = settings({ email: { task: false } });
    expect(isEmailEnabled(chosen, 'task')).toBe(false);
    expect(isEmailEnabled(chosen, 'news')).toBe(true);
  });
});

describe('toEmailMode', () => {
  it('nimmt nur bekannte Modi und fällt sonst auf «täglich» – die Vorgabe des Servers', () => {
    expect(toEmailMode('weekly')).toBe('weekly');
    expect(toEmailMode('sometimes')).toBe('daily');
    expect(toEmailMode(null)).toBe('daily');
  });
});

describe('EMAIL_CATEGORIES', () => {
  it('sind alle Kategorien ohne die zwei ausgeschlossenen', () => {
    expect(EMAIL_CATEGORIES).toEqual(
      PUSH_CATEGORIES.filter((c) => !MAIL_EXCLUDED_CATEGORIES.includes(c)),
    );
    expect(EMAIL_CATEGORIES).not.toContain('health');
    expect(EMAIL_CATEGORIES).not.toContain('checkin');
  });
});
