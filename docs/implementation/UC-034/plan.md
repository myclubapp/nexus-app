# Implementation Plan: UC-034 — Vereinsidentität, Begriffe und Module konfigurieren

|                   |                                                                    |
| ----------------- | ------------------------------------------------------------------ |
| **Primary Actor** | Vorstand                                                            |
| **Goal**          | Die App die Sprache und das Erscheinungsbild des eigenen Vereins sprechen lassen |
| **Plan created**  | 2026-09-11                                                          |
| **Status**        | Done                                                                |

## Overview

Dieser Use Case gehört zu **M1 – Fundament**, ist aber der letzte, der gebaut
wird. Das hat einen Grund: Er konfiguriert, was die anderen gebaut haben.

Zwei Regeln bestimmen ihn. **BR-149: «Konfiguration ist Kür.»** Alle
Einstellungen haben Standardwerte; ein Verein muss nichts konfigurieren, um die
App zu nutzen. Und **BR-150: «Module im Tempo des Vereins.»** Weitere Module
werden vorgeschlagen, nie automatisch aktiviert – das ist K7 aus dem
MVP-Schnitt: Zero-Config-Start mit Agenda, Einladung und Punkten, alles Weitere
kommt, wenn der Verein bereit ist.

Daraus folgt die unangenehmste Entscheidung dieses Plans: **Stimme, Sitzungen,
Check-ins, Puls und Cockpit werden ab hier standardmässig ausgeschaltet.** Sie
sind gebaut und bleiben es; sichtbar werden sie, wenn der Vorstand sie
einschaltet. Alles andere widerspräche K7.

## Related Use Cases

- UC-004 Verein gründen — legt den Verein an; die Standardwerte gelten ab da
- UC-009 Termin erfassen — die Begriffe, die hier konfiguriert werden
- UC-029 bis UC-033 — die Module, die hier ein- und ausgeschaltet werden
- UC-037 Beispielinhalte — der zweite M1-Use-Case, der nach den anderen kommt

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                   | Status vorher   | Ziel        | Notizen                                                          |
| ------ | ----------------------- | --------------- | ----------- | ---------------------------------------------------------------- |
| FR-111 | Vereinsfarben und Logo  | **In Progress** | **Partial** | Farben und Kontrastprüfung stehen; das Logo kommt als Adresse, nicht als Upload – dafür fehlt Storage |
| FR-112 | Begriffe konfigurieren  | **In Progress** | Implemented | **Je Sprache** – heute ist es ein Wort für alle vier (BR-148)      |
| FR-113 | Saisonbeginn festlegen  | **In Progress** | Implemented | A4: die Warnung vor dem Wechsel fehlte                            |
| FR-114 | Vereins-DNA erfassen    | Open            | **Partial** | Erfasst und gespeichert; **verwendet** wird sie erst, wenn es textunterstützende Funktionen gibt |
| FR-115 | Progressive Aktivierung | Open            | Implemented | Module mit Vorschlag ab einer Schwelle, nie automatisch            |

### Business Rules

| ID     | Regel                          | Ziel        | Notizen                                                       |
| ------ | ------------------------------ | ----------- | ------------------------------------------------------------- |
| BR-146 | Theming zur Laufzeit           | Implemented | Besteht seit UC-004; hier kommt die Kontrastprüfung dazu       |
| BR-147 | Begriffe sind Labels, keine Typen | Implemented | Die Datenbank kennt weiterhin nur `events.type`               |
| BR-148 | Vier Sprachen                  | Implemented | **Die eigentliche Lücke**: Begriffe je Sprache statt ein Wort  |
| BR-149 | Konfiguration ist Kür          | Implemented | Jede Einstellung hat einen Standardwert; nichts ist Pflicht    |
| BR-150 | Module im Tempo des Vereins    | Implemented | `suggest_modules()` schlägt vor; einschalten tut der Vorstand  |

### Non-Functional Requirements

| ID      | Titel                      | Kategorie     | Betrifft? | Notizen                                          |
| ------- | -------------------------- | ------------- | --------- | ------------------------------------------------ |
| NFR-011 | Serverseitige Berechtigung | Security      | Ja        | `is_club_admin()` in der Policy, nicht nur im UI  |
| NFR-028 | Vier Sprachen              | Usability     | Ja        | Hier doppelt: die App **und** die Vereinsbegriffe |
| NFR-032 | Ein Erscheinungsbild       | Usability     | Ja        | Ein Build für alle Vereine (BR-146)               |
| NFR-036 | Generierte Typen getrennt  | Maintainability | Ja      | Die Form von `clubs.settings` steht in `database.types.ts` |

