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
| Blatt über der Seite          | `presentingElement` aus `usePresentingElement()` – Karte statt Vollbild |
| Zeilenaktion                  | `IonItemSliding` + `IonItemOption`, nicht ein drittes Icon in der Zeile |
| Zu-/Absage-Status             | `AttendanceStatusIcon` am Zeilenanfang, Wischen nach rechts für die Gegenantwort, Zusagen-Zahl als `IonBadge` rechts, Namen im `EventDetailModal` – der Schnitt der bestehenden myclub-App |
| News                          | `NewsCard` im `IonGrid` (12 / 6 / 6 / 4 Spalten), Volltext im `NewsDetailModal` – der Schnitt der bestehenden myclub-App |
| **Etwas Neues anlegen**       | **`AppPage createActions=…`** – Plus unten rechts, nie ein Symbol in der Kopfzeile |
| Auswahl zwischen Sichten      | `IonSegment` in `AppPage subToolbar=…`                                  |
| Auswahl aus einer Liste       | `IonSelect` **mit `cancelText`/`okText`** – sonst «Cancel»/«OK» (§8)    |
| **Datum oder Uhrzeit**        | **`DateField`** – `IonDatetimeButton` + `IonModal` + `IonDatetime`, nie ein rohes `<input type="date">`/`datetime-local` (§8; Fallstrick in `CLAUDE.md`) |
| Eine Person in einer Zeile    | `MemberAvatar` am Zeilenanfang (Bild, sonst Initialen), die Rolle als `IonBadge` – der Schnitt des `user-list-item` der bestehenden myclub-App |
| **Inhalt lädt**               | **Skelett in der Form des Inhalts** (§4), nicht ein Spinner             |
| **Eine Aktion läuft**         | **`IonSpinner` im auslösenden Knopf** (§4)                              |
| Rückfrage **vor** einer Aktion | `IonAlert` bzw. `IonActionSheet`, nie ein eigener Dialog                |
| Bestätigung **nach** einer Aktion | **Toast oben** über `useToast()` (§5)                               |
| Neu laden                     | `AppPage onRefresh=…` (`IonRefresher`)                                  |
| Lange Listen                  | `IonInfiniteScroll`, nicht ein «Mehr laden»-Knopf                       |

**Mobile first.** Alles wird für die Einhand-Bedienung auf einem Telefon
entworfen: Hauptaktion unten in Daumenreichweite, Trefferflächen mindestens
44 × 44 px (Ionic hält das ein, solange nichts verkleinert wird), keine
Ansicht, die Querformat oder Tablet voraussetzt.

### Neues entsteht unten rechts

**Was etwas Neues anlegt – News, Termin, Aufgabe, Einladung, Punkteregel,
Team –, steht als rundes Plus unten rechts über dem Inhalt, nicht als Symbol
in der Kopfzeile.** Ein `IonFab` in der Vereinsfarbe:

```tsx
<AppPage
  title={t('dashboard.title')}
  createActions={
    isTrainer
      ? [{ icon: createOutline, label: t('newsForm.title'), onClick: openForm }]
      : undefined
  }
>
```

Drei Gründe, und alle drei gelten für jede Ansicht gleich:

- **Der Daumen kommt hin.** Die Kopfzeile ist auf einem heutigen Telefon die
  am schwersten erreichbare Zone; die untere rechte Ecke die leichteste.
- **Ein Zeichen, überall dasselbe.** Vorher trug dieselbe Handlung je Seite
  ein anderes Symbol – ein Stift auf der Startseite, ein Plus in der Agenda.
  Wer «neu» sucht, sucht ab jetzt an einer Stelle nach einem Zeichen.
- **Rang wird sichtbar.** In der Kopfzeile steht die Hauptaktion gleichrangig
  neben Nebensächlichem. Der Fab hebt sie heraus.

Umgesetzt ist das einmal, in `CreateFab`: `slot="fixed"`, `vertical="bottom"`,
`horizontal="end"`, `color="primary"`, Symbol `add`. Eingehängt wird er **nur**
über `AppPage createActions=…` – dort landet er als direktes Kind des
`IonContent` und damit im Slot, der ihn beim Scrollen stehen lässt. Ein
`IonFab` in einer Seite selbst ist ein Fehler; `CreateFab.test.tsx` hält das
fest.

Hat eine Seite **mehrere** Erstellen-Wege, klappen sie aus demselben Plus nach
oben auf (`IonFabList`): Das Plus trägt dann `common.create`, jeder Weg sein
eigenes Symbol und seinen eigenen Namen für Bedienhilfen. Der häufigere Weg
steht zuerst, also am nächsten beim Plus.

Die Kopfzeile behält, was **nichts anlegt**: filtern, teilen, eine Sicht
umschalten. `toolbarEnd` bleibt dafür bestehen.

