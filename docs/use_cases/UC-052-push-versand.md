# Use Case: Push-Meldungen zustellen

## Overview

**Use Case ID:** UC-052
**Use Case Name:** Push-Meldungen zustellen
**Primary Actor:** System (Versanddienst); Mitglied als Empfänger
**Goal:** Eine Meldung, die entstanden ist, erreicht die Person auf ihrem Gerät – im Browser, in der PWA und in der iOS-App – ohne dass ein Google-Dienst daran beteiligt ist
**Status:** Partial – vollständig gebaut und geprüft, aber nicht in Betrieb: `0104` ist nicht eingespielt, `push-send` nicht deployt, die Schlüssel sind nicht gesetzt

## Preconditions

- Die Meldung ist über `notify()` entstanden und trägt den Vermerk `push_wanted` (UC-028, `0045`).
- Die Person hat mindestens ein Gerät angemeldet (UC-028 A1).
- Für den betroffenen Kanal sind die Geheimnisse hinterlegt: VAPID-Paar für Web Push, `.p8`-Schlüssel samt Key-ID und Team-ID für APNs.

## Main Success Scenario

1. System stellt jede Minute fest, ob eine Meldung mit Push-Vermerk offen und fällig ist (`send_pending_push()`, Cron `push-send`). Ist keine da, geschieht nichts weiter.
2. System stösst die Edge Function `push-send` an.
3. System stellt fest, welche Kanäle es heute bedienen kann – Web Push, APNs oder beide – und fragt nur nach Meldungen, für die ein Gerät dieses Kanals angemeldet ist.
4. System holt die fälligen Meldungen ab, sperrt sie und zählt je Meldung einen Versuch (`pending_push()`); je angemeldetem Gerät entsteht eine Zustellung.
5. System verschlüsselt die Meldung für jedes Browser-Gerät mit dem Schlüssel des Geräts und legt einen VAPID-Nachweis bei (RFC 8291/8292); für jedes Apple-Gerät baut es die `aps`-Struktur und einen mit dem `.p8` signierten Nachweis.
6. System stellt zu.
7. System quittiert an der Zeile: zugestellt, sobald **ein** Gerät die Meldung hat (`mark_push_sent()`).
8. Mitglied tippt die Meldung an.
9. System öffnet die App an der Stelle, von der die Meldung handelt (`notifications.link`) – im Browser über den Service Worker, in der App über `pushNotificationActionPerformed`.

## Alternative Flows

### A1: Kein Gerät angemeldet

**Trigger:** Die Person hat kein einziges Gerät angemeldet (Schritt 4)
**Flow:**

1. System nimmt den Push-Vermerk zurück und vermerkt «Kein Gerät angemeldet».
2. Die Zeile in der Inbox bleibt vollständig (BR-117).
3. Wer später sein erstes Gerät anmeldet, bekommt die **nächste** Meldung – nicht den Rückstand aus Wochen (BR-268).
4. Use case ends.

### A2: Das Gerät kennt die App nicht mehr

**Trigger:** Der Push-Dienst antwortet mit `404`/`410`, Apple mit `410 Unregistered`
**Flow:**

1. System löscht die Zeile des Geräts (BR-269).
2. Hat ein anderes Gerät derselben Person die Meldung bekommen, gilt sie als zugestellt.
3. Use case ends.

### A3: Zustellung scheitert

**Trigger:** Der Dienst antwortet mit einem Fehler, der sich wiederholen lässt (Zeitüberschreitung, 500)
**Flow:**

1. System löst die Sperre und hält den Grund an der Zeile fest (`push_error`).
2. Der nächste Lauf versucht es erneut – bis zum fünften Mal, danach ruht die Zeile (BR-267).
3. Use case ends.

### A4: Das Apple-Tor ist unbekannt

**Trigger:** Ein iOS-Gerät hat sich angemeldet, ohne dass feststeht, ob sein Token aus einem Entwicklungs- oder einem Store-Build stammt
**Flow:**

1. System versucht die Produktion. Antwortet Apple `BadDeviceToken`, versucht es die Sandbox.
2. System hält fest, welches Tor getragen hat (`push_tokens.environment`); ab dann gibt es nur noch einen Versuch.
3. Use case continues at step 7.

### A5: Stille Zeit

**Trigger:** Die Meldung entsteht im Fenster, das die Person stummgeschaltet hat (UC-028 A3)
**Flow:**

1. `notify()` hat beim Entstehen `push_after` gesetzt; der Abholer lässt die Zeile bis dahin liegen.
2. Use case continues at step 4, sobald das Fenster vorbei ist.

### A6: Ein Kanal ist nicht eingerichtet

**Trigger:** Für APNs fehlt der Schlüssel, für Web Push das VAPID-Paar
**Flow:**

1. System fragt gar nicht erst nach Meldungen dieses Kanals – sie verbrauchen keinen Versuch und warten (BR-267).
2. Fehlt **jeder** Kanal, antwortet die Function mit 503 und nennt die fehlende Variable.
3. Use case ends.

## Postconditions

- **Success:** Die Meldung trägt `push_sent_at`; auf mindestens einem Gerät der Person ist sie angekommen.
- **Failure:** Die Meldung trägt einen Grund in `push_error`; die Inbox enthält sie unverändert.

## Business Rules

- **BR-117** Die Inbox ist der vollständige Rückfall und nicht abschaltbar. Push ist ein zusätzlicher Weg, nie der einzige.
- **BR-118** Was je Kategorie abgewählt ist, geht nicht als Push hinaus.
- **BR-267** Fünf Versuche, dann Ruhe – und ein Kanal, der nicht eingerichtet ist, verbraucht keinen.
- **BR-268** Zugestellt heisst: auf mindestens einem Gerät angekommen. Wer kein Gerät hat, bekommt keinen Rückstand nachgeliefert.
- **BR-269** Ein Gerät, das der Dienst nicht mehr kennt, wird vergessen.
- **NFR-015** Schlüssel liegen in den Function-Secrets, nie im Repository und nie in der Datenbank im Klartext.

## Related

- **UC-028** Benachrichtigungen einstellen – die Einstellungen, die dieser Versand befolgt, und die Anmeldung des Geräts (A1/A2)
- **UC-044** Meldungen per E-Mail – derselbe Aufbau, anderer Kanal; beide hängen an derselben Zeile
- **FR-079** / **FR-199** – der Versand, der seit UC-015 in jedem Plan als offener Punkt stand
