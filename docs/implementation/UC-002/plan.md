# Implementation Plan: UC-002 — Per Einladung beitreten

|                   |                                                                  |
| ----------------- | ---------------------------------------------------------------- |
| **Primary Actor** | Gast                                                              |
| **Goal**          | Über einen Einladungslink oder QR-Code Mitglied eines Vereins werden |
| **Plan created**  | 2026-09-08                                                        |
| **Status**        | In Progress                                                       |

## Overview

Ein Gast öffnet einen Einladungslink, sieht Verein, Team und die vorgesehene
Rolle, meldet sich falls nötig an, gibt seinen Anzeigenamen ein und ist
Mitglied. Der Code ist dabei die Berechtigung – eine zusätzliche Freigabe
findet nicht statt (BR-006). Der ganze Weg soll nach der Anmeldung höchstens
zwei Eingaben umfassen, damit er unter 60 Sekunden bleibt (BR-007).

## Related Use Cases

- UC-003 Einladung erstellen — erzeugt den Link, den dieser Ablauf einlöst
- UC-005 Anmelden — Zwischenschritt, wenn keine Sitzung besteht (A4 dort)
- UC-004 Beitritts-Anfrage entscheiden — der Ausweg bei ungültiger Einladung
- UC-007 Mitglieder und Teams verwalten — nimmt die entstandene Mitgliedschaft auf

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                | User Story (Kurz)                              | Status  | Notizen                                                          |
| ------ | -------------------- | ---------------------------------------------- | ------- | ---------------------------------------------------------------- |
| FR-008 | Einladung einlösen   | In unter 60 Sekunden Mitglied werden           | Partial | Umgesetzt; die 60 Sekunden sind erst im Gerätetest belegt         |
| FR-003 | Deep-Link-Rücksprung | Der Link führt in die installierte App zurück  | Partial | `inviteCodeFromUrl()` deckt Schema- und Web-Adresse ab; Gerätetest offen |
| FR-011 | Mehrere Vereine      | Mehreren Vereinen angehören und wechseln       | Partial | Der beigetretene Verein wird aktiv gesetzt                        |

### Business Rules

| ID     | Regel                                                | Status      | Notizen                                                            |
| ------ | ---------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| BR-005 | Einladung trägt ihren Geltungsbereich                 | Implemented | `preview_invite()` zeigt Verein, Team und Rolle vor dem Beitritt    |
| BR-006 | Einladung ist die Berechtigung                        | Implemented | `redeem_invite()` legt die Mitgliedschaft ohne Freigabe an          |
| BR-007 | Höchstens zwei Eingabeschritte nach der Anmeldung     | Implemented | Anzeigename und Bestätigung – mehr nicht                            |
| BR-008 | Keine Rollenerhöhung durch Wiedereinlösung            | Implemented | Bestehende Mitgliedschaft bleibt unverändert; nur das Team kommt dazu |

### Non-Functional Requirements

| ID      | Titel               | Kategorie | Trifft zu | Notizen                                                       |
| ------- | ------------------- | --------- | --------- | ------------------------------------------------------------- |
| NFR-024 | Beitritt ≤ 60 s     | Usability | Ja        | Im Testplan als TC-001 Schritt 8 gemessen                     |
| NFR-011 | Mandantentrennung   | Security  | Ja        | `preview_invite()` gibt nur vier Felder heraus                |
| NFR-013 | Funktionsrechte     | Security  | Ja        | `preview_invite` bewusst für `anon`, `redeem_invite` nicht    |
| NFR-028 | Sprachparität       | Usability | Ja        | Auch die vier Ungültig-Gründe                                 |
| NFR-027 | Barrierefreiheit    | Usability | Ja        | Beitritt ist ein Kernfluss                                    |

---

## Current State

- `supabase/migrations/0009_invites.sql`: `preview_invite()` (Schritt 2, A1, A2),
  `redeem_invite(p_code, p_display_name)` (Schritte 5–6, A3, A4), Spalte
  `revoked_at`.
- `app/src/pages/onboarding/JoinByInvitePage.tsx`: der gesamte Ablauf inklusive
  der vier Ungültig-Gründe und des Sonderfalls «bereits Mitglied».
- `app/src/lib/invite.ts`: Link bauen, Code aus Deep Link und Web-Adresse
  lesen, den Code über die Anmeldung hinweg merken.
- `app/src/hooks/useAuth.tsx`: Ein Einladungs-Deep-Link wird gemerkt statt als
  Anmeldecode getauscht.
