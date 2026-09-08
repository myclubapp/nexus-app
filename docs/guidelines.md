# Implementation Guidelines: myclub nexus

Verbindliche Regeln für jede Umsetzung in diesem Repository. Sie gelten
zusätzlich zu `CLAUDE.md` und konkretisieren, **wie** eine Ansicht gebaut wird.

**Rangfolge bei Widerspruch:** `MVP_Scope_myclub.md` → `requirements.md` →
`CLAUDE.md` → dieses Dokument.

Die Regeln zu Ionic-Komponenten und zum Datenzugriff sind gegen die offizielle
Dokumentation von **Ionic 9** und **TanStack Query 5** geprüft (Context7). Die
Regeln zu Routing (`react-router` 6) und i18n (`react-i18next` 17) stammen aus
dem Bestand im Repository und aus `CLAUDE.md`.

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

**Inline-Styles (`style={{…}}`) sind nicht zulässig.** Zwei benannte Ausnahmen,
und nur diese:

- Werte, die zur Laufzeit aus Daten entstehen und deshalb in keiner
  Stylesheet-Regel stehen können – etwa eine Balkenbreite in Prozent. Auch die
  gehört in ein CSS-Custom-Property, nicht in eine Style-Deklaration.
- **Die Breite eines `IonSkeletonText`.** Die offizielle Ionic-Dokumentation
  schreibt sie in allen Beispielen als `style={{ width: '60%' }}`; dieser Weg
  ist hier bewusst übernommen, weil die Breite die Form des erwarteten Inhalts
  nachzeichnet und deshalb an der Stelle steht, an der sie gelesen wird
  (siehe §4).

---

## 2. Erscheinungsbild: iOS, mobil zuerst

`setupIonicReact({ mode: 'ios' })` in `src/App.tsx` setzt **auf allen
Plattformen** den iOS-Modus. Das ist bewusst: Die App hat eine Codebasis und
soll ein Erscheinungsbild haben (NFR-032, C-001). Der Material-Modus kennt weder
die zusammenfallenden grossen Titel noch die gruppierten Listen, auf denen das
gesamte UI aufbaut.

Daraus folgen die Muster:

| Muster                        | Umsetzung                                                              |
| ----------------------------- | ---------------------------------------------------------------------- |
| Grosser, einklappender Titel  | `AppPage` – nie von Hand `IonHeader`/`IonContent` zusammensetzen        |
| Gruppierter Abschnitt         | `ListSection` (`IonListHeader` + `IonList inset`)                       |
| Erklärtext unter einer Liste  | `ListSection footnote=…` (iOS-Fussnote), nicht ein `IonItem` mit Text   |
| Etwas erfassen                | `FormModal` – Abbrechen links, Bestätigen rechts                        |
| Mehrschrittige Erfassung      | `Wizard` – eine Frage je Schritt, Fortschrittsbalken                    |
| Zeilenaktion                  | `IonItemSliding` + `IonItemOption`, nicht ein drittes Icon in der Zeile |
| Auswahl zwischen Sichten      | `IonSegment` in `AppPage subToolbar=…`                                  |
| **Inhalt lädt**               | **Skelett in der Form des Inhalts** (§4), nicht ein Spinner             |
| **Eine Aktion läuft**         | **`IonSpinner` im auslösenden Knopf** (§4)                              |
| Rückfrage **vor** einer Aktion | `IonAlert` bzw. `IonActionSheet`, nie ein eigener Dialog                |
| Bestätigung **nach** einer Aktion | **Toast oben** über `useToast()` (§5)                               |
| Neu laden                     | `AppPage onRefresh=…` (`IonRefresher`)                                  |
| Lange Listen                  | `IonInfiniteScroll`, nicht ein «Mehr laden»-Knopf                       |

**Mobile first.** Alles wird für die Einhand-Bedienung auf einem Telefon
entworfen: Hauptaktion unten oder in der Kopfzeile rechts, Trefferflächen
mindestens 44 × 44 px (Ionic hält das ein, solange nichts verkleinert wird),
keine Ansicht, die Querformat oder Tablet voraussetzt.

---

## 3. Komponenten-Inventar

Bestand in `src/components/`. Vor jedem neuen Bauteil hier nachsehen.

