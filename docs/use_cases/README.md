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
| [UC-001](UC-001-verein-gruenden.md) | Verein gründen | Vorstand | FR-004, FR-005, FR-006, FR-035, FR-113, FR-134, FR-195 | Implemented |
| [UC-002](UC-002-per-einladung-beitreten.md) | Per Einladung beitreten | Gast | FR-008, FR-011 | Implemented |
| [UC-003](UC-003-einladung-erstellen.md) | Einladung erstellen | Vorstand | FR-007 | Implemented |
| [UC-004](UC-004-beitritts-anfrage-entscheiden.md) | Beitritts-Anfrage entscheiden | Vorstand | FR-009, FR-010, FR-196 | Implemented |
| [UC-005](UC-005-anmelden.md) | Anmelden | Mitglied | FR-001, FR-002, FR-003 | Implemented |
| [UC-006](UC-006-konto-loeschen.md) | Konto löschen | Mitglied | FR-012 | Implemented |
| [UC-051](UC-051-verein-einrichten.md) | Verein einrichten | Vorstand | FR-195, FR-196, FR-197 | Implemented |
| [UC-053](UC-053-profil-einrichten.md) | Profil einrichten | Mitglied | FR-200 | Partial (nicht eingespielt) |

### Mitglieder & Teams

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-007](UC-007-mitglieder-und-teams-verwalten.md) | Mitglieder, Rollen und Teams verwalten | Vorstand | FR-013, FR-014, FR-015, FR-016, FR-017 | Implemented |
| [UC-008](UC-008-profil-und-datenschutz-pflegen.md) | Profil und Datenschutz-Optionen pflegen | Mitglied | FR-018, FR-019, FR-020, FR-110 | Implemented |

### Agenda

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-009](UC-009-termin-erstellen.md) | Termin erstellen | Trainer:in | FR-021, FR-022, FR-023, FR-029, FR-051 | Implemented |
| [UC-010](UC-010-zu-oder-absagen.md) | Auf einen Termin zu- oder absagen | Mitglied | FR-024, FR-025, FR-026, FR-156 | Implemented |
| [UC-011](UC-011-helfer-event-ausschreiben.md) | Helfer-Event mit Schichten ausschreiben | Vorstand | FR-030, FR-051, FR-084 | Implemented |
| [UC-012](UC-012-schicht-uebernehmen.md) | Helfer-Schicht übernehmen | Mitglied | FR-031, FR-156 | Implemented |
| [UC-013](UC-013-schicht-bestaetigen.md) | Helfer-Schicht bestätigen | Vorstand | FR-032, FR-039 | Implemented |
| [UC-014](UC-014-qr-check-in.md) | QR-Check-in am Termin | Mitglied | FR-033, FR-034, FR-039 | Implemented |
| [UC-015](UC-015-unentschlossene-erinnern.md) | Unentschlossene erinnern | Trainer:in | FR-027, FR-028, FR-078 | Implemented |

### Gamification

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-016](UC-016-punkteregeln-konfigurieren.md) | Punkteregeln konfigurieren | Vorstand | FR-036, FR-037, FR-038, FR-040 | Implemented |
| [UC-017](UC-017-aufgabe-ausschreiben.md) | Aufgabe im Marktplatz ausschreiben | Vorstand | FR-050, FR-051, FR-056, FR-059 | Implemented |
| [UC-018](UC-018-aufgabe-uebernehmen.md) | Aufgabe übernehmen und einreichen | Mitglied | FR-052, FR-053, FR-057 | Implemented |
| [UC-019](UC-019-aufgabe-bestaetigen.md) | Aufgabe bestätigen und Kudos geben | Vorstand | FR-054, FR-055 | Implemented |
| [UC-020](UC-020-punktestand-einsehen.md) | Punktestand und «Nächste Punkte» einsehen | Mitglied | FR-041, FR-044, FR-045 | Implemented |
| [UC-021](UC-021-punkte-manuell-buchen.md) | Punkte manuell buchen oder korrigieren | Vorstand | FR-042, FR-043 | Implemented |
| [UC-022](UC-022-leaderboard-einsehen.md) | Leaderboard einsehen | Mitglied | FR-046, FR-047, FR-048, FR-049, FR-177 | Implemented |
| [UC-041](UC-041-funktionaersamt-mit-factsheet.md) | Funktionärsamt mit Factsheet hinterlegen und im Marktplatz anbieten | Vorstand | FR-126, FR-127, FR-193, FR-194 | Implemented (A9 wartet auf `0103`) |
| [UC-042](UC-042-saisonziel-beitrag.md) | Saisonziel für den Beitrag setzen und verfolgen | Vorstand, Mitglied | FR-158, FR-159, FR-160, FR-161, FR-162, FR-198 | Implemented (FR-198 wartet auf `0103`) |
| [UC-043](../implementation/UC-043/plan.md) | Mitgliederdaten strukturieren und exportieren | Vorstand, Trainer:in | FR-130, FR-163 | Implemented |
| [UC-045](../implementation/UC-045/plan.md) | Bilder des Vereins pflegen (Logo, Teambild, Profilbild) | Vorstand, Trainer:in, Mitglied | FR-166, FR-167, FR-168 | Implemented |