Die Regel gilt für den **Einstieg** ins Erfassen. Ein beschrifteter Knopf
mitten im Inhalt bleibt richtig, wo er zu einem Text gehört, der ihn erklärt
oder begrenzt – «Anliegen schreiben» unter dem verbleibenden Kontingent
(`VoicePage`), «Freigeben» am Ende des komponierten Pulses (`PulsePage`). Ein
Fab trüge dort das Wort nicht mit, das die Handlung verständlich macht.

### Blätter: Karte über der Seite, nicht Vollbild

**Jedes `IonModal` bekommt ein `presentingElement`.** Ohne dieses Element legt
sich das Blatt als Vollbild über die App: kein Rand, kein sichtbarer
Hintergrund, kein Hinweis darauf, woher es kam und wohin das Schliessen führt.
Mit ihm fährt die darunterliegende Seite zurück und dunkelt ab, das Blatt
bekommt runde Ecken und einen Rand – das Karten-Muster («card modal»), das iOS
für «etwas erfassen, dann zurück» verwendet. Ionic zeigt es ausschliesslich im
iOS-Modus, und der gilt hier auf allen Plattformen (§2).

Das presentierende Element ist immer dasselbe und wird nie von Hand gesucht:

```tsx
const presentingElement = usePresentingElement();

<IonModal isOpen={…} onDidDismiss={…} presentingElement={presentingElement}>
```

`usePresentingElement()` liefert das **äussere** `ion-router-outlet`
(`id="main"` in `src/App.tsx`) – nicht das verschachtelte Outlet der Tabs.
Nähme das Blatt das innere, bliebe der Tab-Balken vor der zurückgefahrenen
Seite stehen und die Karte läge halb darauf. Findet der Hook kein Outlet – in
jsdom, vor dem ersten Anhängen –, gibt er `undefined` zurück und Ionic zeigt
das Blatt wie bisher als Vollbild. Das ist der Ausfallweg, keine Ausnahme.

Der Hook sucht das Outlet **beim Rendern**, nicht erst in einem Effekt danach.
Ionic liest `presentingElement` genau im Moment des Präsentierens; ein Blatt,
das mit `isOpen` in den Baum kommt – jede Erfassung entsteht erst beim
Öffnen –, präsentiert sich vor dem ersten Effekt. Ein nachträglich gesetztes
Element holt die Karte nicht mehr nach: Das Blatt bleibt Vollbild, nur die
Klasse `modal-card` kommt dazu. Wer den Hook auf ein `useEffect` umbaut, baut
genau diesen Fehler wieder ein.

### Ein Blatt fällt erst, wenn es unten ist

Ein Blatt, das erst beim Öffnen entsteht – jede Erfassung, jedes Detail mit
eigenem Zustand –, darf **nicht** im selben Moment aus dem Baum fallen, in dem
die Seite es schliesst. Ionic nimmt ein Blatt, das mitten im Präsentieren
entfernt wird, ohne Übergang heraus, und die Seite darunter bleibt in ihrer
Karten-Stellung stehen: auf 91,5 % verkleinert, abgedunkelt, ohne Weg zurück.
Sichtbar wird das nach jedem Speichern, weil die Seite dort `isOpen` auf
`false` setzt oder den Gegenstand auf `null`.

Dazwischen liegt deshalb das `onDidDismiss` von Ionic, und die Brücke dorthin
ist `useSheetProps()`. Die Hülle jedes solchen Blattes sieht gleich aus:

```tsx
export function NewsFormModal({ isOpen, ...props }: NewsFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <NewsForm {...sheet} />;
}

export function TaskDetailModal({ task, ...props }: … & { task: Task | null }) {
  const sheet = useSheetProps(task ? { task, ...props } : null);
  return sheet && <TaskDetail {...sheet} />;
}
```

Gibt die Seite `null`, bleiben die zuletzt gesehenen Eigenschaften stehen, der
Inhalt bekommt `isOpen: false` und reicht es an `FormModal` weiter, das Blatt
fährt zu – und erst sein `onDismiss` gibt den Inhalt frei. Öffnet die Seite
erneut, beginnt das Blatt leer, weil der Inhalt dazwischen abgebaut war.

Drei Folgen:

- **Der Inhalt trägt `isOpen?: boolean`** (Standard `true`, damit ein Test ihn
  direkt rendern kann) und gibt es an `FormModal` weiter. Ein `<FormModal
  isOpen>` mit nacktem `isOpen` ist ein Fehler – `sheetLifetime.test.ts`
  hält das fest.
- **Die Hülle gehört zur Komponente, nicht zur Seite.** Ein
  `{writing && <MeetingInputForm …/>}` in einer Seite ist derselbe Fehler an
  anderer Stelle; die Seite hängt `<MeetingInputModal isOpen={writing} …/>`
  ein.