- `app/src/pages/auth/AuthCallbackPage.tsx` und `RouteGuards.tsx`: Rücksprung
  auf die Einladung nach der Anmeldung (A4 aus UC-005).
- `app/src/App.tsx`: Route `/invite/:code` **ohne** Anmeldeschranke.

---

## Missing Pieces

| #   | Was fehlt                                                                            | Anforderung | Quelle          |
| --- | ------------------------------------------------------------------------------------ | ----------- | --------------- |
| 1   | Prüfung gegen eine laufende Datenbank – `preview_invite` und `redeem_invite` sind ungetestetes SQL | FR-008 | Automated |
| 2   | Der Weg «Beitritts-Anfrage stellen» führt heute ins Onboarding, nicht in UC-004       | FR-009      | Cross-reference |
| 3   | Gerätetest des Deep Links (`ch.myclub.nexus://invite/…`)                              | FR-003, C-012 | Cross-reference |

---

## Implementation Guidelines

- **UI-Komponenten:** `AppPage`, `ListSection`, `SkeletonList`, `InlineError`,
  `ErrorState`. Kein neues Bauteil.
- **Styling:** nur Klassen aus `src/theme/variables.css`.
- **Struktur:** Seite unter `src/pages/onboarding/`, Datenzugriff in
  `src/hooks/useInvites.ts` und `useOnboarding.ts`.

---

## Implementation Tasks

- [x] 1. `preview_invite()` in `0009_invites.sql` – gibt Verein, Team, Rolle und
      Gültigkeit zurück, für `anon` freigegeben.
- [x] 2. `redeem_invite(p_code, p_display_name)` – Anzeigename, Widerruf,
      bestehende Mitgliedschaft, Team-Ergänzung; alte Signatur gelöscht.
- [x] 3. `useInvitePreview()` und `useRedeemInvite()`.
- [x] 4. `JoinByInvitePage` mit den vier Ungültig-Gründen und dem Fall
      «bereits Mitglied».
- [x] 5. Route `/invite/:code` ohne Anmeldeschranke.
- [x] 6. Deep-Link-Erkennung und gemerkter Code über die Anmeldung hinweg.
- [x] 7. Rücksprung nach der Anmeldung in `AuthCallbackPage` und `RedirectIfSignedIn`.
- [x] 8. **i18n-Vollständigkeit** — alle Texte in vier Sprachen, `i18n:check` grün.
- [x] 9. **Wiring und Fehlerrückmeldung** — jeder Fehlschlag zeigt eine Meldung.
- [x] 10. Vitest für `inviteCodeFromUrl()`, `inviteLink()` und den gemerkten Code.
- [x] 11. Manueller Testplan `docs/test-plans/uc-002-per-einladung-beitreten.md`.
- [ ] 12. **Migrationen gegen eine laufende Datenbank prüfen** (`supabase db reset`).
- [ ] 13. **Plattform-Parität** — Deep Link auf iOS und Android, Web-Fallback.
- [ ] 14. **Statusabgleich** — FR-008 und FR-003 nachziehen, `Status` in
      `UC-002-per-einladung-beitreten.md` setzen. Erst nach 12 und 13.

---

## Open Questions & Risks

| #   | Frage / Risiko                                                                                                                                                                          | Impact | Owner       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------- |
| 1   | Migrationen 0008 und 0009 sind nie ausgeführt worden – Docker läuft auf der Arbeitsmaschine nicht. Bis dahin ist der gesamte Ablauf ungeprüftes SQL.                                    | High   | Dev         |
| 2   | **Spec-Lücke:** UC-002 A1/A2 bieten «eine Beitritts-Anfrage stellen» an. Wo die entsteht, sagt die Spezifikation nicht. Angenommen: der Weg führt ins Onboarding, bis UC-004 gebaut ist. | Medium | Stakeholder |
| 3   | `preview_invite` ist bewusst für `anon` ausführbar. Der Code hat 128 Bit, ein Durchprobieren ist damit ausgeschlossen; die Funktion gibt ausserdem nur vier Felder heraus.               | Low    | Dev         |
| 4   | Der gemerkte Code liegt in `localStorage`, weil der Anmeldelink je nach E-Mail-Programm einen neuen Tab öffnet. Ein geteiltes Gerät könnte den Code eines Vorgängers vorfinden.          | Low    | Dev         |

---

## Progress Log

| Datum      | Update                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-09-08 | Plan erstellt; Umsetzung zusammen mit UC-001 und UC-003 abgeschlossen, ausser Datenbankprüfung |