| Komponente         | Zweck                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `AppPage`          | Seitengerüst: durchscheinende Kopfzeile, grosser Titel, `fullscreen`-Inhalt, optional Zurück-Knopf, zweite Toolbar, Aktualisieren |
| `ListSection`      | Gruppierter Listenabschnitt mit Überschrift, optionaler Aktion und Fussnote                                                       |
| `FormModal`        | Erfassungs-Blatt mit Abbrechen/Bestätigen, Ladezustand und Fehleranzeige                                                          |
| `Wizard`           | Schrittführung mit Fortschrittsbalken; der Formularzustand bleibt bei der Seite                                                   |
| `StatCard`         | Eine Kennzahl mit Beschriftung; mehrere in `.app-stat-row`                                                                        |
| `Skeletons` ⏳      | `SkeletonList`, `SkeletonStats`, `SkeletonCard` – die Ladeansicht jeder datengetriebenen Sicht (§4)                               |
| `StateViews`       | `EmptyState`, `ErrorState`, `NotConfiguredState`, `LoadingState`                                                                  |
| `FirstStepsCard`   | Die drei ersten Schritte nach der Gründung (UC-001)                                                                               |
| `RouteGuards`      | `RequireAuth`, `RequireClub`, `RedirectIfSignedIn`, `RedirectIfClubMember`                                                        |
| `LanguageSwitcher` | Sprachwahl über `IonSelect`                                                                                                       |
| `CheckInModal`     | QR-Scan über `html5-qrcode`                                                                                                       |
| `QrCode`           | QR-Code als Data-URL, ohne fremden Dienst (C-003)                                                                                 |

Dazu ein Hook, der zum UI gehört und nicht zum Datenzugriff:

| Hook         | Zweck                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| `useToast()` ⏳ | Kurzrückmeldung oben – der einzige zulässige Weg zu einem Toast (§5)   |

⏳ **Noch nicht gebaut.** `Skeletons.tsx` und `useToast.ts` sind die beiden
Bauteile, die §4 und §5 voraussetzen; sie entstehen mit der ersten Umsetzung,
die sie braucht. Bis dahin ist der Bestand nicht regelkonform:
`LoadingState` zeigt an acht Stellen einen Spinner statt eines Skeletts, und
der `IonToast` in `InvitePage` steht unten statt oben. Beides wird beim
nächsten Anfassen der jeweiligen Ansicht nachgezogen, nicht in einem eigenen
Durchgang.

**Jede Ansicht beginnt mit `AppPage`.** Eine Seite, die `IonPage` direkt
verwendet, ist ein Fehler, ausser sie hat nachweislich keine Kopfzeile.

**Jede datengetriebene Ansicht behandelt drei Zustände**: lädt (Skelett, §4),
leer (`EmptyState`), Fehler (`ErrorState`). Ein leerer Bildschirm ohne
Erklärung ist kein Zustand.

---

## 4. Laden: Skelett statt Spinner

**Wo Inhalt erwartet wird, steht während des Ladens ein Skelett in der Form
dieses Inhalts – kein Spinner.** Ein Spinner sagt «warte», ein Skelett sagt
«hier kommen drei Termine»; nur das zweite lässt die Ansicht schon lesen,
bevor sie da ist. Umgesetzt mit `IonSkeletonText animated`.

Die Trennung ist scharf:

| Situation                                        | Anzeige                                        |
| ------------------------------------------------ | ---------------------------------------------- |
| Inhalt wird zum ersten Mal geladen               | Skelett aus `Skeletons`                        |
| Eine ausgelöste Aktion läuft (Speichern, Senden) | `IonSpinner` **im auslösenden Knopf**          |
| Nachladen bei schon sichtbarem Inhalt            | nichts – der Inhalt bleibt stehen              |
| Ziehen zum Aktualisieren                         | `IonRefresher` über `AppPage onRefresh=…`      |

Der `IonSpinner` im Bestätigen-Knopf von `FormModal`, `Wizard`, `LoginPage`
und `ClubSettingsPage` bleibt also bestehen: Er gehört zu einer Aktion, die
die Person gerade selbst ausgelöst hat, nicht zu einem Inhalt, der ankommt.

