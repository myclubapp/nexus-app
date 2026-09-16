# Manual Test Plan: UC-001 — Verein gründen

**Use Case:** [UC-001](../use_cases/UC-001-verein-gruenden.md)
**Geltungsbereich:** Gründungs-Wizard, Standardvorlagen, Startbildschirm
**Anforderungen:** FR-004, FR-005, FR-006, FR-011, FR-035, FR-112, FR-113
**Regeln:** BR-001 bis BR-004
**Erstellt:** 2026-09-08

## Vorbereitung

- Eine App-Instanz mit gültiger `.env.local` (sonst erscheint der Hinweis «noch nicht verbunden»).
- Ein E-Mail-Postfach, auf das die Testperson auf dem Testgerät zugreifen kann.
- Migrationen bis `0008_club_founding.sql` sind eingespielt. **Ohne sie schlägt
  jede Gründung fehl**, weil `create_club` die Signatur mit Saisonbeginn hat.
- Für TC-007 ein Konto, das bereits einem Verein angehört.

---

## TC-001: Verein in drei Schritten gründen

**Priority:** High
**Preconditions:** Angemeldet, noch keiner Mitgliedschaft zugehörig; die App zeigt das Onboarding.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Onboarding öffnen | Umschalter «Verein gründen / Ich habe eine Einladung», «Verein gründen» ist aktiv | | |
| 2 | Fortschrittsbalken und Zähler ansehen | «Schritt 1 von 3», Balken zu einem Drittel gefüllt | | |
| 3 | «Weiter» ohne Eingabe antippen | Knopf ist ausgegraut, es geschieht nichts | | |
| 4 | Ein Zeichen eingeben, z.B. «T» | «Weiter» bleibt ausgegraut (mindestens zwei Zeichen) | | |
| 5 | «TV Musterhausen» eingeben, «Weiter» | Schritt 2 «Was für ein Verein seid ihr?», «Schritt 2 von 3» | | |
| 6 | Die sechs Optionen ansehen | Sport, Musik, Kultur, Jugend, Quartier, Anderes – als Auswahlliste, Sport vorgewählt | | |
| 7 | «Musik» wählen, «Weiter» | Schritt 3 «Wann beginnt euer Vereinsjahr?» | | |
| 8 | Vorgeschlagenes Datum ablesen | **1. September des laufenden Jahres** (Musik) | | |
| 9 | «Verein erstellen» antippen | Knopf zeigt einen Spinner, danach erscheint das Dashboard | | |
| 10 | Dashboard ansehen | Begrüssung mit dem eigenen Namen; darunter die Karte «Erste Schritte für TV Musterhausen» | | |
| 11 | Die Karte zählen | **Genau drei** Einträge: Termin erfassen, Mitglieder einladen, Punkteregeln ansehen (BR-002) | | |
| 12 | Stoppuhr vom Öffnen bis hier | **Unter drei Minuten** (NFR-024, BR-004) | | |

---

## TC-002: Vorlagen der Vereinsart wirken

**Priority:** High
**Preconditions:** TC-001 abgeschlossen, Verein «TV Musterhausen» mit Vereinsart Musik.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Punkteregeln ansehen» antippen | Vereinseinstellungen öffnen sich | | |
| 2 | Abschnitt «Begriffe» ansehen | Für «Training» steht **«Probe»**, für «Spiel» **«Konzert»** (FR-112, C-009) | | |
| 3 | Abschnitt «Allgemein» ansehen | Saisonbeginn ist der 1. September, darunter das errechnete Saison-Label | | |
| 4 | Zurück, Tab «Agenda» öffnen | Der Termintyp-Filter zeigt die Musik-Begriffe, nicht «Training»/«Spiel» | | |
| 5 | Tab «Start», Abschnitt «Nächste Punkte» | Mindestens drei Regeln mit Punktwerten, alle aktiv (FR-035) | | |
| 6 | Einen Verein mit Vereinsart **Sport** gründen (zweites Konto) und Schritt 2 wiederholen | Dort steht «Training» und «Spiel», Saisonbeginn 1. Juli (BR-001) | | |