- **Ein Blatt, das nie abgebaut wird** – `EventDetailModal`, `ShiftListModal`,
  die Erklärungs-Blätter in `StrengthsPage` –, braucht davon nichts: Es steht
  von Anfang an im Baum und wechselt nur `isOpen`.

`FormModal` erledigt das für jede Erfassung selbst. Wer ein Blatt ohne diese
Hülle baut – Scanner, QR-Anzeige, Listen-Blatt –, holt sich das Element über
den Hook; `usePresentingElement.test.tsx` prüft das für jede Datei, die ein
`IonModal` öffnet.

Zwei Folgen gehören zur Karte dazu:

- **Sie lässt sich nach unten wegwischen.** Wo dabei Eingaben verloren gingen,
  fängt `canDismiss` die Geste ab und fragt über ein `IonActionSheet` nach –
  dasselbe Verhalten wie in Mail und Kalender. Ein Blatt, das nur anzeigt,
  braucht das nicht.

  Der Wächter steckt in `useDiscardGuard()` und wird von `FormModal` für jede
  Erfassung gestellt; die Formulare selbst melden nichts an. Scharf wird er
  vom ersten `ionInput` oder `ionChange` aus dem Blatt – Ionic löst beide nur
  bei einer **Benutzereingabe** aus, ein vorausgefülltes Feld also nicht. Drei
  Punkte gehören dazu:

  - **Abgefangen wird jeder Weg, der den Entwurf wegwirft**: die Wischgeste
    (`role: 'gesture'`), der Griff neben das Blatt (`role: 'backdrop'`, auf dem
    Laptop anklickbar) und der Abbrechen-Knopf (`role: 'cancel'`). Damit
    Abbrechen dort ankommt, ruft es `modal.dismiss(undefined, 'cancel')` statt
    `onDismiss` – ein direkter Aufruf ginge an Ionic vorbei und der Entwurf wäre
    wortlos weg, während die Geste daneben noch fragt.

    **Nicht** abgefangen wird das gesteuerte Schliessen ohne Rolle: Setzt die
    Seite nach dem Speichern `isOpen={false}`, ruft Ionic ebenfalls `dismiss()`
    und prüft auch dort `canDismiss`. Ein Wächter, der jede Rolle abfängt, fragt
    nach dem erfolgreichen Speichern «verwerfen?» und sperrt das Blatt zu.
  - **Unbeschrieben bleibt `canDismiss` der Wert `true`**, nicht eine Funktion,
    die `true` zurückgibt. Ionic liest zu Beginn der Geste `canDismiss !== true`
    und lässt das Blatt sonst nur ein Fünftel weit mitlaufen; ein leeres Blatt
    behielte damit das gebremste Gefühl, obwohl es nichts zu retten gibt.
  - **Das Action Sheet steht neben dem Blatt, nicht darin.** Im Blatt ginge es
    mit ihm unter, bevor jemand geantwortet hat.

  Ausnahme mit Grund: `DeleteAccountModal`. Dort ist das Wegwischen der
  ungefährliche Ausgang aus einer zerstörerischen Handlung und soll leicht
  bleiben. `discardGuard.test.ts` führt die Liste und prüft jedes andere Blatt
  mit Eingabefeld.
- **Ein Blatt über einem Blatt** nimmt das darüberliegende Modal als
  presentierendes Element, nicht wieder das Outlet – sonst stapeln sich zwei
  Karten auf derselben Ebene.

**Schliessen steht genau einmal: in der Kopfzeile.** Ein Blatt, das nur
anzeigt – Termin-Detail, Schichten, QR-Code, Scanner –, hat den Knopf
«Schliessen» als `IonButton` in den `IonButtons` der `IonToolbar` und sonst
nirgends. Kein zweiter Schliessen-Knopf am Ende des Inhalts, kein `app-actions`
nur dafür: Derselbe Knopf zweimal auf einem Blatt wirkt wie zwei verschiedene
Handlungen, und wer nach unten scrollt, findet ohnehin die Wischgeste und die
Kopfzeile. Der Inhalt endet mit dem, was er zeigt. Am Ende eines Blattes steht
ein Knopf nur, wenn er etwas **tut** – Bestätigen in `FormModal`, «Mein Status»
im Termin-Detail, die Antwort im Einsatz-Blatt. Folge für den Schnitt: Die
Inhalts-Komponente (`EventDetail`, `ShiftList`, `EventQr`, …) kennt kein
`onDismiss`; das gehört allein der Blatt-Hülle, die Kopfzeile und `IonModal`
stellt.