**Die Skelette liegen in `src/components/Skeletons.tsx`**, nicht in den Seiten.
Sie zeichnen die Form der jeweiligen Ansicht nach – eine Liste bekommt drei bis
fünf Zeilen mit derselben Struktur wie die echten `IonItem`:

```tsx
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <IonList inset>
      {Array.from({ length: rows }, (_, i) => (
        <IonItem key={i}>
          <IonLabel>
            <h2>
              <IonSkeletonText animated style={{ width: '70%' }} />
            </h2>
            <IonNote>
              <IonSkeletonText animated style={{ width: '45%' }} />
            </IonNote>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}
```

Die Breiten stehen als Inline-Style, wie in der Ionic-Dokumentation – die
benannte Ausnahme aus §1. Alles andere am Skelett kommt aus den
Ionic-Komponenten selbst; eine eigene Animation oder ein eigener Grauton sind
nicht vorgesehen.

**Welches Flag das Skelett auslöst:** `query.isLoading`, nicht `isPending`.
In TanStack Query 5 ist `isLoading === isPending && isFetching`; eine per
`enabled: false` abgeschaltete Abfrage bleibt dauerhaft `isPending` und würde
ein Skelett zeigen, das nie verschwindet. Mehrere Abfragen auf einer Seite
werden mit `||` verbunden, damit die Ansicht in einem Stück erscheint statt in
Etappen.

```tsx
{agenda.isLoading ? (
  <SkeletonList />
) : agenda.error ? (
  <ErrorState error={agenda.error} onRetry={() => void agenda.refetch()} />
) : events.length === 0 ? (
  <EmptyState message={t('agenda.empty')} />
) : (
  …
)}
```

`LoadingState` aus `StateViews` bleibt nur für die ganzseitigen Weichen, bei
denen noch nicht feststeht, welcher Inhalt folgt: `RouteGuards` und
`AuthCallbackPage`. In einer Ansicht mit bekanntem Inhalt ist es ein Fehler.

---

## 5. Rückmelden: Toast oben

**Jede abgeschlossene Aktion meldet sich zurück, und zwar mit einem Toast am
oberen Rand.** Unten liegt die Tab-Leiste und der Daumen; oben verdeckt der
Toast nichts, was gerade bedient wird.

Der einzige Weg dorthin ist `useToast()` aus `src/hooks/useToast.ts`. Der Hook
kapselt `useIonToast` von Ionic und setzt `position: 'top'` selbst – damit ist
die Regel eine Eigenschaft des Codes und nicht der Disziplin:

```ts
export function useToast() {
  const [present] = useIonToast();

  const success = (message: string) =>
    present({ message, position: 'top', color: 'success', duration: 2000 });

  const failure = (message: string) =>
    present({ message, position: 'top', color: 'danger', duration: 3500 });

  return { success, failure };
}
```

Was worüber läuft:

| Fall                                                    | Weg                                    |
| ------------------------------------------------------- | -------------------------------------- |
| Schreibaktion erfolgreich                               | `toast.success(t('…'))` im `onSuccess` |
| Fehler **ohne** Bezug zu einem Eingabefeld              | `toast.failure(…)` im `onError`        |
| Fehler **mit** Bezug zu einem Eingabefeld               | Fehlerfeld von `FormModal`             |
| Eine Abfrage schlägt fehl                               | `ErrorState` mit `onRetry`             |
| Rückfrage, ob wirklich (Widerruf, Löschung)             | `IonAlert` – **vor** der Aktion        |

Die Trennung hat einen Grund: Ein Toast ist nach zwei Sekunden weg. Ein Fehler,
den die Person durch eine Korrektur beheben soll, muss stehen bleiben, solange
sie korrigiert – der gehört ins Formular. Ein Ladefehler muss den Weg zurück
anbieten («Nochmals versuchen») – der gehört in `ErrorState`.

**Stiller Erfolg ist verboten.** Eine Mutation ohne `onSuccess`-Rückmeldung
lässt die Person raten, ob etwas passiert ist. Das Muster:

```tsx
const createInvite = useCreateInvite();
const toast = useToast();

createInvite.mutate(input, {
  onSuccess: () => toast.success(t('invite.created')),
  onError: (error) => toast.failure(error.message),
});
```

