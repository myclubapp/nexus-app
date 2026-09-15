# Use Case: Vereins-Puls persönlich gestalten

## Overview

**Use Case ID:** UC-050
**Use Case Name:** Vereins-Puls persönlich gestalten
**Primary Actor:** Vorstand
**Secondary Actor:** Mitglied, System
**Goal:** Der Puls erreicht die Mitglieder als ganzes Blatt – mit den Beiträgen des Vereins, einem Gruss, der einen Absender hat, und einer Vorschau, die vor dem Versand zeigt, was ankommt
**Status:** In Progress – gebaut und gegen die laufende Datenbank geprüft (21 Verhaltensprüfungen in einer zurückgerollten Transaktion). Die Migration `0100` ist **nicht** eingespielt und `pulse-preview` nicht deployt; bis dahin wirkt nichts davon (Stand 15.09.2026)

## Preconditions

- Das Modul Vereins-Puls ist aktiviert, und ein Entwurf liegt vor (UC-027, Schritte 1 bis 3).
- Für die Grussformel besteht mindestens ein Vorstandsamt (FR-179, `functionary_roles.is_board`).
- Für die Mail ist der Versanddienst eingerichtet (BR-212).

## Main Success Scenario

1. Vorstand hinterlegt einmalig die Grussformel: das Amt, das grüsst (z.B. Präsidium), den Grusstext je Sprache und, wenn gewünscht, ein Porträt.
2. System komponiert den Entwurf aus **vier** Quellen: den Terminen der kommenden vierzehn Tage, den vereinsweiten Beiträgen der letzten vierzehn Tage aus App und Website, den publizierten Vorstandsantworten, den offenen Aufgaben und Schichten.
3. Vorstand öffnet den Entwurf, streicht oder ergänzt Einträge und schreibt den Einleitungssatz (UC-027, Schritt 5).
4. Vorstand wählt «Vorschau».
5. System zeigt zwei Ansichten desselben Pulses: das Blatt, wie es in der App erscheint, und die Mail, wie sie im Postfach ankommt – beide mit Einleitungssatz, den drei Abschnitten, der Grussformel mit Amt, Name und Porträt. Der persönliche Punktestand steht in keiner der beiden: Er gehört einem Mitglied allein, und die Vorschau zeigt, was **alle** bekommen. Es wird nichts versendet, nichts gezählt und nichts als gesendet vermerkt.
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

Das Mailblatt trägt dieselben drei Abschnitte in derselben Reihenfolge wie die App (BR-113). Eine Mail, die nur den Einleitungssatz und einen Link trägt, erfüllt UC-027 nicht – sie verlegt die Nachricht in eine App, die das Mitglied vielleicht gerade nicht öffnet.

**Der persönliche Punktestand bleibt in der App.** BR-114 verlangt, dass er nachgeordnet steht, nicht dass er überall steht: Er gehört einem Mitglied allein, und das Blatt entsteht in einem Versandlauf, der von Punkten nichts weiss. Wer ihn sehen will, öffnet die App über den Knopf im Blatt – dort steht er, wo BR-114 ihn hinstellt.

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

## Umsetzung

| Anforderung | Wo umgesetzt |
| --- | --- |
| FR-188 | `0100` (`release_pulse()` mit `p_template => 'pulse'`, `pending_mail()` mit `payload`), `supabase/functions/_shared/pulse_sheet.ts`, zweiter Zweig in `send-mail/template.ts` neben `welcome` |
| FR-189 | `supabase/functions/pulse-preview/` (eigene Function, `verify_jwt`), `0100` (`pulse_payload()`), `app/src/components/PulsePreviewModal.tsx`, `usePulsePreview()` |
| FR-190 | `0100` (`compose_club_pulse()`: `news` mit `source in ('club','website')`, `team_id is null`, `not is_sample`, 14 Tage, Limit 4), Art `news` in `app/src/lib/pulse.ts` |
| FR-191 | `0100` (`functionary_roles.greeting`, `set_office_greeting()`), `clubs.settings.pulse.greetingRoleId`, `app/src/components/PulseGreetingModal.tsx` |
| FR-192 | `0100` (`greeting_image_url`, Pfadart `greeting` in den `club-logo`-Policies, `can_write_club_media()`), `ImagePicker` mit `kind="greeting"` |
| BR-248 | `_shared/pulse_sheet.ts` (`renderPulseSheet`), `app/src/components/PulseSections.tsx` |
| BR-249 | `pulse-preview` (liest, schreibt nicht), `pulse_payload(… p_keep)` |
| BR-250 | `0100` (`compose_club_pulse()`) |
| BR-251 | `0100` – ausdrücklich **keine** Entdopplung gegen schon zugestellte Meldungen |
| BR-252 | `0100` (`pulse_payload()` liest Amt und Belegung), `clubs.settings.pulse.greetingRoleId` |
| BR-253 | `0100` (Bucket-Wahl, `https:`-Prüfung in `set_office_greeting()`), `app/src/hooks/useMedia.ts` (`isPublicKind`) |
| BR-254 | `_shared/pulse_sheet.ts` (`pulseSignature`), `app/src/lib/pulse.ts` (`signatureOf`) |

**Der Gruss geht über `set_office_greeting()` und nicht über `save_office()`** –
aus demselben Grund, aus dem `0091` den Punktwert herausgenommen hat (BR-206):
Ein Formular, das die Felder nicht kennt, würde sie löschen. Bei `save_office()`
käme es schlimmer: Dort heisst `p_holders` mit Vorgabe `'[]'` «keine Sitze», und
ein Aufruf, der nur den Gruss setzen wollte, hätte die ganze Belegung des Amtes
gelöscht.


## Was dieser Use Case nebenbei behebt

Der Puls geht heute als gewöhnliche Meldungszeile hinaus: `release_pulse()` ruft
`notify()` mit dem Titel «Der Vereins-Puls» und dem Einleitungssatz als Rumpf.
Per E-Mail kommen die drei Abschnitte also nie an, nur ein Teaser mit Link –
und niemand hat es gesehen, weil es keine Vorschau gab. FR-188 und FR-189
gehören deshalb zusammen: Die Vorschau ist nicht nur eine Bequemlichkeit für
den Vorstand, sie ist die Stelle, an der so etwas auffällt.
