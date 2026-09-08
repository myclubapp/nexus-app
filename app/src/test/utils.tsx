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
  /** Sprache, in der die Texte erwartet werden. Standard ist Deutsch. */
  language?: 'de' | 'fr' | 'it' | 'en';
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const {
    route = '/',
    queryClient = createTestQueryClient(),
    language = 'de',
    ...renderOptions
  } = options;

  if (i18n.resolvedLanguage !== language) {
    void i18n.changeLanguage(language);
  }

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