Dasselbe gilt für ein `FormModal`, das nur anzeigt – eine Einreichung mit
Knöpfen je Zeile, ein Fürsorge-Hinweis, die Sammelansicht einer Sitzung: Es
bekommt **kein `onSubmit`**. Dann trägt die Kopfzeile genau einen Knopf,
«Schliessen», an der Stelle von Abbrechen, und rechts steht nichts. Ein
`submitLabel={t('common.close')}` mit `onSubmit={onDismiss}` stellt
«Abbrechen» und «Schliessen» nebeneinander – zwei Knöpfe für dieselbe
Handlung. Wechselt ein Blatt je nach Zustand zwischen Erfassen und Anzeigen
(`TaskDetail`, `NoteAnswer`), wechselt es `onSubmit` zwischen der Aktion und
`undefined`.

### Alerts und Action Sheets: die Rolle färbt den Knopf

Ein Knopf in `IonAlert` oder `IonActionSheet` bekommt **nie** ein `color`. Seine
Farbe entsteht aus seiner Rolle, und Ionic setzt sie im iOS-Modus selbst:

| Knopf                                | Rolle                 | Farbe                         |
| ------------------------------------ | --------------------- | ----------------------------- |
| Abbrechen, Schliessen, «Nicht jetzt» | `role: 'cancel'`      | Vereinsfarbe (Ionic-Standard) |
| Löschen, Widerrufen, Zurückziehen    | `role: 'destructive'` | Rot über `--ion-color-danger` |
| Jede andere Bestätigung              | keine Rolle           | Vereinsfarbe                  |

Abbrechen bleibt bewusst in der Vereinsfarbe – so wie in den Systemdialogen von
iOS. Herausgehoben wird nur, was Daten entfernt: Genau ein roter Knopf im Blatt,
und die Person sieht auf einen Blick, welcher der beiden der gefährliche ist.

Zwei Folgen:

- **Jedes Overlay hat genau einen Knopf mit `role: 'cancel'`.** Ohne ihn
  schliesst die Geste zurück nichts und der Abbrechen-Knopf steht wie eine
  zweite Hauptaktion da. `overlayRoles.test.ts` prüft das für jede Datei.
- **Ein Wegwerf-Knopf trägt `role: 'destructive'`**, auch wenn die Aktion
  fachlich harmlos klingt («Verbindung trennen»).

### Breite Bildschirme: eine Oberfläche, nicht zwei

Mobile first heisst nicht «nur mobil». Der Vorstand arbeitet am Laptop, viele
Mitglieder auf dem Tablet – dieselbe Oberfläche muss dort brauchbar sein
(NFR-032). Der Unterschied ist genau **ein** Bauteil:

| Breite            | Navigation                                                        |
| ----------------- | ----------------------------------------------------------------- |
| < 992 px (`lg`)   | Tab-Balken unten, Seitenleiste fährt über den `IonMenuButton` ein  |
| ≥ 992 px (`lg`)   | Tab-Balken unten, Seitenleiste steht dauerhaft als Spalte daneben  |

Umgesetzt ist das im `IonSplitPane` in `src/App.tsx`. Daraus folgen vier
Regeln:

- **Kein zweites Layout und keine eigene Breitenabfrage.** Weder
  `window.innerWidth` noch eine `@media`-Regel, die Bauteile ein- und
  ausblendet. Was sich mit der Breite ändert, ändert `IonSplitPane`
  (`when="lg"`) oder das `autoHide` einer Ionic-Komponente.
- **Die Seitenleiste ist nicht die Hauptnavigation.** Die fünf Bereiche bleiben
  im Tab-Balken – auch auf dem Laptop. In die Seitenleiste (`AppMenu`) gehört,
  was auf dem Telefon unter «Profil» begraben liegt: Konto, Vereinswechsel,
  Verwaltung, Sprache, Abmelden.
- **Der Menüknopf gehört in `AppPage`, nicht in die einzelne Seite.** Er steht
  links in der Kopfzeile, sobald die Seite keinen Zurück-Knopf hat, und blendet
  sich über `autoHide` selbst aus – ohne angemeldetes Menü (Anmeldung,
  Onboarding) und sobald die Seitenleiste als Spalte steht.
- **Ein Eintrag, der an zwei Stellen steht, ist eine Komponente.** Die
  Verwaltungswege stehen in der Seitenleiste **und** auf der Profilseite; sie
  sind deshalb `ClubAdminLinks` und werden dort eingehängt, nicht kopiert.
- **Verwaltung ist ein eigener Abschnitt, keine Zeile unter «Einstellungen».**
  `ClubAdminLinks` hängt an beiden Stellen in einer eigenen `ListSection` mit
  dem Titel `menu.administration` (FR-148). Wer die Einträge in den
  Einstellungs-Abschnitt einreiht, macht Vorstandswege zu persönlichen
  Optionen: Das Mitglied kann dann nicht lesen, was es selbst entscheidet und
  was es für den Verein tut. Der Abschnitt erscheint nur, wenn
  `isAdmin || isTrainer` – dieselbe Bedingung, die `ClubAdminLinks` selbst
  prüft; sie steht aussen, weil eine `ListSection` sonst als leere Überschrift
  stehen bliebe.

