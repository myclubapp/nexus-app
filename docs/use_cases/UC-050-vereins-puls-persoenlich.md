# Use Case: Vereins-Puls persönlich gestalten

## Overview

**Use Case ID:** UC-050
**Use Case Name:** Vereins-Puls persönlich gestalten
**Primary Actor:** Vorstand
**Secondary Actor:** Mitglied, System
**Goal:** Der Puls erreicht die Mitglieder als ganzes Blatt – mit den Beiträgen des Vereins, einem Gruss, der einen Absender hat, und einer Vorschau, die vor dem Versand zeigt, was ankommt
**Status:** Draft

## Preconditions

- Das Modul Vereins-Puls ist aktiviert, und ein Entwurf liegt vor (UC-027, Schritte 1 bis 3).
- Für die Grussformel besteht mindestens ein Vorstandsamt (FR-179, `functionary_roles.is_board`).
- Für die Mail ist der Versanddienst eingerichtet (BR-212).

## Main Success Scenario

1. Vorstand hinterlegt einmalig die Grussformel: das Amt, das grüsst (z.B. Präsidium), den Grusstext je Sprache und, wenn gewünscht, ein Porträt.
2. System komponiert den Entwurf aus **vier** Quellen: den Terminen der kommenden vierzehn Tage, den vereinsweiten Beiträgen der letzten vierzehn Tage aus App und Website, den publizierten Vorstandsantworten, den offenen Aufgaben und Schichten.
3. Vorstand öffnet den Entwurf, streicht oder ergänzt Einträge und schreibt den Einleitungssatz (UC-027, Schritt 5).
4. Vorstand wählt «Vorschau».
5. System zeigt zwei Ansichten desselben Pulses: das Blatt, wie es in der App erscheint, und die Mail, wie sie im Postfach ankommt – beide mit Einleitungssatz, den drei Abschnitten, dem Punktestand als Platzhalter und der Grussformel mit Amt, Name und Porträt. Es wird nichts versendet, nichts gezählt und nichts als gesendet vermerkt.
6. Vorstand gibt frei (UC-027, Schritte 6 bis 8).
7. System stellt den Puls zu: in die Inbox, wo erlaubt als Push – und als **eigenes Mailblatt** mit denselben drei Abschnitten in derselben Reihenfolge, statt als eine Meldungszeile mit Link.
8. Am Fuss des Blatts steht der Gruss: der Text, darunter Name und Amt, daneben das Porträt, wenn eines hinterlegt ist.

## Alternative Flows

### A1: Keine Grussformel hinterlegt

**Trigger:** Der Verein hat nichts hinterlegt (Schritt 8)
**Flow:**

1. Das Blatt endet nach den Abschnitten. Es steht kein Platzhalter und keine erfundene Unterschrift dort.
2. Use case ends.

### A2: Das grüssende Amt ist vakant

**Trigger:** Das hinterlegte Amt hat keine Inhaberin und keinen Inhaber (Schritt 8)
**Flow:**

1. Der Grusstext bleibt; an der Stelle des Namens steht «Der Vorstand», und das Porträt fällt weg.
2. Eine Unterschrift mit dem Namen der Person, die zurückgetreten ist, entsteht nicht.

### A3: Das Amt hat mehrere Inhaber:innen

**Trigger:** Das Amt ist mehrfach besetzt, etwa ein Co-Präsidium (Schritt 8)
**Flow:**

1. Alle Namen stehen in der Reihenfolge der Belegung.
2. Das Porträt hängt an der Grussformel und nicht an einer Person (BR-253) – ein Co-Präsidium hinterlegt ein gemeinsames Bild oder keines.

### A4: Keine Beiträge in den letzten vierzehn Tagen

**Trigger:** Der Verein hat nichts publiziert (Schritt 2)
**Flow:**

1. Der erste Abschnitt trägt nur die Termine. Die Regel für den leeren Entwurf bleibt UC-027 A3.