Die Meldungstexte sind i18n-Schlüssel wie jeder andere Benutzertext und
entstehen in allen vier Sprachen gleichzeitig (§7). Wiederkehrende Meldungen
liegen unter `common.*` (`common.saved`, `common.deleted`), fachliche unter
ihrem Bereich (`invite.created`, `agenda.checkedIn`).

---

## 6. CSS

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
  eines eigenen Farbwerts – auch für den Toast (`color="success"` /
  `color="danger"`, nie ein eigener Grün- oder Rotton).
- **Ionic-Komponenten über ihre CSS-Custom-Properties anpassen**
  (`--background`, `--padding-start`, …), nicht über Selektoren auf ihre
  Innereien.

---

## 7. Sprache und Benennung

Aus `CLAUDE.md`, hier präzisiert:

| Was                               | Sprache  | Beispiel                             |
| --------------------------------- | -------- | ------------------------------------ |
| Bezeichner im Code                | Englisch | `confirmShift`, `MemberListPage`     |
| Dateinamen                        | Englisch | `EventFormModal.tsx`                 |
| CSS-Klassen                       | Englisch | `.app-skeleton`, `.app-stat-row`     |
| i18n-Schlüssel                    | Englisch | `invite.created`, `common.saved`     |
| Testdateien                       | Englisch | `AppPage.test.tsx`, `season.test.ts` |
| Datenbankobjekte                  | Englisch | `event_shifts`, `confirm_shift()`    |
| Kommentare und Dokumentation      | Deutsch  | `// Punkte schreibt nur der Server.` |
| Benutzertexte                     | i18n     | `t('agenda.attend')`                 |
| Fehlermeldungen aus der Datenbank | Deutsch  | `raise exception 'QR-Code ungültig'` |

Das gilt ausnahmslos: Auch wenn die Arbeitssprache des Teams Deutsch ist, sind
Dateinamen, Bezeichner, CSS-Klassen, i18n-Schlüssel und Testdateien **immer**
englisch. Ein `EinladungsSeite.tsx` oder ein Schlüssel `einladung.erstellt` ist
ein Fehler, auch wenn er funktioniert.

Namenskonventionen:

- Komponenten und Seiten: `PascalCase`, Seiten enden auf `Page`, Blätter auf
  `Modal`.
- Hooks: `useX.ts`, ein Kontext-Hook mit Provider als `useX.tsx`.
- React-Query-Schlüssel: `[bereich, vereinsId, …]`, z.B.
  `['agenda', clubId, range]` – der Vereinsbezug steht immer an zweiter Stelle,
  damit ein Vereinswechsel den Cache sauber trennt.
- Datenbankfunktionen: `verb_noun`, Parameter mit Präfix `p_`.

### Glossar (verbindlich)

Die Datenbank kennt **kein Sportvokabular** (C-009). Jeder Fachbegriff hat
genau eine englische Entsprechung im Code:

| Fachbegriff (Doku)   | Code / DB                      | Bemerkung                        |
| -------------------- | ------------------------------ | -------------------------------- |
| Verein               | `club`                         |                                  |
| Vereinsart           | `clubs.club_kind`              | `sport`, `music`, `culture`, `youth`, `neighborhood`, `other` |
| Mitglied             | `club_member`                  |                                  |
| Mitgliedschaft       | `membership`                   | im Frontend: `activeMembership`  |
| Team                 | `team` / `team_member`         |                                  |
| Termin               | `event`                        | UI über `useClub().eventLabel()` |
| Termintyp            | `events.type`                  | **nie** fest «Training»          |
| Helfer-Event         | `event` mit `type = 'helper'`  |                                  |
| Schicht              | `event_shift`                  |                                  |
| Teilnahme            | `attendance`                   |                                  |
| Aufgabe              | `task` / `task_assignment`     |                                  |
| Punktebuchung        | `point_transaction`            |                                  |
| Punkteregel          | `point_rule`                   |                                  |
| Säule                | `point_rules.pillar` (1–7)     |                                  |
| Saison               | `season` / `season_label()`    |                                  |
| Einladung            | `invite`                       | Code aus `gen_random_bytes`      |
| Einladung einlösen   | `redeem_invite()`              |                                  |
| Beitrittsgesuch      | `join_request`                 |                                  |
| Rolle                | `club_members.role`            | `member`, `trainer`, `admin`     |
| Neuigkeit            | `news`                         |                                  |
| Mitteilung           | `notification` / `push_token`  |                                  |
| Fürsorge-Hinweis     | `health_signal`                | nie «inaktiv», «säumig» (BR-095) |
| Vereins-Puls         | `pulse`                        |                                  |