### Vereins-Gesundheit

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-023](UC-023-fuersorge-hinweis-triagieren.md) | Fürsorge-Hinweis triagieren | Trainer:in | FR-060 bis FR-069, FR-075 | Implemented |
| [UC-024](UC-024-wertdimensionen-einsehen.md) | Eigene Wertdimensionen einsehen | Mitglied | FR-071, FR-072 | Implemented |
| [UC-025](UC-025-transparenz-seite.md) | Transparenz-Seite und Health-Opt-out | Mitglied | FR-073, FR-074, FR-075 | Implemented |

### News, Puls & Benachrichtigungen

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-026](UC-026-news-publizieren.md) | Vereins-News publizieren | Vorstand | FR-076, FR-077, FR-078, FR-070 | Implemented |
| [UC-027](UC-027-vereins-puls-freigeben.md) | Vereins-Puls freigeben | Vorstand | FR-082, FR-083, FR-084, FR-070 | Implemented |
| [UC-028](UC-028-benachrichtigungen-einstellen.md) | Benachrichtigungen einstellen | Mitglied | FR-079, FR-080, FR-081 | Implemented |
| [UC-044](UC-044-meldungen-per-email.md) | Meldungen per E-Mail erhalten | Mitglied | FR-164, FR-165 | Implemented |
| [UC-048](UC-048-vereinsmail-und-warum.md) | Mail im Vereins-Look, mit Warum und Begrüssung | Mitglied | FR-182, FR-183, FR-184 | Implemented |
| [UC-050](UC-050-vereins-puls-persoenlich.md) | Vereins-Puls persönlich gestalten | Vorstand | FR-188 bis FR-192 | Implemented |
| [UC-052](UC-052-push-versand.md) | Push-Meldungen zustellen | System | FR-199, FR-079 | Partial (nicht in Betrieb) |
| [UC-038](UC-038-website-news-uebernehmen.md) | News von der Vereins-Website übernehmen | Vorstand | FR-146, FR-147, FR-149 | In Progress |

### «Stimme» & Dialog

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-029](UC-029-sprachmemo-aufnehmen.md) | Sprachmemo aufnehmen und adressieren | Mitglied | FR-085, FR-086, FR-087, FR-088, FR-089, FR-090 | In Progress |
| [UC-030](UC-030-anliegen-beantworten.md) | Anliegen beantworten | Vorstand | FR-091, FR-092, FR-093, FR-094, FR-099, FR-100 | Implemented |
| [UC-031](UC-031-sitzungs-input-einreichen.md) | Sitzungs-Input einreichen und zuordnen | Mitglied | FR-095, FR-096, FR-097, FR-098, FR-101 | Implemented |
| [UC-032](UC-032-kontext-check-in.md) | Kontext-Check-in beantworten | Mitglied | FR-102 bis FR-109 | Implemented |

### Sinn, Konfiguration & Anschlüsse

