import { describe, expect, it } from 'vitest';
import de from '../i18n/locales/de.json';
import en from '../i18n/locales/en.json';
import fr from '../i18n/locales/fr.json';
// `it` ist hier vergeben – Vitest bringt es mit.
import itLocale from '../i18n/locales/it.json';
import { notificationWhy, WHY_CATEGORIES, whyKey } from './notificationWhy';

/** Eine `t`-Funktion über der deutschen Datei, ohne i18next einzurichten. */
function translate(key: string): string {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], de) as string ?? key;
}

describe('whyKey', () => {
  it('bildet den Schlüssel einer bekannten Kategorie', () => {
    expect(whyKey('event')).toBe('notifications.why.event');
    expect(whyKey('invoice')).toBe('notifications.why.invoice');
  });

  it('fällt auf «general» zurück statt einen Schlüssel zu erfinden', () => {
    expect(whyKey('quatsch')).toBe('notifications.why.general');
    expect(whyKey(null)).toBe('notifications.why.general');
    expect(whyKey(undefined)).toBe('notifications.why.general');
  });
});

describe('notificationWhy', () => {
  it('nimmt den Satz des Auslösers, wenn er da ist', () => {
    expect(
      notificationWhy({ category: 'task', why: 'Damit die Halle offen ist.' }, translate),
    ).toBe('Damit die Halle offen ist.');
  });

  it('nimmt den Standardsatz, wenn keiner mitkam oder nur Leerraum', () => {
    expect(notificationWhy({ category: 'task', why: null }, translate)).toBe(
      de.notifications.why.task,
    );
    expect(notificationWhy({ category: 'task', why: '   ' }, translate)).toBe(
      de.notifications.why.task,
    );
    expect(notificationWhy({ category: 'task' }, translate)).toBe(de.notifications.why.task);
  });

  it('lässt keine Meldung ohne Warum', () => {
    expect(notificationWhy({ category: null, why: null }, translate)).toBe(
      de.notifications.why.general,
    );
  });
});

describe('Die Standardsätze', () => {
  it('stehen für jede Kategorie in allen vier Sprachen', () => {
    for (const file of [de, fr, itLocale, en]) {
      const why = (file as { notifications: { why: Record<string, string> } }).notifications.why;
      for (const category of WHY_CATEGORIES) {
        expect(why[category], category).toBeTruthy();
      }
    }
  });

  it('deckt jede Kategorie ab, die die Einstellungsseite kennt', () => {
    // `notifications.category.*` ist die Liste der Kategorien im UI. Jede
    // davon braucht einen Satz – sonst steht in der Inbox der Schlüsselname.
    for (const category of Object.keys(de.notifications.category)) {
      expect(WHY_CATEGORIES as readonly string[]).toContain(category);
    }
  });
});
