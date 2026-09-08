/**
 * Vitest-Setup. Läuft vor jeder Testdatei.
 *
 * Ionic-Komponenten sind Web Components und erwarten Browser-APIs, die jsdom
 * nicht mitbringt. Fehlen sie, brechen Tests mit «is not a function» ab, lange
 * bevor die eigentliche Zusicherung greift.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { setupIonicReact } from '@ionic/react';
import { afterEach, vi } from 'vitest';
import i18n from '../i18n';

// Derselbe Modus wie in App.tsx: die Tests sollen sehen, was die App zeigt.
setupIonicReact({ mode: 'ios' });

// Ohne diesen Schritt entscheidet der Spracherkenner anhand von
// `navigator.language` – in jsdom Englisch. Die Tests prüfen deutsche Texte,
// und `changeLanguage()` erst im Render käme einen Durchlauf zu spät.
await i18n.changeLanguage('de');

afterEach(() => {
  cleanup();
});

// --- Browser-APIs, die jsdom nicht kennt ------------------------------------

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;
}

class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.IntersectionObserver ??= ObserverStub as unknown as typeof IntersectionObserver;
globalThis.ResizeObserver ??= ObserverStub as unknown as typeof ResizeObserver;

Element.prototype.scrollIntoView ??= function scrollIntoView() {};
Element.prototype.animate ??= function animate() {
  return {
    cancel() {},
    finish() {},
    pause() {},
    play() {},
    reverse() {},
    addEventListener() {},
    removeEventListener() {},
    finished: Promise.resolve(),
  } as unknown as Animation;
};

// --- Capacitor -------------------------------------------------------------
// Preferences greift nativ auf das Gerät zu. Im Test hält eine Map denselben
// Vertrag, damit Tests den aktiven Verein setzen können.
vi.mock('@capacitor/preferences', () => {
  const store = new Map<string, string>();
  return {
    Preferences: {
      get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
      set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      }),
      remove: vi.fn(async ({ key }: { key: string }) => {
        store.delete(key);
      }),
      clear: vi.fn(async () => {
        store.clear();
      }),
    },
  };
});

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: { ...actual.Capacitor, isNativePlatform: () => false },
  };
});
