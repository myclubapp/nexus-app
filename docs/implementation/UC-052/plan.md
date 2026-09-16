# Implementation Plan: UC-052 — Push-Meldungen zustellen

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | System (Versanddienst); Mitglied als Empfänger                       |
| **Goal**          | Der fehlende Transport: Web Push (Browser, PWA) und APNs (iOS-App), abgeholt aus `notifications` – ohne Google |
| **Plan created**  | 2026-09-15                                                           |
| **Status**        | **Partial** – Migration `0104` und Function `push-send` geschrieben und geprüft (Krypto 22/22 und 30/30, Migration 40/40 zurückgerollt). Nicht eingespielt, nicht deployt, keine Schlüssel gesetzt: **noch kein Push hat ein echtes Gerät erreicht**. Erst der Gerätetest macht daraus `Implemented` |

## Overview

Sandros Bitte vom 15.09.2026: «ich möchte web push für pwa und aber auch apple
push mit capacitor plugin».

Damit schliesst sich der Punkt, der seit UC-015 in **jedem** Plan als offen
steht: FR-079. Seit `0045` trägt jede Meldung den Vermerk `push_wanted`, seit
`0004` steht `push_tokens` – und niemand hat je etwas abgeholt. Die Hälfte, die
fehlte, ist die untere.

| Was fehlte | Antwort |
| --- | --- |
| Kein Abholer, kein Versand | `pending_push()`, `mark_push_sent()`, `mark_push_failed()`, Cron `push-send` im Minutentakt – der Aufbau von `0084`, Zeile für Zeile |
| Kein Web-Push-Umschlag | `_shared/webpush.ts`: VAPID (RFC 8292) und `aes128gcm` (RFC 8188/8291), von Hand mit Web Crypto |
| Kein Apple-Weg | `_shared/apns.ts`: ES256-Nachweis aus dem `.p8`, HTTP/2 an Apple |
| Der Browser konnte nichts empfangen | `public/push-sw.js`, vom erzeugten Service Worker über `importScripts` hereingezogen |
| Die iOS-App konnte sich nicht anmelden | Zwei Delegate-Methoden im `AppDelegate`, der native Zweig in `usePushRegistration` |

**Der teuerste Fund beim Bauen:** Der Abholer sperrte die Meldung, **bevor**
feststand, ob ein zustellbares Gerät daran hängt. Solange der APNs-Schlüssel
fehlt, hätte jede Meldung an ein iPhone ihre fünf Versuche verbraucht und wäre
aufgegeben gewesen, bevor der Schlüssel da ist. Seitdem nennt der Versand, was
er kann (`p_platforms`), und bekommt nur, was er kann. Die Prüfung hält genau
das fest.

## Related Use Cases

- **UC-028** Benachrichtigungen einstellen – liefert die Einstellungen, die dieser Versand befolgt, und die Geräte-Anmeldung (A1/A2)
- **UC-044** Meldungen per E-Mail – dieselbe Form an derselben Zeile; wer den einen liest, versteht den anderen
- **UC-053** Profil einrichten – der Ort, an dem die Anmeldung des Geräts tatsächlich angeboten wird

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                    | Status vorher | Ziel        | Notizen                                                                 |
| ------ | ------------------------ | ------------- | ----------- | ----------------------------------------------------------------------- |
| FR-199 | Push-Versand             | neu           | Partial     | `0104`, `push-send`, `_shared/webpush.ts`, `_shared/apns.ts` – gebaut, nicht in Betrieb |
| FR-079 | Push-Benachrichtigung    | Partial       | Partial     | Browser, PWA und iOS stehen; die **Android-App** bleibt offen (kein ntfy-Dienst) |
| C-004  | Push-Kanäle              | Partial       | Partial     | APNs und VAPID gebaut; `android_ntfy` bleibt unbedient                   |
| NFR-015| Secrets                  | Implemented   | Implemented | Schlüssel nur als Function-Secrets; nichts im Repo, nichts in der Datenbank |

### Business Rules

| ID     | Regel | Wo sie steht |
| ------ | ----- | ------------ |
| BR-267 | Fünf Versuche, dann Ruhe – ein nicht eingerichteter Kanal verbraucht keinen | `pending_push(p_platforms)`, Index `notifications_push_pending_idx` |
| BR-268 | Zugestellt heisst: auf mindestens einem Gerät angekommen; wer kein Gerät hat, bekommt keinen Rückstand | `mark_push_sent()`, die Austragung in `pending_push()` |
| BR-269 | Ein Gerät, das der Dienst nicht mehr kennt, wird vergessen | `drop_push_token()`, `gone` in beiden Adaptern |
| BR-117 | Die Inbox bleibt der vollständige Rückfall | unangetastet – der Versand ändert nie `notifications` ausser seinen eigenen Spalten |

---

## Entscheide