---

## Current State

- `app/src/pages/ClubSettingsPage.tsx`: Name, Saisonstart, drei Vereinsfarben
  und die Begriffe je Terminart – **ein Wort für alle vier Sprachen**.
- `app/src/lib/theme.ts`: `applyClubTheme()` und `luminance()`; die
  Kontrastprüfung aus A5 fehlt.
- `app/src/lib/clubSettings.ts`: `buildClubSettings()` – die reine Funktion,
  an die die neuen Bereiche andocken.
- Die Module sind **gebaut, aber nicht schaltbar**: `settings.checkin.enabled`
  wird von `0050` gelesen und ist standardmässig **an** – das Gegenteil von K7.
- Kein Logo, keine Vereins-DNA, kein Modulbereich.

---

## Missing Pieces

| #   | Was fehlt                                       | Anforderung    | Quelle          |
| --- | ----------------------------------------------- | -------------- | --------------- |
| 1   | Begriffe gelten für alle Sprachen gleich        | FR-112, BR-148 | Automated       |
| 2   | Kein Logo                                       | FR-111         | Automated       |
| 3   | Keine Kontrastprüfung                           | A5             | Cross-reference |
| 4   | Keine Warnung beim Saisonwechsel                | A4             | Cross-reference |
| 5   | Keine Module, keine Schalter                    | FR-115, A1     | Automated       |
| 6   | Kein Vorschlag ab einer Schwelle                | A2, BR-150     | Cross-reference |
| 7   | Keine Vereins-DNA                               | FR-114, A3     | Automated       |

---

## Implementation Guidelines

Verbindlich aus `docs/guidelines.md`:

- **Bauteile:** `AppPage`, `ListSection` mit `footnote`, `IonToggle` für die
  Module, `IonAlert` für die Rückfrage vor dem Saisonwechsel (§2, genau ein
  `role: 'cancel'`, **kein** `color`), `useToast()`.
- **Kein neues Bauteil** und kein zweiter Farbwähler: `IonInput type="color"`
  besteht bereits.
- **Kein Inline-Style** für den Kontrasthinweis; er ist Text, keine Fläche.
- **Entscheidungen** als reine Funktionen in `lib/clubSettings.ts` und
  `lib/theme.ts` (§9).
- **Typen:** die Form von `clubs.settings` nach `database.types.ts`, nie in
  `database.generated.ts` (§12, NFR-036).
- **Struktur:** Migration `0052_club_identity.sql`; die Seite bleibt
  `ClubSettingsPage`, die Bereiche werden Abschnitte.

---

## Implementation Tasks

- [x] 1. Migration `0052_club_identity.sql`: Begriffe je Sprache umstellen,
      `module_enabled()`, Modul-Sperren in den bestehenden Funktionen,
      `suggest_modules()` + Cron
