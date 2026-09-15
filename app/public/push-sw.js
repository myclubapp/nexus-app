/**
 * Der Empfang im Browser (UC-052, FR-199).
 *
 * **Warum eine eigene Datei und kein `src/sw.ts`?** Weil der Service Worker
 * dieser App von Workbox erzeugt wird (`generateSW`) und nichts anderes tut,
 * als den Vorrat zu verwalten. Auf `injectManifest` umzustellen, hiesse, die
 * Erzeugung von Hand nachzubauen – für dreissig Zeilen Empfang. Stattdessen
 * zieht der erzeugte Worker diese Datei über `importScripts` herein
 * (`vite.config.ts`, `workbox.importScripts`). Sie ist deshalb bewusst
 * schlichtes JavaScript ohne Bausatz: Was hier steht, läuft genau so.
 *
 * **Die Gegenseite ist `_shared/webpush.ts`.** Was dort in den Umschlag
 * gelegt wird, wird hier ausgepackt: `{ title, body, link, category, id }`.
 */

/* global self, clients */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Ein Push ohne brauchbaren Inhalt ist kein Grund zu schweigen: Die
    // Browser verlangen für jedes Abonnement mit `userVisibleOnly` eine
    // sichtbare Meldung, und wer keine zeigt, verliert die Erlaubnis.
    payload = { title: 'nexus', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'nexus', {
      body: payload.body || '',
      icon: '/pwa-192x192.png',
      badge: '/favicon-96x96.png',
      // Die Kennung der Meldung als `tag`: Kommt dieselbe Meldung ein zweites
      // Mal an – etwa weil ein Lauf nach einem Abbruch wiederholt wurde –,
      // ersetzt sie die erste, statt sich daneben zu stellen.
      tag: payload.id || undefined,
      data: { link: payload.link || '/tabs/inbox', category: payload.category },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const link = (event.notification.data && event.notification.data.link) || '/tabs/inbox';
  const target = new URL(link, self.location.origin);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Ein bereits offenes Fenster wird nach vorn geholt und umgeleitet –
      // sonst stünde die App nach jedem Antippen ein zweites Mal da, jedes
      // Mal mit einer neuen Anmeldung.
      for (const window of windows) {
        if (new URL(window.url).origin !== target.origin) continue;
        return window
          .focus()
          .then((focused) => {
            const client = focused || window;
            return client.navigate ? client.navigate(target.href) : undefined;
          })
          // `navigate()` wirft bei einem Fenster, das dieser Worker nicht
          // steuert – etwa unmittelbar nach einer Aktualisierung. Dann ist ein
          // neues Fenster besser als eine verschluckte Ausnahme und gar nichts.
          .catch(() => clients.openWindow(target.href));
      }
      return clients.openWindow(target.href);
    }),
  );
});