Ein `IonMenuToggle` umschliesst immer einen **ganzen Abschnitt**, nie eine
einzelne Zeile: Läge es um das einzelne `IonItem`, wäre jede Zeile Einzelkind
ihres Wrappers und die Trennlinien der eingefassten Liste fielen weg. Und es
trägt `autoHide={false}`, sonst ist die Spalte auf dem Laptop leer.

---

## 3. Komponenten-Inventar

Bestand in `src/components/`. Vor jedem neuen Bauteil hier nachsehen.

| Komponente         | Zweck                                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `AppPage`          | Seitengerüst: durchscheinende Kopfzeile, grosser Titel, `fullscreen`-Inhalt, optional Zurück-Knopf, zweite Toolbar, Aktualisieren, Erstellen-Fab |
| `CreateFab`        | Das Plus unten rechts – der einzige Weg zu einem `IonFab`; eingehängt über `AppPage createActions=…` (§2)                        |
| `ListSection`      | Gruppierter Listenabschnitt mit Überschrift, optionaler Aktion und Fussnote                                                       |
| `FormModal`        | Erfassungs-Blatt mit Abbrechen/Bestätigen, Ladezustand und Fehleranzeige                                                          |
| `Wizard`           | Schrittführung mit Fortschrittsbalken; der Formularzustand bleibt bei der Seite                                                   |
| `StatCard`         | Eine Kennzahl mit Beschriftung; mehrere in `.app-stat-row`                                                                        |
| `Skeletons`        | `SkeletonList`, `SkeletonStats`, `SkeletonCard` – die Ladeansicht jeder datengetriebenen Sicht (§4); `SkeletonPage` als ganze Seite für die Weiche vor den Tabs |
| `StateViews`       | `EmptyState`, `ErrorState`, `NotConfiguredState`, `LoadingState`                                                                  |
| `FirstStepsCard`   | Die drei ersten Schritte nach der Gründung (UC-001)                                                                               |
| `RouteGuards`      | `RequireAuth`, `RequireClub`, `RedirectIfSignedIn`, `RedirectIfClubMember`                                                        |
| `AppMenu`          | Seitenleiste im `IonSplitPane`: Konto, Vereinswechsel, Verwaltung, Sprache, Abmelden – Spalte ab `lg`, sonst Overlay              |
| `ClubAdminLinks`   | Die Verwaltungswege des Vorstands als Listeneinträge; einmal definiert, in `AppMenu` und auf der Profilseite eingehängt            |
| `LanguageSwitcher` | Sprachwahl über `IonSelect`                                                                                                       |
| `DateField`        | Datum, Uhrzeit oder beides über `IonDatetime` im Karten-Blatt; die Formulare behalten ihre Zeichenketten, übersetzt wird in `lib/dateInput.ts` |
| `MemberAvatar`     | Der Avatar einer Person – Bild aus `avatar_url`, sonst Initialen auf der Vereinsfarbe; in Mitgliederliste, Team und Rangliste dieselbe Zeile |
| `TeamDetailModal`  | Ein Team als Blatt: Name, Bereich, Mitglieder mit Wischen zum Entfernen, Löschen mit Rückfrage – der Riegel sitzt in `delete_team()` |
| `FederationTeamSection` | Der Abschnitt «Verbands-Team» in «Team anlegen» und im Team-Blatt: laden, wählen, Zusatz, lösen – und der Hinweis, wenn kein Verband verbunden ist (UC-039) |
| `MonthBars`        | Der Saisonverlauf als Balken je Monat (Konzept §7.1) – Gegenstück zu `TrendChart`, Rechnung in `lib/points.ts` |
| `FederationImportModal` | Teams aus dem Verband übernehmen: die Liste mit Vorschlägen (verknüpft, zuordnen, anlegen) und Kontrollkästchen (UC-039 A1) |
| `AttendanceStatusIcon` | Der eigene Antwortstand als Ampel-Symbol am Zeilenanfang; ein Tippen schaltet um. Nachbau des `app-status-icon` der bestehenden myclub-App |
| `EventDetailModal` | Termin-Detail als Blatt: Eckdaten mit Symbol je Zeile, «Mein Status», die Listen Zugesagt / Abgesagt / Keine Antwort              |
| `NewsCard`         | Eine News als Karte: Bild, Datum, Titel, Anriss, Autoren-Chip, Teilen – im Raster der Startseite und im Detail                   |
| `NewsDetailModal`  | News-Detail als Blatt mit Volltext; Bearbeiten und Zurückziehen für Trainer:innen hinter dem Dreipunkt                          |
| `CheckInModal`     | QR-Scan über `html5-qrcode`                                                                                                       |
| `QrCode`           | QR-Code als Data-URL, ohne fremden Dienst (C-003)                                                                                 |