- [x] 2. `lib/theme.ts`: Kontrastverhältnis und ein kontrastreicherer Vorschlag (A5)
- [x] 3. `lib/clubSettings.ts`: Begriffe je Sprache, Module, DNA – als reine Funktionen
- [x] 4. `database.types.ts`: die neue Form von `clubs.settings`
- [x] 5. `useClub().eventLabel()`: Auflösung über die Sprache mit Rückfall
- [x] 6. `ClubSettingsPage`: vier Bereiche – Erscheinungsbild, Begriffe, Module, DNA
- [x] 7. Modul-Sperren im Client: Einstiegspunkte und Routen
- [x] 8. Vier Sprachen – `npm run i18n:check`
- [x] 9. Verhaltensprüfung gegen die verknüpfte Datenbank
- [x] 10. `ai-code-review` und Behebung der Befunde
- [x] 11. Vitest für Kontrast, Begriffsauflösung und Modulschalter
- [x] 12. Manueller Testplan `docs/test-plans/uc-034-vereinsidentitaet.md`
- [x] 13. Statusabgleich in `requirements.md`, UC-Dokument, `use_cases/README.md`
      und `entity_model.md`

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                                                                                                   | Impact   | Owner       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------- |
| 1   | **Fünf gebaute Module werden standardmässig ausgeschaltet.** K7 und BR-150 verlangen es; für einen Verein, der die App heute nutzt, verschwinden damit Funktionen, bis der Vorstand sie einschaltet. Umgesetzt mit einem Vorschlag ab einer Schwelle, damit sie nicht vergessen gehen. | **High** | Stakeholder |
| 2   | Die Umstellung der Begriffe auf **ein Objekt je Sprache** ändert die Form bestehender Daten. Umgesetzt: Die Migration schreibt den vorhandenen Text in **alle vier** Sprachen – das ist genau das heutige Verhalten, nur explizit.                                  | Medium   | Dev         |
| 3   | Das Logo verlangt einen Datei-Upload; Supabase Storage ist im Projekt nicht eingerichtet (offen seit UC-026). Umgesetzt: eine Adresse, wie beim News-Bild. FR-111 bleibt deshalb `Partial`.                                                                         | Medium   | Stakeholder |
| 4   | FR-114 sagt, die Vereins-DNA werde «in allen textunterstützenden Funktionen» verwendet. Solche Funktionen gibt es nicht (keine KI-Textfunktion im MVP). Erfasst und gespeichert wird sie; **verwendet** noch nicht – deshalb `Partial`.                              | Medium   | Stakeholder |
| 5   | Die Schwelle aus A2 ist mit «etwa vierzig aktive Mitglieder» nur angedeutet. Angenommen: **40 aktive Mitglieder** für Stimme und Sitzungen, **20** für Check-ins, in `clubs.settings` nicht einstellbar – eine Schwelle, die jeder Verein selbst setzt, wäre keine. | Low      | Stakeholder |
| 6   | A5 nennt keinen Grenzwert. Angenommen: **4.5:1** gegen die gewählte Kontrastfarbe (WCAG AA für Text), mit einem abgedunkelten Vorschlag.                                                                                                                            | Low      | Dev         |

---

## Progress Log

| Datum      | Eintrag       |
| ---------- | ------------- |
| 2026-09-11 | Plan erstellt |
| 2026-09-11 | `0052_club_identity.sql` eingespielt; Verhaltensprüfung mit **21 von 21** bestanden. Die beiden, auf die es ankommt: Ein Anliegen bei ausgeschaltetem Modul wird **am Server** abgewiesen (C-011), und der Vorschlag schaltet **nichts** ein (BR-150) |
| 2026-09-11 | Die Migration nimmt kein Modul weg, das ein Verein bereits benutzt. «Standardmässig aus» gilt für **neue** Vereine – einem Verein, der seit Wochen Anliegen schreibt, das Modul zu entziehen, wäre aus Sicht der Bedienenden ein Datenverlust |
| 2026-09-11 | Begriffe je Sprache: Die Umstellung schreibt den vorhandenen Text in alle vier Sprachen – genau das heutige Verhalten, nur explizit. Die Probe belegt, dass eine spätere Übersetzung einen zweiten Lauf übersteht |
| 2026-09-11 | App-Seite: vier Bereiche in `ClubSettingsPage`, Kontrastprüfung in `theme.ts`, Modul-Sperren an allen Einstiegspunkten; vier Sprachen, 1149 Schlüssel |
| 2026-09-11 | **Review-Befund:** Das Logo war gespeichert und bearbeitbar – und **nirgends angezeigt**. FR-111 verlangt das Gegenteil; es steht jetzt in der Seitenleiste neben dem Vereinsnamen, mit Alternativtext |
| 2026-09-11 | Zweiter Befund: Ohne das Modul «Gesundheit» blieb für Trainer:innen eine Überschrift «Verwaltung» über einer leeren Liste stehen. `hasAdminLinks()` beantwortet die Frage jetzt an **einer** Stelle für beide Einhängepunkte |
| 2026-09-11 | Dritter Befund: `PUSH_CATEGORIES` fehlten in ihrem Test die seit UC-030/032 zugestellten Kategorien `input` und `checkin` |
| 2026-09-11 | Statusabgleich: FR-112, FR-113 und FR-115 auf `Implemented`; FR-111 und FR-114 auf `Partial` (Storage bzw. fehlende Textfunktionen); UC-034 auf `Implemented` |
