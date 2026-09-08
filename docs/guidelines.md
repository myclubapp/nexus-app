# Implementation Guidelines: myclub nexus

Verbindliche Regeln für jede Umsetzung in diesem Repository. Sie gelten
zusätzlich zu `CLAUDE.md` und konkretisieren, **wie** eine Ansicht gebaut wird.

**Rangfolge bei Widerspruch:** `MVP_Scope_myclub.md` → `requirements.md` →
`CLAUDE.md` → dieses Dokument.

---

## 1. Grundsatz

> **Ionic-Standard vor Eigenbau. Wiederverwenden vor Neubauen. Zentrales CSS vor
> lokalem Stil.**

Konkret, in dieser Reihenfolge geprüft:

1. Gibt es eine Ionic-Komponente, die das kann? → sie verwenden.
2. Gibt es in `src/components/` bereits etwas dafür? → das verwenden.
3. Braucht es ein neues, wiederverwendbares Bauteil? → nach `src/components/`,
   mit Klassen in `src/theme/variables.css`.
4. Erst wenn all das nicht trägt: eine seitenlokale Lösung – und ein Eintrag
   unter «Open Questions & Risks» im Umsetzungsplan, der begründet, warum.

**Inline-Styles (`style={{…}}`) sind nicht zulässig.** Einzige Ausnahme sind
Werte, die zur Laufzeit aus Daten entstehen und deshalb nicht in einer
Stylesheet-Regel stehen können – etwa eine Balkenbreite in Prozent. Auch die
gehört dann in ein CSS-Custom-Property, nicht in eine Style-Deklaration.

---

## 2. Erscheinungsbild: iOS, mobil zuerst

`setupIonicReact({ mode: 'ios' })` in `src/App.tsx` setzt **auf allen
Plattformen** den iOS-Modus. Das ist bewusst: Die App hat eine Codebasis und
soll ein Erscheinungsbild haben (NFR-032, C-001). Der Material-Modus kennt weder
die zusammenfallenden grossen Titel noch die gruppierten Listen, auf denen das
gesamte UI aufbaut.

Daraus folgen die Muster:

| Muster                       | Umsetzung                                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| Grosser, einklappender Titel | `AppPage` – nie von Hand `IonHeader`/`IonContent` zusammensetzen    |
| Gruppierter Abschnitt        | `ListSection` (`IonListHeader` + `IonList inset`)                   |
| Erklärtext unter einer Liste | `ListSection footnote=…` (iOS-Fussnote), nicht ein `IonItem` mit Text |
| Etwas erfassen               | `FormModal` – Abbrechen links, Bestätigen rechts                    |
| Zeilenaktion                 | `IonItemSliding` + `IonItemOption`, nicht ein drittes Icon in der Zeile |
| Auswahl zwischen Sichten     | `IonSegment` in `AppPage subToolbar=…`                              |
| Bestätigung einer Aktion     | `IonAlert` bzw. `IonActionSheet`, nie ein eigener Dialog            |
| Kurzrückmeldung              | `IonToast`                                                          |
| Neu laden                    | `AppPage onRefresh=…` (`IonRefresher`)                              |
| Lange Listen                 | `IonInfiniteScroll`, nicht ein «Mehr laden»-Knopf                   |

**Mobile first.** Alles wird für die Einhand-Bedienung auf einem Telefon
entworfen: Hauptaktion unten oder in der Kopfzeile rechts, Trefferflächen
mindestens 44 × 44 px (Ionic hält das ein, solange nichts verkleinert wird),
keine Ansicht, die Querformat oder Tablet voraussetzt.

---

## 3. Komponenten-Inventar

Bestand in `src/components/`. Vor jedem neuen Bauteil hier nachsehen.