Dazu zwei Hooks, die zum UI gehören und nicht zum Datenzugriff:

| Hook                     | Zweck                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------- |
| `useToast()`             | Kurzrückmeldung oben – der einzige zulässige Weg zu einem Toast (§5)                    |
| `usePresentingElement()` | Das äussere Router-Outlet als Bezug jedes Blattes – die Karten-Darstellung von iOS (§2) |
| `useSheetProps()`        | Hält die Eigenschaften eines Blattes, das erst beim Öffnen entsteht, bis es zu Ende geschlossen hat (§2) |

Beides steht (Stand 10.9.2026): `Skeletons.tsx` trägt `SkeletonList`,
`SkeletonStats`, `SkeletonCard` und `SkeletonPage`, jede datengetriebene
Ansicht verwendet sie, und `LoadingState` steht nur noch dort, wo der Ausgang
einer Weiche wirklich offen ist – siehe §4. Jeder Toast läuft über
`useToast()`; einen direkten `IonToast` gibt es nicht mehr.

**Jede Ansicht beginnt mit `AppPage`.** Eine Seite, die `IonPage` direkt
verwendet, ist ein Fehler, ausser sie hat nachweislich keine Kopfzeile.

**Jede datengetriebene Ansicht behandelt drei Zustände**: lädt (Skelett, §4),
leer (`EmptyState`), Fehler (`ErrorState`). Ein leerer Bildschirm ohne
Erklärung ist kein Zustand.

**Auf einer Seite trägt jeder `EmptyState` ein `action`** (FR-144): der Knopf,
der dorthin führt, wo der nächste Schritt geschieht – das Formular öffnen, den
Filter zurücksetzen, zur Agenda. Steht direkt darüber schon ein Block-Knopf
für dieselbe Handlung, weicht er im leeren Zustand dem Angebot im
`EmptyState`, nicht umgekehrt. In einem **Blatt** (`components/`) ist ein
`EmptyState` ohne Angebot zulässig: Die Unteransicht hat als nächsten Schritt
nur das Schliessen. `emptyStateAction.test.ts` prüft `pages/`.

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
| Eine Weiche wartet, der Ausgang steht fest       | `SkeletonPage` als `pending` der Route         |
| Eine Weiche wartet, der Ausgang ist offen        | `LoadingState` (Spinner)                       |
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

`LoadingState` aus `StateViews` bleibt nur, wo der Ausgang einer Weiche
wirklich offen ist: `AuthCallbackPage` (die Sitzung entsteht gerade erst) und
die Weichen vor Anmeldung und Onboarding. In einer Ansicht mit bekanntem
Inhalt ist es ein Fehler.

**Wartet eine Weiche auf das Netz und steht ihr Ausgang fest, gilt dieselbe
Regel wie für jede Ansicht: ein Skelett.** Der Weg nach `/tabs/*` ist genau
dieser Fall – `RequireClub` wartet auf die Mitgliedschaften, und was danach
kommt, ist eine Seite mit Kopfzeile und Liste. Beide Weichen dieses Wegs
bekommen das Zwischenbild deshalb von der Route herein:

```tsx
<RequireAuth pending={<SkeletonPage />}>
  <RequireClub pending={<SkeletonPage />}>
    <TabsPage />
  </RequireClub>
</RequireAuth>
```

Es kommt von der Route und nicht aus dem Guard, weil nur die Route weiss,
wohin der Weg führt: Derselbe `RequireAuth` steht auch vor dem Onboarding, und
dort wäre ein Listen-Skelett eine falsche Ankündigung. Und **beide** Weichen
eines Wegs bekommen dasselbe Zwischenbild – zwei verschiedene hintereinander
sind ein Flackern.

Der Titel eines solchen Skeletts bleibt ein `IonSkeletonText`, kein
Platzhalterwort: Ein «myclub», das eine Zehntelsekunde später zu «Start» wird,
ist eine Ankündigung, die sich selbst widerruft. Weil ein Skelett keinen Text
hat, trägt es ein `role="status"` mit `aria-label={t('common.loading')}` –
sonst ist das Warten für Bedienhilfen stumm.

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
| Anliegen             | `voice_note`                   | nie «Sprachmemo» im Code         |
| Amt                  | `functionary_role`             | Verteiler; Factsheet und Vakanz-Anzeige sind Ausbaustufe 2 |
| Gremium              | `committee_role_ids`           | eine **Menge Ämter**, kein eigenes Objekt (BR-133) |
| Sitzung              | `event` mit `type = 'meeting'`  | kein eigenes Objekt              |
| Sitzungs-Input       | `meeting_input`                | nie «Antrag» oder «Traktandum» (BR-132) |
| Anwesenheits-Check-in | `check_in()`                  | UC-013, QR-Code – **nicht** UC-032       |
| Kontext-Check-in     | `checkin_prompt` / `checkin_response` | UC-032, Befinden; im Client `contextCheckin` |
| Befinden             | `checkin_responses.value_num`  | nie «Zufriedenheitsnote», nie «Score»    |

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