### A5: Ein Beitrag wurde schon als Meldung zugestellt

**Trigger:** Eine News ist beim Publizieren als Benachrichtigung hinausgegangen und fällt nun in den Puls (Schritt 2)
**Flow:**

1. Sie steht trotzdem im Puls (BR-251). Der Puls ist der Wochenrückblick des Vereins, und ein Rückblick, der auslässt, was schon einmal gemeldet wurde, ist keiner.

### A6: Beitrag eines Teams

**Trigger:** Eine News gehört einem Team (Schritt 2)
**Flow:**

1. Sie kommt nicht in den Puls (BR-250). Der Puls geht an alle Mitglieder und kennt keinen Geltungsbereich; eine Team-News darin wäre ein Leck.

### A7: Beitrag von der Website

**Trigger:** Der Beitrag stammt aus dem Website-Import (UC-038, Schritt 2)
**Flow:**

1. Er steht mit seinem Titel im Puls, und der Verweis führt auf die Website.
2. Der Verweis ist als externer erkennbar – `linkTarget()` kennt nur Ziele in der App, und ein Absprung ohne Vorwarnung wirkt wie ein Fehler.

### A8: Mitglied ohne E-Mail-Kanal

**Trigger:** Das Mitglied hat «Keine E-Mail» gewählt (Schritt 7)
**Flow:**

1. Es geht kein Blatt hinaus; der Puls steht vollständig in der Inbox (BR-117).

### A9: Vorschau ohne Entwurf

**Trigger:** Vorstand wählt «Vorschau», und es liegt kein Entwurf vor (Schritt 4)
**Flow:**

1. Es gibt nichts zu zeigen. Die Seite bleibt bei der Erklärung und beim Angebot, einen Entwurf zusammenzustellen (UC-027 A5).

## Postconditions

### Success Postconditions

- Die Mitglieder haben den Puls mit allen drei Abschnitten – in der Inbox und, wo der Kanal offen ist, im Postfach.
- Der Puls trägt einen Gruss mit Amt und Name, solange das Amt besetzt ist.
- Der Vorstand hat vor dem Versand gesehen, was ankommt.
- Der Zeitpunkt des letzten Pulses ist aktualisiert und der Versand als Verbindung gezählt (BR-116).

### Failure Postconditions

- Eine Vorschau hinterlässt keinen Versand, keine Zählung und keinen Vermerk.
- Scheitert der Mailversand, bleibt der Puls in der Inbox vollständig (UC-044 A2).

## Business Rules

### BR-248: Die drei Fragen gelten auch im Postfach

Das Mailblatt trägt dieselben drei Abschnitte in derselben Reihenfolge wie die App (BR-113) und den Punktestand nachgeordnet (BR-114). Eine Mail, die nur den Einleitungssatz und einen Link trägt, erfüllt UC-027 nicht – sie verlegt die Nachricht in eine App, die das Mitglied vielleicht gerade nicht öffnet.

### BR-249: Die Vorschau sendet nicht

Die Vorschau erzeugt das Blatt und gibt es zurück. Sie versendet nichts, setzt `sent_at` nicht, zählt keine Verbindung und verbraucht den Entwurf nicht. Der Weg dafür ist derselbe Renderer wie im Versand – eine zweite Abschrift des Blatts in der App liefe auseinander, wie es die doppelt gepflegten Warum-Sätze zeigen.

### BR-250: Nur vereinsweite Beiträge

In den Puls kommen ausschliesslich Beiträge mit `team_id is null`. Dieselbe Grenze zieht `0057` schon für die Vorstandsantworten, und sie gilt aus demselben Grund: Der Puls erreicht jedes Mitglied.

### BR-251: Der Puls wiederholt bewusst