---

## 8. i18n

- Jeder Benutzertext läuft über `react-i18next`. Kein Literal im JSX, auch
  nicht als Platzhalter – und auch nicht in einer Toast-Meldung.
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

## 9. Datenzugriff

- **Lesen** über React Query in einem Hook unter `src/hooks/`. Kein
  `supabase.from(...)` in einer Komponente.
- **Schreiben** über `useMutation`, mit `invalidateQueries` auf die betroffenen
  Schlüssel im `onSuccess` – und einer Rückmeldung nach §5.
- **Punkte** ausschliesslich über `security definer`-Funktionen
  (`award_points`, `check_in`, `confirm_task`, `confirm_shift`) – C-010,
  NFR-034. Keine Punktelogik im Frontend.
- **Berechtigungen** in RLS-Policies bzw. in der Datenbankfunktion, nie nur
  durch ein ausgeblendetes Bedienelement (C-011, NFR-011). Das Ausblenden im UI
  ist Bequemlichkeit, nicht Schutz.
- **Jede neue `security definer`-Funktion** braucht im selben Schritt ein
  `revoke execute … from public, anon` (Vorlage `0007_function_grants.sql`).
- **Fehler sind sichtbar.** Jede fehlgeschlagene Aktion zeigt eine Rückmeldung
  – `ErrorState`, `toast.failure()` oder das Fehlerfeld von `FormModal`, je
  nach §5. Ein leerer `catch` ist ein Fehler.

---

## 10. Ausdrücklich verboten

1. **Inline-Styles**, ausser den zwei benannten Ausnahmen in §1.
2. **Eine `.css`-Datei je Komponente.** Es gibt ein Stylesheet (§6).
3. **Hex-Farben und Pixelabstände von Hand** statt Tokens (§6).
4. **Ein Toast ohne `position="top"`** – oder an `useToast()` vorbei direkt
   über `IonToast`/`useIonToast`. Die Position ist keine Entscheidung der
   einzelnen Ansicht.
5. **Stiller Erfolg.** Eine erfolgreiche Schreibaktion ohne Rückmeldung (§5).
6. **Eine Ionic-Komponente nachbauen**, statt sie zu verwenden oder zu
   umhüllen.
7. **Ein Literal als Benutzertext** im JSX, auch als vermeintlicher Platzhalter
   (§8).

---

## 11. Struktur

```
src/
  components/   Wiederverwendbare Bauteile (siehe §3)
  hooks/        Datenzugriff, Kontexte und useToast
  lib/          Reine Logik ohne React: supabase, season, format, theme, Typen
  pages/        Eine Datei je Ansicht, nach Bereich gruppiert
  i18n/locales/ de, fr, it, en
  theme/        variables.css – das einzige Stylesheet
  test/         setup.ts und renderWithProviders
supabase/migrations/  Fortlaufend nummeriert: NNNN_thema.sql
docs/
  use_cases/          UC-NNN-*.md
  implementation/     UC-NNN/plan.md – der lebende Umsetzungsplan
  test-plans/         uc-NNN-*.md – Testpläne für Gerätetests
```

Neue Typen: Aufzählungen und verengte Zeilentypen in `src/lib/database.types.ts`,
**nie** in `database.generated.ts` – die wird von `types:generate` überschrieben
(NFR-036).

---

## 12. Prüfung vor dem Abschluss

`npm run verify` (Typen, Lint, i18n-Parität, Tests) muss durchlaufen. Zusätzlich
je Use Case:

1. **Code-Review** (`/ai-code-review`) gegen diese Regeln.
2. **Manueller Testplan** unter `docs/test-plans/` (`/ai-manual-test`).
3. **Vitest-Tests** für die Logik und die neuen Komponenten (`/ai-vitest`).
4. **Statusabgleich**: FR-Status in `docs/requirements.md` und `Status` im
   Use-Case-Dokument nachziehen – im selben Schritt wie die Umsetzung.
