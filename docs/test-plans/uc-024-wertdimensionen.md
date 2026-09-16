# Manual Test Plan: UC-024 — Eigene Wertdimensionen einsehen

**Use Case:** [UC-024](../use_cases/UC-024-wertdimensionen-einsehen.md)
**Geltungsbereich:** Netzdiagramm, Vergleichslinien, nicht erhobene Dimensionen, Führungssicht
**Anforderungen:** FR-071, FR-072
**Regeln:** BR-100 bis BR-104, BR-209
**Erstellt:** 2026-09-09

## Vorbereitung

- **A**, **B**, **C** — Mitglieder in Team «Aktive» mit unterschiedlich vielen
  Punkten aus den Säulen 1 (Training), 3 (Freiwilliges Engagement) und 4
  (Vereinsleben).
- **TA** — Trainer:in von Team «Aktive». **TB** — Trainer:in eines anderen Teams.
- **N** — Neumitglied ohne jede Buchung.
- Säule 2 (Wettkampf) ist im Verein **deaktiviert**, für Finanzen besteht keine Regel.
- Migration `0042_value_dimensions.sql` ist eingespielt.

---

## TC-001: Das eigene Bild (Hauptablauf)

**Priority:** High
**Preconditions:** Als **A** angemeldet.

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Tab «Wirkung» öffnen | Ein Netzdiagramm mit **fünf** beschrifteten Achsen (Schritt 2) | | |
| 2 | Die Beschriftungen lesen | Engagement, Ehrenamt, Finanzen, Netzwerk, Treue – lesbar, nicht abgeschnitten | | |
| 3 | Die Legende lesen | Fläche = du, gestrichelt = Team, gepunktet = Verein (Schritt 3) | | |
| 4 | Nach einer Gesamtnote oder einem Rang suchen | Es gibt keine (BR-101) | | |
| 5 | Den Satz über der Liste lesen | Er benennt eine **Stärke**, keine Lücke (Schritt 4) | | |
| 6 | Eine Dimension antippen | Ein Blatt erklärt, woraus sie entsteht und was sie wachsen lässt (Schritt 6) | | |

---

## TC-002: Nicht erhoben ist nicht null (BR-103, A2)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Regel «Rechnung pünktlich bezahlt» im Verein **deaktivieren** | Die Zeile «Finanzen» zeigt rechts **«nicht erhoben»**, keine Zahl | | |
| 2 | Das Diagramm ansehen | Auf der Finanz-Achse liegt **kein** Punkt – die Fläche lässt sie aus | | |
| 3 | Die Regel wieder **aktivieren** | «Finanzen» ist erhoben und zeigt einen Wert (0, solange niemand eine Rechnung fristgerecht bezahlt hat) | | |
| 4 | Säule 4 (Vereinsleben) im Verein deaktivieren | «Netzwerk» erscheint ebenfalls als «nicht erhoben», nicht als 0 | | |
| 5 | Säule 2 (Wettkampf) prüfen | «Engagement» bleibt erhoben – Säule 1 ist aktiv | | |

---

## TC-002a: Finanzen hat eine Quelle (BR-209, FR-119)

**Priority:** High
**Preconditions:** Die Regel `invoice_on_time` ist aktiv; für **M1** ist eine
Rechnung fristgerecht bezahlt und abgeglichen (UC-047).

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **M1** den Tab «Wirkung» öffnen | «Finanzen» trägt einen Wert – nicht «nicht erhoben» | | |
| 2 | «Finanzen» antippen | Die Erklärung nennt die pünktliche Bezahlung, **nicht** ein Modul, das noch kommt | | |
| 3 | «Treue» ansehen | Die Zahlungspunkte zählen dort **nicht** mehr mit | | |
| 4 | Im Punkteverlauf die Buchung «Rechnung pünktlich bezahlt» suchen | Sie steht unverändert in Säule 6 – die Punktevergabe hat sich nicht geändert | | |
| 5 | In der Rangliste das Blatt «Punktequelle» öffnen | «Finanzen» steht als Gruppe da, mit genau einem Chip und **ohne** Säule darunter | | |
| 6 | «Finanzen» in der Rangliste wählen | Nur die Zahlungspunkte zählen | | |

---

## TC-003: Vergleichslinien und Mindestgruppe (BR-104, A3)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** (Team mit drei Buchenden) prüfen | Team- und Vereinslinie sind da | | |
| 2 | Als **TB** (allein im Team) prüfen | Die Team-Linie fehlt, die Vereinslinie bleibt (A3) | | |
| 3 | Die Zeile einer Dimension mit zu kleiner Gruppe lesen | «Für einen Vergleich ist die Gruppe zu klein» | | |
| 4 | Prüfen, ob sich aus einem Durchschnitt eine Einzelperson ableiten lässt | Nein – unter drei Personen gibt es keinen Wert (NFR-022) | | |

---

## TC-004: Zu wenig Daten (A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **N** die Seite öffnen | Das Diagramm ist da, alle fünf Achsen stehen | | |
| 2 | Den Satz über der Liste lesen | «Das Bild füllt sich mit deinen ersten Beiträgen» – es wird **keine** Stärke erfunden | | |
| 3 | Die Vergleichslinien prüfen | Sie sind trotzdem sichtbar | | |

---

## TC-005: Führungssicht (A4, FR-072, BR-102)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **TA** in der Mitgliederverwaltung **A** öffnen | Der Eintrag «Stärken als Gesprächsgrundlage» steht da | | |
| 2 | Ihn antippen | Dasselbe Diagramm, derselbe positive Wortlaut | | |
| 3 | Nach Sortierung oder Export suchen | Es gibt weder das eine noch das andere (A4, BR-102) | | |
| 4 | Als **TB** dieselbe Adresse mit `?member=` von **A** aufrufen | Abgewiesen | | |
| 5 | Als **B** (Mitglied) dasselbe versuchen | Abgewiesen | | |
| 6 | Nach einer Ansicht suchen, die Mitglieder nach Dimension ordnet | Es gibt keine (BR-102) | | |

---

## TC-006: Keine neue Datenerhebung (BR-100)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Prüfen, welche Tabellen `value_dimensions()` liest | Nur `point_transactions`, `point_rules`, `team_members` | | |
| 2 | Prüfen, ob durch das Öffnen der Seite etwas geschrieben wird | Nein | | |

---

## Vier Sprachen

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Sprache auf Französisch, Italienisch und Englisch stellen | Achsenbeschriftungen, Erklärungen und die Legende sind übersetzt; die Beschriftung bleibt im Diagramm lesbar | | |
