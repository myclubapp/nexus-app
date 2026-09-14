# Testplan: Team-Scope für Trainer:innen (C-032, Migration 0073)

**Entscheid vom 2026-09-13:** Trainer:innen sind wie Mitglieder auf ihre eigenen
Teams begrenzt. Den Vereins-Scope haben nur Vorstand, Admin und Sportchef:in.
Vereinsweites (Termin, Aufgabe, News ohne Team) legt nur der Vorstand an.

## Voraussetzungen

- Ein Verein mit mindestens drei Teams und Terminen in jedem Team sowie
  mindestens einem Vereinstermin ohne Team.
- Vier Konten im selben Verein: **Trainer:in** in genau einem Team,
  **Mitglied** in genau einem Team, **Sportchef:in** und **Admin**.
- Die Migration `0073` ist eingespielt (`supabase migration list --linked`).

## TC-001: Trainer:in sieht nur ihr Team und den Verein

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Trainer:in anmelden, Tab Agenda öffnen | Es erscheinen nur Termine des eigenen Teams und Vereinstermine ohne Team |
| 2 | Filter öffnen | Der Abschnitt **Team** fehlt; nur die Terminart ist filterbar |
| 3 | Tab Marktplatz und Dashboard öffnen | Aufgaben und News fremder Teams erscheinen nicht |

## TC-002: Trainer:in schreibt nur für ihr Team aus

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Trainer:in in der Agenda **Termin erstellen** öffnen | Die Team-Auswahl ist auf das eigene Team vorbelegt; **Ganzer Verein** steht nicht zur Wahl |
| 2 | Den Hinweis unter der Auswahl lesen | «Als Trainer:in schreibst du Termine für deine Teams aus. Vereinstermine legt der Vorstand an.» |
| 3 | Dasselbe für **Aufgabe ausschreiben** und **News schreiben** | Gleiche Vorbelegung, gleicher Hinweis, keine Option «Ganzer Verein» |

## TC-003: Trainer:in kann fremde Termine nicht bearbeiten

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Trainer:in einen Vereinstermin (ohne Team) öffnen | Kein Weg zum Ändern, Absagen, Erinnern oder zur Teilnehmerliste; der QR-Code fehlt |
| 2 | Einen Termin des eigenen Teams öffnen | Ändern, Absagen, Erinnern, Teilnehmerliste und QR-Code sind da |

## TC-004: Serverseitig abgewiesen (C-011)

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Trainer:in `cancel_event` auf einen fremden Team-Termin aufrufen (Browser-Konsole oder Verhaltensprüfung) | Fehler «Nur Trainer:innen des Teams und der Vorstand sagen Termine ab» |
| 2 | `create_task` ohne `p_team_id` aufrufen | Fehler «Nur Trainer:innen des Teams und der Vorstand schreiben Aufgaben aus» |
| 3 | `connection_ratio` aufrufen | Fehler «Nur der Vorstand sieht die Verbindungs-Quote» |

## TC-005: Sportchef:in hat Vereins-Scope

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Sportchef:in die Agenda öffnen | Alle Termine aller Teams; im Filter erscheint der Abschnitt **Team** |
| 2 | **Termin erstellen** öffnen | **Ganzer Verein** steht zur Wahl, alle Teams sind wählbar |
| 3 | Einen Termin eines beliebigen Teams öffnen | Ändern, Absagen, Erinnern und Teilnehmerliste sind da |

## TC-006: Admin unverändert

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Admin Agenda, Marktplatz, Dashboard und Vereinsgesundheit öffnen | Alles wie vor `0073`: Vereins-Scope, Team-Filter, Routing und Verbindungs-Quote sichtbar |

## TC-007: Mitglied unverändert

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Mitglied Agenda und Marktplatz öffnen | Nur das eigene Team und der Verein; keine Planer-Knöpfe |

## TC-008: Trainer:in ohne Team

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Der Trainer:in im Admin-Bereich alle Teams entziehen, App neu laden | Agenda zeigt nur Vereinstermine |
| 2 | **Termin erstellen** öffnen | Die Team-Auswahl ist leer, darunter steht «Du bist noch keinem Team zugeordnet. Der Vorstand kann dich einem Team zuweisen.» |

## TC-009: Team-Stimmung und Teamzahlen

| Schritt | Aktion | Erwartung |
|---|---|---|
| 1 | Als Trainer:in die Seite Stimmung öffnen | Der Team-Wert zeigt nur das eigene Team |
| 2 | Als Sportchef:in dieselbe Seite öffnen | Alle Teams stehen zur Wahl |
| 3 | Als Trainer:in die Vereinsgesundheit öffnen | Teamzahlen nur für das eigene Team; Routing und Verbindungs-Quote fehlen |

## Übersicht

| TC | Titel | Priorität | Ergebnis |
|---|---|---|---|
| TC-001 | Trainer:in sieht nur ihr Team und den Verein | High | |
| TC-002 | Trainer:in schreibt nur für ihr Team aus | High | |
| TC-003 | Trainer:in kann fremde Termine nicht bearbeiten | High | |
| TC-004 | Serverseitig abgewiesen | High | |
| TC-005 | Sportchef:in hat Vereins-Scope | High | |
| TC-006 | Admin unverändert | Medium | |
| TC-007 | Mitglied unverändert | Medium | |
| TC-008 | Trainer:in ohne Team | Low | |
| TC-009 | Team-Stimmung und Teamzahlen | Medium | |
