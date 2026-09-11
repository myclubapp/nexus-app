import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Vereinsdaten ändern sich langsam; so bleibt die App auch im Zug
      // bedienbar.
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Der Service Worker gehört ausschliesslich in den Browser.
 *
 * In den nativen Apps liefert Capacitor dieselben Dateien lokal aus
 * (`capacitor://localhost` bzw. `https://localhost`). Ein Service Worker davor
 * brächte dort eine zweite, eigene Kopie der App mit eigenem
 * Aktualisierungsrhythmus – die Fassung im Gerät käme dann nicht mehr aus dem
 * Store. Unter WKWebView registriert er sich ohnehin nicht.
 */
if (!Capacitor.isNativePlatform()) {
  registerSW({ immediate: true });
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