**Ionic beschriftet manches selbst – auf Englisch.** Diese Vorgaben stehen in
keiner Sprachdatei, `i18n:check` sieht sie deshalb nicht. Wer eine der folgenden
Komponenten setzt, übersetzt sie im selben Zug:

| Komponente      | Eigenschaft                           | Vorgabe von Ionic         |
| --------------- | ------------------------------------- | ------------------------- |
| `IonSelect`     | `cancelText`, `okText`                | «Cancel», «OK»            |
| `IonSearchbar`  | `cancelButtonText`                    | «Cancel»                  |
| `IonBackButton` | `text`                                | «Back»                    |
| `IonDatetime`   | `doneText`, `cancelText`, `clearText` | «Done», «Cancel», «Clear» |

Für die Auswahl heisst das an **jeder** Stelle:

```tsx
<IonSelect
  label={t('voice.kindLabel')}
  value={kind}
  cancelText={t('common.cancel')}
  okText={t('common.ok')}
  onIonChange={…}
>
```

`AppPage` erledigt es für den Zurück-Knopf ein für alle Mal;
`overlayLabels.test.ts` prüft den Rest an der Quelle, weil das Alert-Blatt eines
`IonSelect` in jsdom nicht aufgeht.

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
- **Geltungsbereich nach Team, lesend und schreibend** (C-032, `CLAUDE.md`):
  Trägt eine Tabelle einen `team_id`, liest und schreibt sie nur, wer in
  diesem Team ist – plus Trainer:innen, Sportchef:in ihres Bereichs und
  Vorstand. Vorlage `event_in_scope()` (`0057`); was an einer solchen Entität
  hängt, erbt den Geltungsbereich, statt ihn selbst zu formulieren. Ein
  `is_club_member(club_id)` allein ist in einer Policy ein Befund.
- **Jede neue `security definer`-Funktion** braucht im selben Schritt ein
  `revoke execute … from public, anon` (Vorlage `0007_function_grants.sql`).
- **Fehler sind sichtbar.** Jede fehlgeschlagene Aktion zeigt eine Rückmeldung
  – `ErrorState`, `toast.failure()` oder das Fehlerfeld von `FormModal`, je
  nach §5. Ein leerer `catch` ist ein Fehler.

---

**Der Inhalt eines Blattes gehört in eine eigene Komponente.** `IonModal`
rendert seinen Inhalt im Test nicht (docs/TESTING.md); ein Blatt, dessen Inhalt
direkt im Modal steht, ist damit ungeprüft. Vorbild: `DeleteAccountContent`
neben `DeleteAccountModal`.

**Die Entscheidung eines Formulars gehört in eine reine Funktion.**
Ionic-Eingaben lassen sich im Test nicht bedienen – in jsdom feuert kein
einziges `ionInput`/`ionChange` (docs/TESTING.md). Ein Ereignis-Handler, der
validiert und verzweigt, bleibt damit ungeprüft. Was geschehen soll, gehört
deshalb als reine Funktion nach `src/lib/`; die Seite ruft sie auf und stellt
das Ergebnis dar. Vorbild: `resolveSignInAction()` in `src/lib/authError.ts`.

## 10. Auslieferung: drei Wege, eine Codebasis

Dasselbe `dist/` geht drei Wege: in die iOS-App, in die Android-App und in den
Browser. Der Browser-Weg ist kein Abfallprodukt – auf dem Laptop des Vorstands
ist er der Hauptweg. Er ist deshalb als **PWA** eingerichtet
(`vite-plugin-pwa`, konfiguriert in `app/vite.config.ts`).

- **Der Service Worker läuft nur im Browser.** Die Registrierung steht in
  `src/main.tsx` hinter `Capacitor.isNativePlatform()`, das Plugin selbst auf
  `injectRegister: null`. In den nativen Apps liefert Capacitor dieselben
  Dateien lokal aus (`capacitor://localhost`, `https://localhost`); ein Service
  Worker davor hielte dort eine zweite Kopie mit eigenem
  Aktualisierungsrhythmus vor – die Fassung im Gerät käme dann nicht mehr aus
  dem Store. Unter WKWebView registriert er sich ohnehin nicht.