| Komponente                  | Zweck                                                                    |
| --------------------------- | ------------------------------------------------------------------------ |
| `AppPage`                   | Seitengerüst: durchscheinende Kopfzeile, grosser Titel, `fullscreen`-Inhalt, optional Zurück-Knopf, zweite Toolbar, Aktualisieren |
| `ListSection`               | Gruppierter Listenabschnitt mit Überschrift, optionaler Aktion und Fussnote |
| `FormModal`                 | Erfassungs-Blatt mit Abbrechen/Bestätigen, Ladezustand und Fehleranzeige  |
| `StatCard`                  | Eine Kennzahl mit Beschriftung; mehrere in `.app-stat-row`               |
| `StateViews`                | `LoadingState`, `EmptyState`, `ErrorState`, `NotConfiguredState`         |
| `RouteGuards`               | `RequireAuth`, `RequireClub`, `RedirectIfSignedIn`, `RedirectIfClubMember` |
| `LanguageSwitcher`          | Sprachwahl über `IonSelect`                                              |
| `CheckInModal`              | QR-Scan über `html5-qrcode`                                              |

**Jede Ansicht beginnt mit `AppPage`.** Eine Seite, die `IonPage` direkt
verwendet, ist ein Fehler, ausser sie hat nachweislich keine Kopfzeile.

**Jede datengetriebene Ansicht behandelt drei Zustände** über `StateViews`:
lädt, leer, Fehler. Ein leerer Bildschirm ohne Erklärung ist kein Zustand.

---

## 4. CSS

Es gibt genau eine Stylesheet-Datei: `src/theme/variables.css`. Sie enthält

- die Ionic-Farb-Tokens (die Vereinsfarben überschreiben sie zur Laufzeit aus
  `clubs.settings.theme`, siehe `src/lib/theme.ts` – C-013), und
- die `app-*`-Klassen für Abstände und Schriftgrössen, die Ionic nicht mitbringt.

Regeln:

- **Keine `.css`-Datei je Komponente.** Neue Klassen kommen in
  `variables.css`, mit Präfix `app-` und einem Kommentar, wofür sie da sind.
- **Abstände aus dem Raster**: `--app-space-1` … `--app-space-6`. Keine
  Pixelwerte von Hand.
- **Farben nur über Tokens.** Ein Hex-Wert in einer Komponente bricht das
  Vereins-Theming. Für Ionic-Komponenten heisst das `color="primary"` statt
  eines eigenen Farbwerts.
- **Ionic-Komponenten über ihre CSS-Custom-Properties anpassen**
  (`--background`, `--padding-start`, …), nicht über Selektoren auf ihre
  Innereien.

---

## 5. Sprache und Benennung

Aus `CLAUDE.md`, hier präzisiert:

| Was                                | Sprache  | Beispiel                                |
| ---------------------------------- | -------- | --------------------------------------- |
| Bezeichner im Code                 | Englisch | `confirmShift`, `MemberListPage`         |
| Dateinamen                         | Englisch | `EventFormModal.tsx`                     |
| Datenbankobjekte                   | Englisch | `event_shifts`, `confirm_shift()`        |
| Kommentare und Dokumentation       | Deutsch  | `// Punkte schreibt nur der Server.`     |
| Benutzertexte                      | i18n     | `t('agenda.attend')`                     |
| Fehlermeldungen aus der Datenbank  | Deutsch  | `raise exception 'QR-Code ungültig'`     |

Namenskonventionen:

- Komponenten und Seiten: `PascalCase`, Seiten enden auf `Page`, Blätter auf
  `Modal`.
- Hooks: `useX.ts`, ein Kontext-Hook mit Provider als `useX.tsx`.
- React-Query-Schlüssel: `[bereich, vereinsId, …]`, z.B.
  `['agenda', clubId, range]` – der Vereinsbezug steht immer an zweiter Stelle,
  damit ein Vereinswechsel den Cache sauber trennt.
- Datenbankfunktionen: `verb_noun`, Parameter mit Präfix `p_`.

### Glossar (verbindlich)

Die Datenbank kennt **kein Sportvokabular** (C-009). Diese Zuordnung gilt:

| Fachbegriff (Doku)     | Code / DB                           | UI-Text                          |
| ---------------------- | ----------------------------------- | -------------------------------- |
| Verein                 | `club`                              | `t('…')`                         |
| Mitglied               | `club_member`                       | –                                |
| Team                   | `team`                              | –                                |
| Termin                 | `event`                             | `useClub().eventLabel(type)`     |
| Termintyp              | `events.type`                       | **nie** fest «Training»          |
| Helfer-Event           | `event` mit `type = 'helper'`       | –                                |
| Schicht                | `event_shift`                       | –                                |
| Aufgabe                | `task`                              | –                                |
| Punktebuchung          | `point_transaction`                 | –                                |
| Punkteregel            | `point_rule`                        | –                                |
| Säule                  | `point_rules.pillar` (1–7)          | –                                |
| Saison                 | `season` / `season_label()`         | –                                |
| Fürsorge-Hinweis       | `health_signal`                     | nie «inaktiv», «säumig» (BR-095) |
| Vereins-Puls           | `pulse`                             | –                                |

---

## 6. i18n

- Jeder Benutzertext läuft über `react-i18next`. Kein Literal im JSX, auch
  nicht als Platzhalter.
- Ein neuer Schlüssel entsteht **in allen vier Dateien gleichzeitig**
  (`de`, `fr`, `it`, `en`). `npm run i18n:check` erzwingt die Parität (C-007,
  NFR-028) und läuft in `npm run verify`.
- Schlüsselbaum nach Bereich: `agenda.*`, `marketplace.*`, `members.*`, …
  Gemeinsames unter `common.*`.
- Zahlwörter über die Plural-Suffixe von i18next (`points_one`,
  `points_other`), nicht durch eigene Verzweigungen.
- Datum und Zahl über `src/lib/format.ts` – dort steht die Schweizer
  Lokalisierung je Sprache.

---

## 7. Datenzugriff

- **Lesen** über React Query in einem Hook unter `src/hooks/`. Kein
  `supabase.from(...)` in einer Komponente.
- **Schreiben** über `useMutation`, mit `invalidateQueries` auf die betroffenen
  Schlüssel im `onSuccess`.
- **Punkte** ausschliesslich über `security definer`-Funktionen
  (`award_points`, `check_in`, `confirm_task`, `confirm_shift`) – C-010,
  NFR-034. Keine Punktelogik im Frontend.
- **Berechtigungen** in RLS-Policies bzw. in der Datenbankfunktion, nie nur
  durch ein ausgeblendetes Bedienelement (C-011, NFR-011). Das Ausblenden im UI
  ist Bequemlichkeit, nicht Schutz.
- **Jede neue `security definer`-Funktion** braucht im selben Schritt ein
  `revoke execute … from public, anon` (Vorlage `0007_function_grants.sql`).
- **Fehler sind sichtbar.** Jede fehlgeschlagene Aktion zeigt eine Rückmeldung
  (`ErrorState`, `IonToast` oder das Fehlerfeld von `FormModal`). Ein leerer
  `catch` ist ein Fehler.

---

## 8. Struktur

```
src/
  components/   Wiederverwendbare Bauteile (siehe §3)
  hooks/        Datenzugriff und Kontexte
  lib/          Reine Logik ohne React: supabase, season, format, theme, Typen
  pages/        Eine Datei je Ansicht, nach Bereich gruppiert
  i18n/locales/ de, fr, it, en
  theme/        variables.css – das einzige Stylesheet
  test/         setup.ts und renderWithProviders
supabase/migrations/  Fortlaufend nummeriert: NNNN_thema.sql
docs/
  use_cases/          UC-NNN-*.md
  implementation/     UC-NNN/plan.md – der lebende Umsetzungsplan
  manual_tests/       UC-NNN-*.md – Testpläne für Gerätetests
```

Neue Typen: Aufzählungen und verengte Zeilentypen in `src/lib/database.types.ts`,
**nie** in `database.generated.ts` – die wird von `types:generate` überschrieben
(NFR-036).

---

## 9. Prüfung vor dem Abschluss

`npm run verify` (Typen, Lint, i18n-Parität, Tests) muss durchlaufen. Zusätzlich
je Use Case:

1. **Code-Review** (`/ai-code-review`) gegen diese Regeln.
2. **Manueller Testplan** unter `docs/manual_tests/` (`/ai-manual-test`).
3. **Vitest-Tests** für die Logik und die neuen Komponenten (`/ai-vitest`).
4. **Statusabgleich**: FR-Status in `docs/requirements.md` und `Status` im
   Use-Case-Dokument nachziehen – im selben Schritt wie die Umsetzung.
