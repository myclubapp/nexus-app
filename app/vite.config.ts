import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Needed when testing the dev server from a phone on the same network.
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
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