| Frage | Entscheid | Warum |
| --- | --- | --- |
| Web Push von Hand oder mit Paket | **Von Hand** (~250 Zeilen) | Die üblichen Pakete bringen Node-Kryptografie mit, die in der Edge-Laufzeit nicht läuft. Web Crypto kann alles Nötige. |
| Service Worker: `injectManifest` oder `importScripts` | **`importScripts`** | Mit `injectManifest` schriebe die App ihren Worker samt Vorrat, Aufräumen und Aktualisierung selbst – für dreissig Zeilen Empfang der falsche Tausch. |
| Sandbox oder Produktion bei APNs | **Selbst herausfinden** | Der WebView weiss nicht, womit er signiert wurde. Ein Fehlversuch je Gerät, einmal – danach steht es in `push_tokens.environment`. |
| Takt des Cron-Laufs | **Jede Minute** (Mail: alle fünf) | Ein Push gehört zur Meldung, nicht zur Zusammenfassung. Ohne Fälliges kostet der Lauf eine Indexabfrage. |
| Android nativ | **Nicht gebaut** | `android_ntfy` bräuchte einen betriebenen ntfy-Dienst. Ein Knopf ohne Dienst ist eine Zusage ohne Deckung; die PWA ist dort der Weg. |
| Text der Meldung | **Wie in der Inbox** | `notifications.title/body` sind deutsche Literale aus `notify()`. Eine Übersetzung im Versand liefe der Inbox davon – das ist ein eigener Befund, kein Teil dieses Plans. |

---

## Umsetzung

| Datei | Was |
| --- | --- |
| `supabase/migrations/0104_push_transport.sql` | `push_tokens.environment`/`last_seen_at` samt Trigger, die drei Push-Spalten an `notifications`, `pending_push()`, `mark_push_sent()`, `mark_push_failed()`, `drop_push_token()`, `set_push_environment()`, `send_pending_push()`, Cron `push-send` |
| `supabase/functions/_shared/webpush.ts` | VAPID-Nachweis, `aes128gcm`-Umschlag, `sendWebPush()` |
| `supabase/functions/_shared/apns.ts` | `.p8`-Nachweis mit 30-Minuten-Fenster, `sendApns()` samt Tor-Suche |
| `supabase/functions/push-send/index.ts` | Der Lauf und die Probemeldung; Tor für `service_role` |
| `app/public/push-sw.js` | `push` und `notificationclick` im Browser |
| `app/vite.config.ts` | `workbox.importScripts` |
| `app/src/lib/push.ts` | `pushChannel()`, `pushReadiness()` mit Kanal |
| `app/src/lib/nativePush.ts` | Anmeldung über das Capacitor-Plugin, Frist von 15 s |
| `app/src/hooks/usePushRegistration.ts` | Der Zweig je Kanal |
| `app/src/components/DeepLinkRouter.tsx` | Das Antippen führt an die Stelle der Meldung |
| `app/ios/App/App/AppDelegate.swift` | Die zwei Delegate-Methoden – ohne sie bleibt `register()` wortlos stumm |
| `app/ios/App/App/App.entitlements` | `aps-environment` |

---

## Prüfung

**Kryptografie, gegen ein erfundenes Gerät** (Deno, Scratchpad):

- Web Push **22/22** – der Umschlag wird mit dem Geräteschlüssel wieder geöffnet und ist inhaltsgleich; ein fremder Schlüssel öffnet ihn nicht; der VAPID-Nachweis hält der Signaturprüfung stand; `410` gilt als «Gerät weg», `500` nicht.
- APNs **30/30** – `fetch` abgefangen: Kopfzeilen, `aps`-Aufbau, Signatur mit dem öffentlichen Teil geprüft, Tor-Suche bei unbekannter Umgebung, Wiederverwendung des Nachweises.

**Migration, gegen die laufende Datenbank** (`db query --linked`, `begin … rollback`): **40/40**, Rollback belegt (Wegwerftabelle nach dem Lauf nicht vorhanden). Darunter die drei Fälle, die sich nur am Verhalten zeigen: kein Versuch ohne bedienbaren Kanal, kein Rückstand für Konten ohne Gerät, «zuletzt gesehen» bleibt beim gelernten Apple-Tor stehen.

**App:** `typecheck`, `lint` (keine neuen Warnungen ausser dem im Haus üblichen `set-state-in-effect`), `i18n:check` (1904 Schlüssel, vier Sprachen), `vitest` 1365/1365.

---

## Offen

1. **`supabase db push`** – gehört Sandro (Auto-Modus sperrt es).
2. **`supabase functions deploy push-send`** – nach dem Merge.
3. **Secrets:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`; für Apple `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY_P8`, optional `APNS_TOPIC`.
4. **`VITE_VAPID_PUBLIC_KEY`** in `.env.local` und in den Vercel-Einstellungen.
5. **Der `.p8`-Schlüssel** – Sandros Entscheid vom 15.09.2026: Er erzeugt ihn im Developer-Portal. Bis dahin läuft der Apple-Zweig ins Leere, **ohne** Meldungen zu verbrennen (BR-267).
6. **Gerätetest** – `docs/test-plans/uc-052-push-versand.md`.
