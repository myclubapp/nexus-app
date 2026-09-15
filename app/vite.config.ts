import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    /**
     * Die App läuft auf drei Wegen: als iOS-App, als Android-App und im
     * Browser. Der Browser-Weg ist keine Notlösung – auf dem Laptop des
     * Vorstands ist er der Hauptweg (NFR-032). Er braucht deshalb ein
     * Manifest, Symbole und einen Offline-Vorrat wie die nativen Apps.
     */
    VitePWA({
      // Eine neue Fassung ersetzt die alte beim nächsten Start, ohne dass
      // jemand eine Aktualisierungsfrage beantworten muss.
      registerType: 'autoUpdate',
      // Die Registrierung steht von Hand in main.tsx, weil sie nur im
      // Browser stattfinden darf – siehe den Kommentar dort.
      injectRegister: null,
      includeAssets: ['favicon-96x96.png', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: '/',
        name: 'myclub',
        short_name: 'myclub',
        description: 'Engagement-Plattform für Vereine',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Kein Hochformat erzwingen: Die App soll auch auf dem Tablet im
        // Querformat und auf dem Laptop brauchbar sein.
        orientation: 'any',
        background_color: '#339bde',
        // Die Vereinsfarbe kommt erst zur Laufzeit aus clubs.settings.theme
        // (src/lib/theme.ts); das Manifest ist statisch und trägt deshalb die
        // Grundfarbe aus theme/variables.css – dieselbe wie `--ion-color-primary`,
        // damit der Start nicht in einer Farbe beginnt, die die App nie zeigt.
        theme_color: '#339bde',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'favicon-96x96.png', sizes: '96x96', type: 'image/png' },
        ],
      },
      workbox: {
        // Nur die eigenen Bausteine. Antworten von Supabase bleiben bewusst
        // ungecacht: Ein Punktestand aus dem Vorrat wäre falsch, und ein
        // zwischengespeichertes Token wäre ein Sicherheitsproblem.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Der App-Bundle liegt über den 2 MiB, die Workbox voreingestellt
        // precacht. Ohne diese Grenze bricht `vite build` ab. Sobald das
        // Bundle aufgeteilt ist, kann der Wert wieder sinken.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5173,
    // Needed when testing the dev server from a phone on the same network.
    host: true,
  },
  build: {
    outDir: 'dist',
    /**
     * Keine Quellkarten im Bau. Sie landen sonst neben dem Bundle auf
     * app.my-club.ch und geben den vollständigen Quelltext heraus – samt
     * Kommentaren, Tabellennamen und den Namen der Datenbankfunktionen, die
     * hinter der RLS stehen. Für die Fehlersuche kostet das nichts: Der
     * Dev-Server liefert seine Karten unabhängig von dieser Angabe, und einen
     * Fehlerdienst, der hochgeladene Karten bräuchte, gibt es hier nicht.
     * Käme je einer dazu, ist 'hidden' die richtige Antwort – Karten bauen,
     * hochladen, aus `dist` löschen –, nicht `true`.
     */
    sourcemap: false,
  },
  /**
   * Abhängigkeiten im Test wie im Browser auflösen.
   *
   * Vitest schickt die Tests durch Vites SSR-Pfad und löst Pakete deshalb mit
   * der Bedingung `node` auf. Ionic baut seine React-Hüllen über `@lit/react`,
   * und dessen Node-Fassung meldet **keine Ereignisse** an: `onIonChange` kam
   * an keinem `ion-toggle` an, jede Zusicherung über einen umgelegten Schalter
   * lief ins Leere und sah aus wie ein Fehler der Ansicht. Für den Browser-Bau
   * ändert das nichts – die App wird nie serverseitig gerendert.
   */
  ssr: {
    resolve: {
      conditions: ['browser', 'development', 'import', 'default'],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Ohne den Cache transformiert jeder Lauf Ionic neu – rund eine Minute.
    fsModuleCache: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // Der Punkte-Ledger und die Saisonlogik sind die Stellen, an denen ein
      // Fehler still falsche Zahlen erzeugt – sie tragen die Testlast.
      include: ['src/lib/**', 'src/hooks/**', 'src/components/**'],
    },
  },
});