Ein Beitrag, der schon als Meldung zugestellt wurde, steht im Puls erneut. Das ist Absicht und keine Doppelzustellung: Der Puls ist die Wochenübersicht, nicht die Erstmeldung. Für die Verbindungs-Quote (K1) zählt er weiterhin einmal – `log_club_message()` läuft beim Puls und beim Publizieren getrennt.

### BR-252: Die Grussformel hängt am Amt

Sie gehört dem Amt, nicht der Person. Wechselt die Besetzung, wechselt die Unterschrift mit, ohne dass jemand eine Einstellung nachzieht. Die Person, die freigibt (`club_pulses.released_by`), ist ausdrücklich **nicht** die Quelle: Eine Unterschrift, die danach wechselt, wer am Montag Zeit hatte, ist keine.

### BR-253: Kein Bild aus dem privaten Speicher in eine Mail

Das Porträt der Grussformel ist ein Repräsentationsbild des Vereins wie das Logo: eigenes Feld, öffentlicher Speicher, ausdrücklich hochgeladen. Es ist nie `club_members.avatar_url` – Profilbilder liegen nach BR-216 im privaten Speicher, nur unter einer ablaufenden Adresse und nur für den Verein sichtbar. Ein Postfach ist kein Verein: Die Adresse läuft ab, und die Bildproxys der Anbieter holen und behalten, was sie einmal gesehen haben.

### BR-254: Der Gruss steht auch ohne Bild

Name und Amt sind Text, nicht Bildinhalt. Die meisten Postfächer laden Bilder erst auf Klick; ein Gruss, der nur als Bild existiert, kommt bei der Mehrheit nicht an. Und es ist ein Porträt mit gesetztem Namen – **keine eingescannte Unterschrift**: Die wäre ein Abbild, das sich aus jeder Massenmail weiterverwenden lässt, und trägt nichts bei, was der gesetzte Name nicht trägt.

## Vorgesehene Umsetzung

| Anforderung | Wo |
| --- | --- |
| FR-188 | `notify(..., p_template => 'pulse')` in `release_pulse()` – der Mechanismus aus `0096` gibt der Zeile ihre eigene Mail (Ausnahme zu BR-213, UC-044); zweiter Zweig in `send-mail/template.ts` neben `welcome`, Bausteine aus `_shared/mail.ts` |
| FR-189 | Betriebsart `preview` in `send-mail` (gibt HTML zurück, versendet nicht), Blatt in `PulsePage`; `mode: 'test'` bleibt die Probemail an die eigene Adresse |
| FR-190 | `compose_club_pulse()`: vierte Quelle `news` mit `source in ('club','website')`, `team_id is null`, `not is_sample`, vierzehn Tage, Limit 4; neue Art `news` in `PulseItem` (`app/src/lib/pulse.ts`) |
| FR-191 | Grussformel an `functionary_roles` (Amt) plus Vereinseinstellung, welches Amt grüsst; `pending_mail()` aus `0096` erweitern – nicht die Fassung aus `0084` |
| FR-192 | Eigenes Feld für das Porträt im öffentlichen Speicher (`club-logo`-Muster aus `0083`), `safeUrl()` im Blatt |
| BR-249 | `send-mail` (Betriebsart), `PulsePage` |
| BR-250 | `compose_club_pulse()` |
| BR-252 | `functionary_roles`, `release_pulse()` |
| BR-253 | Upload-Weg und Bucket-Wahl in der Migration |

## Was dieser Use Case nebenbei behebt

Der Puls geht heute als gewöhnliche Meldungszeile hinaus: `release_pulse()` ruft
`notify()` mit dem Titel «Der Vereins-Puls» und dem Einleitungssatz als Rumpf.
Per E-Mail kommen die drei Abschnitte also nie an, nur ein Teaser mit Link –
und niemand hat es gesehen, weil es keine Vorschau gab. FR-188 und FR-189
gehören deshalb zusammen: Die Vorschau ist nicht nur eine Bequemlichkeit für
den Vorstand, sie ist die Stelle, an der so etwas auffällt.