---

## TC-003: Eingaben überstehen einen Fehlschlag

**Priority:** High
**Preconditions:** Onboarding offen, Schritt 3 erreicht, Eingaben vollständig.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Flugmodus einschalten | — | | |
| 2 | «Verein erstellen» antippen | Fehlermeldung erscheint über dem Knopf, in der Sprache der App | | |
| 3 | Schritt 3 ansehen | Das Datum steht noch da | | |
| 4 | Mit «Zurück» zu Schritt 2 und 1 | Vereinsart und Name stehen unverändert (Failure Postcondition) | | |
| 5 | Flugmodus aus, «Verein erstellen» | Die Gründung geht durch, Dashboard erscheint | | |
| 6 | Tab «Profil» → Vereinsauswahl | Der Verein existiert **genau einmal** – der gescheiterte Versuch hat nichts angelegt | | |

---

## TC-004: Gründung abbrechen legt nichts an (A2)

**Priority:** Medium
**Preconditions:** Onboarding offen, Schritt 2 erreicht.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Abmelden» am Seitenende antippen | Anmeldebildschirm erscheint | | |
| 2 | Erneut anmelden | Das Onboarding erscheint wieder, **leer** – kein Verein wurde angelegt | | |
| 3 | Auf «Ich habe eine Einladung» und zurück wechseln | Der Wizard steht wieder bei Schritt 1 | | |

---

## TC-005: Eigene Bezeichnung bei «Anderes»

**Priority:** Medium
**Preconditions:** Onboarding offen, Schritt 2 erreicht.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | «Anderes» wählen | Ein zusätzliches Feld «Eure Bezeichnung» erscheint | | |
| 2 | «Weiter» ohne Eingabe | Knopf bleibt ausgegraut | | |
| 3 | «Genossenschaft» eingeben | «Weiter» wird aktiv | | |
| 4 | Weiter zu Schritt 3 | Vorgeschlagener Saisonbeginn ist der **1. Januar** | | |
| 5 | Gründen und Vereinseinstellungen öffnen | Neutrale Begriffe («Treffen», «Anlass»), nicht das Sportvokabular | | |

---

## TC-006: Kurzname bleibt eindeutig (A1)

**Priority:** Medium
**Preconditions:** Ein Verein «TV Musterhausen» existiert bereits (aus TC-001).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Mit einem zweiten Konto einen Verein mit **demselben Namen** gründen | Die Gründung geht ohne Fehlermeldung durch | | |
| 2 | In der Datenbank `select slug from clubs order by created_at` | Zwei verschiedene Kurznamen, der zweite mit angehängter Unterscheidung | | |
| 3 | Beide Vereine öffnen | Beide tragen denselben Anzeigenamen, sind aber getrennte Vereine | | |

---

## TC-007: Weiteren Verein gründen (A3)

**Priority:** Medium
**Preconditions:** Angemeldet und bereits Mitglied mindestens eines Vereins.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Profil» öffnen | Eintrag «Weiteren Verein gründen» ist sichtbar | | |
| 2 | Eintrag antippen | Der Gründungs-Wizard öffnet sich – **nicht** eine Weiterleitung aufs Dashboard | | |
| 3 | Verein «Musikverein Test» anlegen | Nach dem Erstellen erscheint das Dashboard | | |
| 4 | Begrüssung und Vereinsname prüfen | Der **neue** Verein ist aktiv, nicht der alte | | |
| 5 | Tab «Profil» → Vereinsauswahl | Beide Vereine stehen zur Wahl, der neue ist gewählt (FR-011) | | |
| 6 | Auf den alten Verein wechseln | Agenda, Punkte und Ranglisten zeigen dessen Daten | | |

---

## TC-008: Vier Sprachen