| UC | Titel | Primärakteur | Requirements | Status |
|---|---|---|---|---|
| [UC-033](UC-033-beitrags-profil-erfassen.md) | Beitrags-Profil erfassen | Mitglied | FR-058, FR-059 | Implemented |
| [UC-034](UC-034-vereinsidentitaet-konfigurieren.md) | Vereinsidentität, Begriffe und Module konfigurieren | Vorstand | FR-111, FR-112, FR-113, FR-114, FR-115 | Implemented |
| [UC-049](UC-049-vereins-ansprache-festlegen.md) | Ansprache des Vereins festlegen | Vorstand | FR-185, FR-186, FR-187 | Draft |
| [UC-035](UC-035-verband-verbinden.md) | Verband verbinden | Vorstand | FR-120, FR-121, FR-197 | Implemented |
| [UC-039](UC-039-verbands-team-verknuepfen.md) | Verbands-Team verknüpfen oder importieren | Vorstand | FR-150, FR-151, FR-152, FR-153 | Implemented |
| [UC-040](UC-040-bisherige-app-uebernehmen.md) | Termine aus der bisherigen myclub-App übernehmen | Vorstand | FR-154, FR-155, FR-156 | Implemented |
| [UC-036](UC-036-rechnungen-einsehen.md) | Rechnungen einsehen und Punkte bei pünktlicher Zahlung | Mitglied | FR-116, FR-117, FR-118, FR-119 | Implemented |
| [UC-046](UC-046-rechnung-stellen-und-versenden.md) | Rechnung stellen und mit QR-Einzahlungsschein versenden | Kassier:in | FR-169 bis FR-174, FR-176 | Implemented |
| [UC-047](UC-047-zahlungseingaenge-abgleichen.md) | Zahlungseingänge aus der Bankdatei abgleichen | Kassier:in | FR-175 | Implemented |
| [UC-037](UC-037-beispielinhalte-verwalten.md) | Beispielinhalte verwalten | Vorstand | FR-134 bis FR-145 | Implemented |

---

## Zuordnung zu den MVP-Inkrementen

| Inkrement | Use Cases |
|---|---|
| **M1 – Fundament** | UC-001 bis UC-008, UC-034, UC-037, UC-048 |
| **M2 – Agenda-Loop** | UC-009 bis UC-016, UC-020 |
| **M3 – Gemeinschaft** | UC-017 bis UC-019, UC-021 bis UC-033, UC-041 bis UC-043 und UC-045 (vorgezogen aus Ausbaustufe 2) |
| **M4 – Anschlüsse** | UC-035, UC-036, UC-039, UC-040, UC-046, UC-047 |

---

## Noch nicht spezifiziert

Diese Anforderungen sind bewusst nach dem MVP eingeplant und tragen im Katalog den Status
`Deferred`. Für sie existiert noch keine Spezifikation:

| Thema | Requirements |
|---|---|
| Badges, Level, Challenges, Rewards | FR-122 bis FR-125 |
| Meisterschaft | FR-128 |
| Eltern und Kinder | FR-129 |
| Exporte und Bulk-Import | FR-131, FR-132 – FR-130 ist seit UC-043 gebaut |
| Kalender-Publishing | FR-133 |

Ebenfalls ohne eigene Spezifikation, weil vollständig systemseitig: FR-060, FR-061, FR-068, FR-069
(Kennzahlen der Vereins-Gesundheit) – sie sind Anzeigeflächen der in UC-023 beschriebenen Signale und
werden seit dem 11.09.2026 im Plan zu UC-023 mitgeführt.

Ohne eigene Spezifikation, weil reine Navigationsregel: FR-148 (Verwaltung als eigene Gruppe) – der
Ablauf steht in UC-008, die Gliederung der Seite in [`../guidelines.md`](../guidelines.md) §2.

---

## Geschäftsregeln

Die Regeln BR-001 bis BR-270 sind fortlaufend und über alle Use Cases hinweg eindeutig vergeben. **Wer eine neue vergibt, prüft zuerst den höchsten Stand** – zuletzt kollidierten UC-044 und UC-045 auf BR-210 bis BR-213, und UC-048 musste FR-179 bis FR-181 an den parallel gebauten Sitzungs-Strang abgeben.
Die vier nicht verhandelbaren Regeln des Projekts sind über mehrere Use Cases verteilt:

| Prinzip | Regeln |
|---|---|
| **Punkte schreibt nur der Server** | BR-050, BR-051, BR-052, BR-065, BR-085, BR-087, BR-161 |
| **Rollenprüfung serverseitig** | BR-009, BR-027, BR-033, BR-053, BR-056, BR-096 |
| **Anti-Überwachung by Design** | BR-094 bis BR-099, BR-102, BR-105 bis BR-108, BR-122 bis BR-126, BR-136 bis BR-141 |
| **Verbindung vor Aufruf** | BR-043, BR-044, BR-069, BR-111, BR-113 bis BR-116 |
