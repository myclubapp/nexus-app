# Use Cases: myclub nexus

Use-Case-Spezifikationen der Engagement-Plattform. Jede Datei beschreibt genau einen vollständigen
Ablauf zwischen einem Akteur und dem System.

**Grundlage:** [`../vision.md`](../vision.md) → [`../requirements.md`](../requirements.md) → diese Spezifikationen.

**Status-Werte:** Draft · Review · Approved · Implemented · Verified · Revision Required · Obsolete.
Sie entsprechen den Status im Anforderungskatalog, damit beide Dokumente in derselben Änderung
synchron gehalten werden können.

---

## Übersicht mit Traceability

### Auth & Onboarding

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-001](UC-001-verein-gruenden.md) | Verein gründen | Vorstand | FR-004, FR-005, FR-006, FR-035, FR-113, FR-134 | Draft |
| [UC-002](UC-002-per-einladung-beitreten.md) | Per Einladung beitreten | Gast | FR-008, FR-011 | Draft |
| [UC-003](UC-003-einladung-erstellen.md) | Einladung erstellen | Vorstand | FR-007 | Draft |
| [UC-004](UC-004-beitritts-anfrage-entscheiden.md) | Beitritts-Anfrage entscheiden | Vorstand | FR-009, FR-010 | Draft |
| [UC-005](UC-005-anmelden.md) | Anmelden | Mitglied | FR-001, FR-002, FR-003 | Draft |
| [UC-006](UC-006-konto-loeschen.md) | Konto löschen | Mitglied | FR-012 | Draft |

### Mitglieder & Teams

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-007](UC-007-mitglieder-und-teams-verwalten.md) | Mitglieder, Rollen und Teams verwalten | Vorstand | FR-013, FR-014, FR-015, FR-016, FR-017 | Draft |
| [UC-008](UC-008-profil-und-datenschutz-pflegen.md) | Profil und Datenschutz-Optionen pflegen | Mitglied | FR-018, FR-019, FR-020, FR-110 | Draft |

### Agenda

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-009](UC-009-termin-erstellen.md) | Termin erstellen | Trainer:in | FR-021, FR-022, FR-023, FR-029, FR-051 | Draft |
| [UC-010](UC-010-zu-oder-absagen.md) | Auf einen Termin zu- oder absagen | Mitglied | FR-024, FR-025, FR-026 | Draft |
| [UC-011](UC-011-helfer-event-ausschreiben.md) | Helfer-Event mit Schichten ausschreiben | Vorstand | FR-030, FR-051, FR-084 | Implemented |
| [UC-012](UC-012-schicht-uebernehmen.md) | Helfer-Schicht übernehmen | Mitglied | FR-031 | Implemented |
| [UC-013](UC-013-schicht-bestaetigen.md) | Helfer-Schicht bestätigen | Vorstand | FR-032, FR-039 | Implemented |
| [UC-014](UC-014-qr-check-in.md) | QR-Check-in am Termin | Mitglied | FR-033, FR-034, FR-039 | Implemented |
| [UC-015](UC-015-unentschlossene-erinnern.md) | Unentschlossene erinnern | Trainer:in | FR-027, FR-028, FR-078 | Implemented |

### Gamification

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-016](UC-016-punkteregeln-konfigurieren.md) | Punkteregeln konfigurieren | Vorstand | FR-036, FR-037, FR-038, FR-040 | Draft |
| [UC-017](UC-017-aufgabe-ausschreiben.md) | Aufgabe im Marktplatz ausschreiben | Vorstand | FR-050, FR-051, FR-056, FR-059 | Implemented |
| [UC-018](UC-018-aufgabe-uebernehmen.md) | Aufgabe übernehmen und einreichen | Mitglied | FR-052, FR-053, FR-057 | Implemented |
| [UC-019](UC-019-aufgabe-bestaetigen.md) | Aufgabe bestätigen und Kudos geben | Vorstand | FR-054, FR-055 | Implemented |
| [UC-020](UC-020-punktestand-einsehen.md) | Punktestand und «Nächste Punkte» einsehen | Mitglied | FR-041, FR-044, FR-045 | Implemented |
| [UC-021](UC-021-punkte-manuell-buchen.md) | Punkte manuell buchen oder korrigieren | Vorstand | FR-042, FR-043 | Implemented |
| [UC-022](UC-022-leaderboard-einsehen.md) | Leaderboard einsehen | Mitglied | FR-046, FR-047, FR-048, FR-049 | Implemented |

### Vereins-Gesundheit

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-023](UC-023-fuersorge-hinweis-triagieren.md) | Fürsorge-Hinweis triagieren | Trainer:in | FR-062, FR-063, FR-064, FR-065, FR-066, FR-067 | In Progress |
| [UC-024](UC-024-wertdimensionen-einsehen.md) | Eigene Wertdimensionen einsehen | Mitglied | FR-071, FR-072 | Implemented |
| [UC-025](UC-025-transparenz-seite.md) | Transparenz-Seite und Health-Opt-out | Mitglied | FR-073, FR-074, FR-075 | Implemented |