**Priority:** High
**Preconditions:** Ein Konto ohne Mitgliedschaft.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Auf dem Anmeldebildschirm Französisch wählen, anmelden | Der Wizard erscheint auf Französisch | | |
| 2 | Alle drei Schritte durchgehen | Kein deutscher oder englischer Text, nichts abgeschnitten (C-007) | | |
| 3 | Dasselbe auf Italienisch | Wie oben | | |
| 4 | Dasselbe auf Englisch | Wie oben | | |
| 5 | Auf jeder Sprache «Schritt 1 von 3» prüfen | Die Zahlen stehen im Satz, nicht als Platzhalter `{{current}}` | | |
| 6 | Nach der Gründung die Karte «Erste Schritte» ansehen | Der Vereinsname steht im Satz, nicht als `{{club}}` | | |

---

## TC-009: Darstellung auf dem Gerät

**Priority:** Medium
**Preconditions:** Ein Konto ohne Mitgliedschaft, auf jedem Gerät der Matrix.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Wizard auf dem kleinsten Gerät öffnen | Frage, Eingabe und Knopf ohne Scrollen sichtbar | | |
| 2 | Das Datumsfeld antippen | Die Systemauswahl für Datum öffnet sich (iOS-Rad, Android-Dialog) | | |
| 3 | Tastatur einblenden | Der «Weiter»-Knopf wird nicht verdeckt | | |
| 4 | Gerät auf Dunkelmodus stellen | Alle Texte lesbar, kein schwarz auf schwarz | | |
| 5 | Nach der Gründung im Dashboard scrollen | Der grosse Titel klappt in die Kopfzeile zusammen (iOS-Muster) | | |
| 6 | Auf «Erste Schritte» die drei Zeilen antippen | Alle drei führen auf eine Seite, keine läuft ins Leere | | |

---

## TC-010: Zero-Config-Start (BR-002)

**Priority:** High
**Preconditions:** Ein soeben gegründeter Verein, **ohne** dass irgendetwas eingestellt wurde.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Alle fünf Tabs nacheinander öffnen | Keiner zeigt einen Fehler; leere Tabs erklären ihren Zweck | | |
| 2 | Tab «Wirkung» → «Wie steht der Verein?» | Zeigt «Noch keine Punkte in dieser Saison», nicht eine leere Fläche | | |
| 3 | Über «Erste Schritte» eine Einladung erstellen | Geht ohne vorherige Einstellung (UC-003) | | |
| 4 | Vereinseinstellungen öffnen und wieder schliessen, **ohne** zu speichern | Der Verein funktioniert unverändert weiter | | |

---

## Test Matrix

| Device / Browser | OS / Version | Screen Size | Status |
| ---------------- | ------------ | ----------- | ------ |
| Chrome (latest) | macOS / Windows | Desktop | |
| Safari (latest) | macOS | Desktop | |
| Firefox (latest) | macOS / Windows | Desktop | |
| Safari | iOS 17+ | iPhone SE (klein) | |
| Safari | iOS 17+ | iPhone 15 | |
| Chrome | Android 14+ | Pixel 7 | |
| Safari | iPadOS 17+ | iPad Gen 11 | |

Desktop-Browser bleiben in der Matrix, obwohl die App für das Telefon gebaut
ist: Doppelt zählende Klicks und Unterschiede zwischen Maus und Finger zeigen
sich fast nur dort.

---

## Summary

| Test Case | Titel | Priority | Result |
| --------- | ----- | -------- | ------ |
| TC-001 | Verein in drei Schritten gründen | High | |
| TC-002 | Vorlagen der Vereinsart wirken | High | |
| TC-003 | Eingaben überstehen einen Fehlschlag | High | |
| TC-004 | Gründung abbrechen legt nichts an | Medium | |
| TC-005 | Eigene Bezeichnung bei «Anderes» | Medium | |
| TC-006 | Kurzname bleibt eindeutig | Medium | |
| TC-007 | Weiteren Verein gründen | Medium | |
| TC-008 | Vier Sprachen | High | |
| TC-009 | Darstellung auf dem Gerät | Medium | |
| TC-010 | Zero-Config-Start | High | |

**Overall Result:** ☐ Pass ☐ Fail
**Tester:** ******\_\_\_******
**Datum:** ******\_\_\_******

---

## Issues Found

| # | Test Case | Beschreibung | Schweregrad | Status |
| - | --------- | ------------ | ----------- | ------ |
| | | | | |
