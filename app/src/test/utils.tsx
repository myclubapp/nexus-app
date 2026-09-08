/**
 * Render-Helfer für Komponententests.
 *
 * Fast jede Seite der App hängt an drei Kontexten: i18n (vier Sprachen),
 * React Query (Serverzustand) und dem Ionic-Router. Ohne sie wirft schon der
 * erste `useTranslation()`-Aufruf, und der Test misst die Einrichtung statt
 * das Verhalten.
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { IonApp } from '@ionic/react';
import i18n from '../i18n';

/**
 * Eine Query-Instanz je Test: Ein geteilter Cache liesse Ergebnisse von einem
 * Test in den nächsten lecken. `retry: false` lässt Fehlerfälle sofort
 * durchschlagen, statt den Test in die Wiederholung laufen zu lassen.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Startroute des MemoryRouter, z.B. `/tabs/agenda`. */
  route?: string;
  queryClient?: QueryClient;
}

/**
 * Sprache umstellen. `await`en, bevor gerendert wird – ein Wechsel während des
 * Renders käme einen Durchlauf zu spät. Standard ist Deutsch; das setzt
 * `src/test/setup.ts`.
 */
export async function setLanguage(language: 'de' | 'fr' | 'it' | 'en') {
  await i18n.changeLanguage(language);
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { route = '/', queryClient = createTestQueryClient(), ...renderOptions } =
    options;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <IonApp>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </IonApp>
        </QueryClientProvider>
      </I18nextProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

/**
 * Eigenschaften einer Ionic-Komponente auslesen.
 *
 * React setzt Eigenschaften auf Web-Komponenten als DOM-Properties, nicht als
 * Attribute – `getAttribute('disabled')` liefert deshalb immer `null`. Und weil
 * Stencil in jsdom nicht rendert, hat `disabled` dort auch keine Wirkung: Ein
 * Klick erreicht den Handler trotzdem. Geprüft wird darum die übergebene
 * Eigenschaft, nicht das Verhalten von Ionic.
 */
export function ionProp<T = unknown>(element: Element, name: string): T {
  return (element as unknown as Record<string, T>)[name];
}