### News, Puls & Benachrichtigungen

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-026](UC-026-news-publizieren.md) | Vereins-News publizieren | Vorstand | FR-076, FR-077, FR-078, FR-070 | Draft |
| [UC-027](UC-027-vereins-puls-freigeben.md) | Vereins-Puls freigeben | Vorstand | FR-082, FR-083, FR-084 | Draft |
| [UC-028](UC-028-benachrichtigungen-einstellen.md) | Benachrichtigungen einstellen | Mitglied | FR-079, FR-080, FR-081 | In Progress |
| [UC-038](UC-038-website-news-uebernehmen.md) | News von der Vereins-Website übernehmen | Vorstand | FR-146, FR-147 | In Progress |

### «Stimme» & Dialog

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-029](UC-029-sprachmemo-aufnehmen.md) | Sprachmemo aufnehmen und adressieren | Mitglied | FR-085, FR-086, FR-087, FR-088, FR-089, FR-090 | Draft |
| [UC-030](UC-030-anliegen-beantworten.md) | Anliegen beantworten | Vorstand | FR-091, FR-092, FR-093, FR-094, FR-099, FR-100 | Draft |
| [UC-031](UC-031-sitzungs-input-einreichen.md) | Sitzungs-Input einreichen und zuordnen | Mitglied | FR-095, FR-096, FR-097, FR-098, FR-101 | Draft |
| [UC-032](UC-032-kontext-check-in.md) | Kontext-Check-in beantworten | Mitglied | FR-102 bis FR-109 | Draft |

### Sinn, Konfiguration & Anschlüsse

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-033](UC-033-beitrags-profil-erfassen.md) | Beitrags-Profil erfassen | Mitglied | FR-058, FR-059 | Draft |
| [UC-034](UC-034-vereinsidentitaet-konfigurieren.md) | Vereinsidentität, Begriffe und Module konfigurieren | Vorstand | FR-111, FR-112, FR-113, FR-114, FR-115 | Draft |
| [UC-035](UC-035-verband-verbinden.md) | Verband verbinden | Vorstand | FR-120, FR-121 | Draft |
| [UC-036](UC-036-rechnungen-einsehen.md) | Rechnungen einsehen und Punkte bei pünktlicher Zahlung | Mitglied | FR-116, FR-117, FR-118, FR-119 | Draft |
| [UC-037](UC-037-beispielinhalte-verwalten.md) | Beispielinhalte verwalten | Vorstand | FR-134 bis FR-145 | Draft |

---

## Zuordnung zu den MVP-Inkrementen

| Inkrement | Use Cases |
|---|---|
| **M1 – Fundament** | UC-001 bis UC-008, UC-034, UC-037 |
| **M2 – Agenda-Loop** | UC-009 bis UC-016, UC-020 |
| **M3 – Gemeinschaft** | UC-017 bis UC-019, UC-021 bis UC-033 |
| **M4 – Anschlüsse** | UC-035, UC-036 |

---

## Noch nicht spezifiziert

Diese Anforderungen sind bewusst nach dem MVP eingeplant und tragen im Katalog den Status
`Deferred`. Für sie existiert noch keine Spezifikation:

| Thema | Requirements |
|---|---|
| Badges, Level, Challenges, Rewards | FR-122 bis FR-125 |
| Funktionärsämter mit Factsheet und Vakanz-Anzeige | FR-126, FR-127 |
| Meisterschaft | FR-128 |
| Eltern und Kinder | FR-129 |
| Exporte und Bulk-Import | FR-130 bis FR-132 |
| Kalender-Publishing | FR-133 |

Ebenfalls ohne eigene Spezifikation, weil vollständig systemseitig: FR-060, FR-061, FR-068, FR-069
(Kennzahlen der Vereins-Gesundheit) – sie sind Anzeigeflächen der in UC-023 beschriebenen Signale.

---

## Geschäftsregeln

Die Regeln BR-001 bis BR-166 sind fortlaufend und über alle Use Cases hinweg eindeutig vergeben.
Die vier nicht verhandelbaren Regeln des Projekts sind über mehrere Use Cases verteilt:

| Prinzip | Regeln |
|---|---|
| **Punkte schreibt nur der Server** | BR-050, BR-051, BR-052, BR-065, BR-085, BR-087, BR-161 |
| **Rollenprüfung serverseitig** | BR-009, BR-027, BR-033, BR-053, BR-056, BR-096 |
| **Anti-Überwachung by Design** | BR-094 bis BR-099, BR-102, BR-105 bis BR-108, BR-122 bis BR-126, BR-136 bis BR-141 |
| **Verbindung vor Aufruf** | BR-043, BR-044, BR-069, BR-111, BR-113 bis BR-116 |