- **Nur eigene Bausteine kommen in den Vorrat.** `globPatterns` erfasst das
  Build-Ergebnis. Antworten von Supabase bleiben ungecacht: Ein Punktestand aus
  dem Vorrat wäre falsch, ein zwischengespeichertes Token ein
  Sicherheitsproblem. Wer Laufzeit-Caching braucht, begründet es im
  Umsetzungsplan.
- **`registerType: 'autoUpdate'`.** Eine neue Fassung ersetzt die alte beim
  nächsten Start. Es gibt keine Aktualisierungsfrage im UI – die wäre eine
  Entscheidung, die niemand treffen will.
- **Das Manifest trägt die Grundfarbe, nicht die Vereinsfarbe.** `theme_color`
  und `background_color` stehen statisch im Build; die Vereinsfarben kommen
  erst zur Laufzeit aus `clubs.settings.theme` (C-013). Wer die Grundfarbe in
  `theme/variables.css` ändert, zieht sie im Manifest und in `index.html`
  (`<meta name="theme-color">`) nach.
- **Die Symbole liegen als Quelle im Repository.** `public/favicon.svg` (mit
  abgerundeten Ecken) und `public/icon-square.svg` (randfüllend) sind die
  Vorlagen; daraus entstehen `pwa-*.png`, `maskable-icon-512x512.png` und
  `apple-touch-icon-180x180.png`. Ein neues Symbol wird aus der Vorlage
  gerendert, nicht von Hand nachgezeichnet. Das randfüllende Quadrat ist
  Pflicht für `purpose: 'maskable'`: Android beschneidet das Symbol auf einen
  Kreis, abgerundete Ecken ergäben dort einen sichtbaren Rand.

---

## 11. Ausdrücklich verboten

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
8. **Eine eigene Breitenabfrage** – `window.innerWidth`, ein `@media`-Umbruch
   oder ein zweites Layout – für den Wechsel zwischen Telefon und Laptop. Den
   Wechsel besorgt `IonSplitPane` (§2).
9. **Einen Service Worker ohne Plattformprüfung registrieren.** Er gehört in
   den Browser, nicht in die nativen Apps (§10).
10. **Ein `IonModal` ohne `presentingElement`.** Ein Blatt im Vollbild ist
    nicht die iOS-Darstellung; das Element kommt aus `usePresentingElement()`
    (§2).
11. **Ein `IonSelect` ohne `cancelText`/`okText`.** Das Auswahl-Blatt zeigt
    sonst «Cancel» und «OK» – in allen vier Sprachen (§8).
12. **Ein `color` an einem Knopf in `IonAlert`/`IonActionSheet`.** Die Farbe
    kommt aus der Rolle (§2).
13. **Ein Erstellen-Symbol in der Kopfzeile** – Plus, Stift oder was sonst
    etwas anlegt. Das gehört in `AppPage createActions=…` (§2).
14. **Ein `IonFab` ausserhalb von `CreateFab`.** Sonst steht derselbe Knopf
    zweimal verschieden da (§2).
15. **Ein zweiter Schliessen-Knopf am Ende eines Blattes.** Schliessen steht
    einmal in der Kopfzeile; unten steht nur ein Knopf, der etwas tut (§2).
16. **Ein `FormModal` mit `submitLabel={t('common.close')}`.** Ein Blatt, das
    nur anzeigt, lässt `onSubmit` weg; sonst stehen Abbrechen und Schliessen
    nebeneinander (§2).
17. **Ein Blatt-Inhalt, der mit dem Schliessen aus dem Baum fällt** – ein
    `<FormModal isOpen>` mit nacktem `isOpen`, ein `{open && <Form …/>}` in
    einer Seite. Die Hülle geht über `useSheetProps()`, sonst bleibt die Seite
    in der Karten-Stellung stehen (§2).

---

## 12. Struktur

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

## 13. Prüfung vor dem Abschluss

`npm run verify` (Typen, Lint, i18n-Parität, Tests) muss durchlaufen. Zusätzlich
je Use Case:

1. **Code-Review** (`/ai-code-review`) gegen diese Regeln.
2. **Manueller Testplan** unter `docs/test-plans/` (`/ai-manual-test`).
3. **Vitest-Tests** für die Logik und die neuen Komponenten (`/ai-vitest`).
4. **Statusabgleich**: FR-Status in `docs/requirements.md` und `Status` im
   Use-Case-Dokument nachziehen – im selben Schritt wie die Umsetzung.
5. **Von welcher Seite kommt eine Person dorthin?** Für jeden neuen Hook,
   jede neue Funktion und jedes neue Blatt den Einstieg benennen. Dreimal in
   einer Woche war etwas gebaut und von keiner Ansicht aus erreichbar –
   Termin absagen, Gerät für Push anmelden, Helfereinsätze im Marktplatz –,
   und der Katalog führte es trotzdem als `Implemented`. Ein Hook ohne
   Aufrufer ist kein Fortschritt, sondern ein Befund.
