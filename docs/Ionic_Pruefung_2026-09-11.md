# Ionic-Prüfung myclub nexus

Stand 2026-09-11, Branch `main` ab `aacd87d`. Ionic 9.0.2, Capacitor 8.5, React 19.2, React Router 6.30, `setupIonicReact({ mode: 'ios' })`.

Geprüft wurde die App gegen die Komponenten-Richtlinien von Ionic (ion-item, ion-list, Formularelemente, Overlays) und gegen alle Kapitel der Ionic-React-Dokumentation. Fokus iOS und Mobile. Grundlage: die Doku-Seiten unter ionicframework.com, Context7 (`/ionic-team/ionic-docs`) und der installierte `@ionic/core`-Quellcode. Umfang: 31 Seiten, 45 Komponenten, 317 `IonItem`, 136 Formularelemente, 10 Modal-Hüllen.

**Bilanz:** 4 hoch, 13 mittel, 18 niedrig, 14 Kapitel eingehalten.

**Gesamtbild.** Das Gerüst ist sauber nach Doku gebaut: Seitenaufbau mit grossem Titel, Tabs, Menü, Modals mit `presentingElement` und `canDismiss`, moderne Label-Syntax bei allen 136 Formularelementen. Die Abweichungen liegen in vier Feldern: fehlende Ionic-Lifecycle-Hooks, verschachtelte Interaktive in Listenzeilen, Barrierefreiheit von Icons und Overlays, und das Item als Allzweck-Container statt als Listenzeile.

---

## Befunde nach Schwere

### Hoch

#### 1. Tab-Seiten werden beim erneuten Betreten nie aufgefrischt

- **Regel** (Lifecycle-Kapitel): Ionic hält Seiten im Outlet gemountet, `useEffect` feuert beim zweiten Besuch nicht. Daten lädt man in `useIonViewWillEnter`.
- **Befund:** Kein einziger `useIonView*`-Hook im Code. react-query: `refetchOnWindowFocus: false` (`src/main.tsx:16`), `refetchOnMount` greift nur bei neuem Observer. Die fünf Tab-Seiten bleiben gemountet, ihre Queries bekommen nach dem ersten Besuch keinen Auslöser mehr. Rangliste hält 5 Minuten (`useGamification.ts:82`). Die Agenda berechnet `now` beim Rendern, führt es aber nicht im Query-Key (`src/hooks/useAgenda.ts:20,24`): Ein Termin, der während der Sitzung vergeht, bleibt unter «kommend».
- **Fix:** Hook `useRefreshOnEnter(queryKeys)`: in `useIonViewWillEnter` ein `invalidateQueries({ refetchType: 'active' })`. In Dashboard, Agenda, Marktplatz, Rangliste, Profil aufrufen (in der gerouteten Komponente, nicht in `AppPage`). `staleTime` bleibt. In `useAgenda` `now` auf Minuten runden und in den Key nehmen.

#### 2. Verschachtelte Interaktive in Listenzeilen und Karten

- **Regel** (ion-item Guidelines): «Items should never render nested interactives. Screen readers are unable to select the correct interactive element.» Max. zwei direkte Aktionen je Zeile.
- **Befund:** `src/pages/AgendaPage.tsx:311-494`: Das Item ist nicht `button`, trägt aber `detail`; das Öffnen hängt an `IonLabel onClick` (333) und `IonBadge onClick` (490), beides nicht fokussierbar. Im Label stehen bis zu vier `IonButton` (Status, Erinnern, Check-in, QR, Ausschreiben) samt `IonButtons`-Container, jeder mit `stopBubbling`. Dazu bis zu fünf Wischoptionen. `src/pages/MarketplacePage.tsx:153-237`: Entwurfszeile `button` und darin ein «Ausschreiben»-`IonButton` (225). `src/components/NewsCard.tsx:52-93`: `IonCard button` mit innerem Teilen-`IonButton`, rendert Button im Button.
- **Fix:** Agenda: Item selbst `button detail onClick`, Label-/Badge-Clicks entfernen, im Start-Slot nur den Status-Knopf behalten, alle anderen Aktionen ins `EventDetailModal` oder in ein Action-Sheet. Marktplatz: Zeile entweder klickbar oder mit Knopf, nicht beides. NewsCard: Karte nicht `button`, Bild-und-Titel-Bereich als eigener Knopf, Teilen ins Detail-Blatt.

#### 3. Icons ohne `aria-hidden`, eine Wischaktion ohne Namen

- **Regel** (ion-icon Accessibility): Dekorative Icons brauchen `aria-hidden="true"`; Icons in beschrifteten Knöpfen ebenfalls. Interaktive Elemente brauchen einen zugänglichen Namen.
- **Befund:** Nur 5 von 36 `IonIcon` tragen `aria-hidden`. Dekorativ ohne Attribut: `EventDetailModal.tsx:111-153,194,216,245`, `AgendaPage.tsx:336-354`, `NewsCard.tsx:84`, Tab-Icons `TabsPage.tsx:99-115`. In beschrifteten Knöpfen: `AttendanceStatusIcon.tsx:140`, `CreateFab.tsx:53,64`, `NewsCard.tsx:92`, `NewsDetailModal.tsx:86`, `AgendaPage.tsx:552,565`. **Ohne jeden Namen:** `src/components/TeamDetailModal.tsx:141-158`, die destruktive `IonItemOption` «aus Team entfernen» ist nur ein Icon.
- **Fix:** `aria-hidden="true"` an alle genannten Icons. `aria-label={t('teams.removeMember')}` an die Option, Schlüssel in alle vier Sprachdateien, `npm run i18n:check`.

#### 4. Sieben Aktionen gibt es nur als Wischgeste

- **Regel:** Item-Sliding ist ein Mittel für Zusatzaktionen, kein alleiniger Weg: Wischoptionen sind weder per Tastatur noch per VoiceOver-Rotor erreichbar.
- **Befund:** Termin bearbeiten und Einsätze bestätigen (`AgendaPage.tsx:513-534`), Antwort teilen (`MoodPage.tsx:158`), Beispiel übernehmen (`ClubSettingsPage.tsx:364`), Mitglied aus Team entfernen (`TeamDetailModal.tsx:140`), Amt auflösen (`OfficePage.tsx:118`), Einladung widerrufen (`InvitePage.tsx:186`), Schicht entfernen (`HelperEventModal.tsx:189`). Zu-/Absage per Wischen hat dagegen den Status-Knopf als Alternative.
- **Fix:** Je Aktion einen zweiten Weg: Knopf im jeweiligen Detail- oder Bearbeiten-Blatt, oder ein «…»-Knopf im End-Slot mit `IonActionSheet` (dann Item nicht `button`).

### Mittel

#### 5. Navigation quer über Tabs

- **Regel** (Navigation-Kapitel, wörtlich): «there should never be a button in Tab 1 that routes a user to Tab 2 … tabs should only be changed by the user tapping a tab button». Für tab-übergreifenden Inhalt empfiehlt Ionic ein Modal.
- **Befund:** `src/pages/DashboardPage.tsx:69-73,179,213,236,240,266` springen in Agenda, Marktplatz und Profil-Unterseiten; der leere Zustand der Agenda verweist auf den Marktplatz. Folge: Vorwärts-Slide in einen fremden Tab, Android-Zurück wandert danach über Tabs hinweg.
- **Fix:** «Nächste Termine» direkt im vorhandenen `EventDetailModal` öffnen. Verbleibende Sprünge bewusst behalten und mit `useIonRouter().push(path, 'root')` ohne Fremd-History ausführen.

#### 6. Vereins-Theme ignoriert den Dunkelmodus

- **Regel** (Dark-Mode-Kapitel): Farbrollen für beide Paletten definieren; Inline-Werte auf `html` schlagen jede Media-Query.
- **Befund:** `src/lib/theme.ts:83-91,174-186` setzt `--ion-color-primary` inline auf `documentElement`. Damit ist der Hell/Dunkel-Tausch aus `variables.css:78-121` für jeden Verein mit eigenem Theme ausser Kraft. `luminance()` (79, 140) prüft nur Schwarz oder Weiss als Schrift, nie den Kontrast gegen dunklen Grund. Ein dunkles Vereinsblau ist auf `#121212` unsichtbar (Knöpfe, Avatare, Netzdiagramm).
- **Fix:** In `applyClubTheme` `matchMedia('(prefers-color-scheme: dark)')` auswerten, die Farbe bei Dunkel bis zu einem Mindestkontrast gegen `#121212` aufhellen (Muster `suggestContrast`), `change`-Listener registrieren. Optional `theme.dark.primary` im Schema.

#### 7. Datumsblatt im Formular: Karten-Übergang auf ein Blatt mit `fit-content`

- **Regel** (ion-datetime-button): `IonModal keepContentsMounted` ohne `presentingElement`. ion-modal: Bei gestapelten Blättern ist `presentingElement` das darunterliegende `ion-modal`, nicht das Outlet.
- **Befund:** `src/components/DateField.tsx:52` gibt dem Datumsblatt das Router-Outlet als `presentingElement`, auch wenn es aus `EventFormModal`, `TaskFormModal` oder `HelperEventModal` heraus geöffnet wird. Ionic hängt an dieses Blatt `.ion-datetime-button-overlay` mit `--width: fit-content; --height: fit-content` (verifiziert in `@ionic/core/css/core.css`). Beim Schliessen des Datumsblatts wird das Outlet auf Scale 1 zurückgestellt, obwohl das Formular noch offen ist.
- **Fix:** `presentingElement` in `DateField` weglassen. Auf dem iPhone gegenprüfen.

#### 8. Modals und Action-Sheets ohne zugänglichen Namen

- **Regel** (ion-modal): «developers must properly label their modals» via `aria-labelledby` auf den Titel. ion-action-sheet: `header` wird dringend empfohlen, sonst `htmlAttributes` mit `aria-label`.
- **Befund:** Kein `aria-labelledby` im Code. Betroffen alle 10 Modal-Hüllen (`FormModal.tsx:109`, `EventDetailModal`, `EventQrModal`, `CheckInModal`, `NewsDetailModal`, `DeleteAccountModal`, `ShiftRosterModal`, `ShiftListModal`, `DateField`, `InvitePage`). Action-Sheets ohne `header`: `FormModal.tsx:150`, `NewsDetailModal.tsx:100`.
- **Fix:** Zentral in `FormModal`: `const id = useId()`, `<IonModal aria-labelledby={id}>`, `<IonTitle id={id}>`; die übrigen Hüllen gleich. `header` an beide Action-Sheets.

#### 9. Android: Hardware-Zurück tut auf dem Dashboard nichts

- **Regel** (Hardware-Back-Button-Kapitel): an der Wurzel `if (!ionRouter.canGoBack()) App.exitApp()`.
- **Befund:** Kette Overlays → Menü → Navigation funktioniert (in `@ionic/react` und `@capacitor/android` nachgelesen), der Discard-Wächter deckt die Rolle `backdrop` ab. Aber: `useIonRouter` wird nirgends verwendet, kein Exit-Handler. Ionics Prio-0-Handler ruft an der Wurzel nur `nativeGoBack()`, die App lässt sich per Taste nicht verlassen.
- **Fix:** In `App.tsx` innerhalb `IonReactRouter` ein `ionBackButton`-Handler mit Priorität −1, der bei `!canGoBack()` `App.exitApp()` ruft, nur wenn `Capacitor.isNativePlatform()`.

#### 10. `IonImg` ist deprecated

- **Regel** (ion-img): deprecated, wird in Ionic 10 entfernt. «Use a native `<img>` tag with `loading="lazy"` instead.» Im installierten `img.d.ts` als `@deprecated` markiert.
- **Befund:** `src/components/NewsCard.tsx:57`, Selektor `variables.css:429`.
- **Fix:** `<img src alt={entry.title} loading="lazy">`, Selektor auf `.app-news-card > img`.

#### 11. Login-Felder: `fill="outline"` wirkt im iOS-Modus nicht

- **Regel** (ion-input Filled Inputs): «Filled inputs can be used on iOS by setting the input's `mode` to `md`.» Das Stylesheet `input.ios.css` enthält keine `fill`-Regeln.
- **Befund:** `src/pages/auth/LoginPage.tsx:131,143`: `fill="outline"` ohne `mode="md"`. Die Felder erscheinen als blosse Linien.
- **Fix:** `mode="md"` auf beide Inputs, oder `fill` streichen und die Felder in ein `IonItem` legen.

#### 12. Item als Container, mehr als zwei Controls, Fremdkinder in Listen

- **Regel** (ion-item): «designed to be a row in a List and should not be used as a general purpose container»; «maximum two form controls per item».
- **Befund:** Vier `IonInput` je Zeile (`ClubSettingsPage.tsx:281-301`, auf 390 px nicht bedienbar). `IonSegment` im Item (`CheckinPromptModal.tsx:160`, `ContributionProfileModal.tsx:123`, `NoteAnswerModal.tsx:185`). Diagramm im Label (`MoodPage.tsx:105`), QR-Code im Item (`EventQrModal.tsx:65`), `IonFabButton` im Item (`EventDetailModal.tsx:163`), Items nur mit Knöpfen (`ClubSettingsPage.tsx:382`, `TaskConfirmModal.tsx:167,222`, `VoicePage.tsx:302`). In `IonList`: `EmptyState`, Kennzahl-Kacheln, Aktionsblöcke (Dashboard, PointHistory, Marketplace, Transparency, Health, PulseRead, Federation, Notifications). Liste in Liste (`DeleteAccountModal.tsx:80`).
- **Fix:** Je Sprache ein Item; Segmente als `subToolbar` (Muster `ShiftRosterModal`); Diagramm und QR in `IonCard`; Knöpfe in `div.app-actions`; `ListSection` nur mit Items füllen.

#### 13. Fliesstext inline in Items

- **Regel** (ion-item Content Types): «Keep text labels concise … Move lengthy clarifications to Notes positioned below the list … Don't attempt to fit extensive text inline within items.»
- **Befund:** Rund 25 Stellen mit `IonItem lines="none"` + `<p>` als Textfeld: Transkripte und Antworten (`NoteAnswerModal.tsx:151,175`, `VoicePage.tsx:169-269`), Beschreibungen (`TaskDetailModal.tsx:118-136`, `MarketplacePage.tsx:358`), Definitionen (`HealthPage.tsx:314`, `TransparencyPage.tsx:62-84`), Erklärungen (`DeleteAccountModal.tsx:58`, `NotificationsPage.tsx:93,205`). `ListSection.footnote` ist bereits das richtige Muster für kurze Hinweise.
- **Fix:** Baustein `TextSection` (Listenkopf + Textblock). In Listen auf drei Zeilen kürzen, Volltext im Detail, wie `NewsCard` es mit `app-news-card__lead` vormacht.

#### 14. Zu viele Metadaten je Zeile, Badges im Fliesstext

- **Regel** (ion-item Metadata): «Include only the most relevant … Limit metadata quantity.» Badges gehören in `slot="end"`.
- **Befund:** Agenda-Zeile (`AgendaPage.tsx:333-493`): Titel, drei `h3` mit Icons, Absage-Note, zwei Badges, zwei Notes, Knöpfe, Badge rechts. Marktplatz (`MarketplacePage.tsx:169-247`) und Mitglieder (`MemberPage.tsx:246-269`) ähnlich. Sechs Badges in `<p>`; gemischte End-Metadaten in einer Liste (`PointRulePage.tsx:190-203`).
- **Fix:** Pro Zeile ein Sekundärtext und ein Status-Element im End-Slot. Beispiel-Markierung als Note-Präfix, Dringlichkeit als `color` des End-Badges, Rest ins Detail.

#### 15. Icon- und Avatar-Position springt innerhalb einer Liste

- **Regel** (ion-item Guidelines): «icons should be positioned in the same way between items».
- **Befund:** `AgendaPage.tsx:318-331`: Entwürfe ohne Start-Slot, veröffentlichte Termine mit. `LeaderboardPage.tsx:171-182`: Avatar nur bei vorhandenem Bild; `MemberAvatar` mit Initialen-Fallback existiert und wird anderswo verwendet.
- **Fix:** Platzhalter-Icon für Entwürfe; `MemberAvatar` in der Rangliste.

#### 16. `labelPlacement` der Selects im selben Formular gemischt

- **Regel:** Label-Platzierung innerhalb eines Formulars konsistent halten.
- **Befund:** 25 `IonSelect` mit `stacked`, 23 ohne Angabe (= `start`). Gemischt im selben Blatt: `EventEditModal.tsx:143/164`, `EventFormModal.tsx:165-307`, `MemberPage.tsx:325-355`, `PointRulePage.tsx:222-337`, `InvitePage.tsx:231-291`. Inputs und Textareas sind dagegen zu 100 % `stacked`.
- **Fix:** In Formularblättern durchgehend `stacked`; Filterzeilen dürfen `start` bleiben, dann aber überall.

#### 17. Zwei Bedienfehler auf dem Gerät

- **Regel:** ion-input: `inputmode` steuert die Tastatur. ion-segment: `scrollable` bei variabler Anzahl.
- **Befund:** `NoteAnswerModal.tsx:286`: Punktwert mit `type="number"` ohne `inputmode="numeric"`, iOS zeigt die Volltastatur (12 von 13 anderen Zahlenfeldern machen es richtig). `PointHistoryPage.tsx:49-67`: ein Segment-Knopf pro Saison ohne `scrollable`, ab vier Saisons abgeschnitten.
- **Fix:** `inputmode="numeric" min={0}`; `scrollable` oder Saison als `IonSelect`.

### Niedrig

#### 18. Tastatur-Feinheiten

`enterkeyhint` nirgends gesetzt (Login: `go`; Blätter: `next`/`done`). Suchfeld `MemberPage.tsx:147` ohne `inputmode="search"`. Codes und Slugs (`OnboardingPage.tsx:264,342`, `PointRulePage.tsx:323`) ohne `autocorrect={false}`. API-Schlüssel `FederationPage.tsx:211` ohne `autocomplete="off"`. `capacitor.config.ts:24`: `Keyboard.resize: 'body'`, Capacitor-Doku sieht für Ionic `'ionic'` vor.

#### 19. Farben von Splash, Manifest und `theme-color`

`#1d4ed8` in `index.html:14`, `vite.config.ts:34,38`, `capacitor.config.ts:21`; die Primärfarbe der App ist `#339bde`. Farbsprung beim Start. `theme-color` ohne `media="(prefers-color-scheme: dark)"`-Variante.

#### 20. Speicherung: Offline-Warteschlange in `localStorage`

Sitzung und aktiver Verein liegen korrekt in Capacitor Preferences. Die Check-in-Warteschlange (`useCheckIn.ts:20,29`) und die gemerkte Einladung (`invite.ts:63`) in `localStorage`, das WKWebView unter Speicherdruck räumen kann. Gerade die Warteschlange muss ein Funkloch überleben.

#### 21. Lange Listen ohne Nachladen

Punktehistorie rendert bis 500 Items (`useGamification.ts:257`), Mitglieder unbegrenzt (`useMembers.ts:31`). Kein Virtuoso, kein `IonInfiniteScroll`. Für Vereinsgrössen vertretbar; die Historie ist der erste Kandidat für `range()`-Paging.

#### 22. Kopfzeilen und Titel

`AppMenu.tsx:55,72`: `translucent` ohne `fullscreen`, Effekt greift nicht. Kein `IonTitle role="heading" aria-level` (`AppPage.tsx:100`, Blatt-Hüllen). «Schliessen» mal links (`FormModal`, `EventDetailModal`, `NewsDetailModal`), mal rechts (`EventQrModal`, `CheckInModal`, `ShiftRosterModal`, `ShiftListModal`, Share-Blatt): gegen die eigene Richtlinie in `docs/guidelines.md`, nicht gegen Ionic.

#### 23. Overlay-Rollen und Texte

Keine `destructive`-Rolle bei «Termin absagen» (`EventEditModal.tsx:225`) und «Verbindung trennen» (`FederationPage.tsx:272`). Alert nur mit `header`, ohne `message` (`ShiftRosterModal.tsx:216`). Toasts unterscheiden Erfolg und Fehler nur über Farbe, Doku empfiehlt `icon`.

#### 24. Listen-Semantik

Drei bis vier `h3` je Agenda-Zeile als Metadaten (`AgendaPage.tsx:335-360`), jede Zeile erzeugt mehrere Überschriften-Stopps. 13 Items mit `IonNote` als einzigem Inhalt (z. B. `LeaderboardPage.tsx:167`, `MemberPage.tsx:374`). Item ausserhalb jeder Liste (`MeetingInputModal.tsx:173`). Externer Link mit Chevron (`InvoicePage.tsx:63-72`), besser `openOutline` und `detail={false}`. Pseudo-Spaltenkopf als Item (`AgendaPage.tsx:241`).

#### 25. Sonstiges

Login ohne Header: fixer `padding-top: 48px` (`variables.css:249`) statt `--ion-safe-area-top`. `IonRow`/`IonCol` ohne `IonGrid` (`NewsCard.tsx:76`). `UIDesignRequiresCompatibility` für iPadOS 26 fehlt in `Info.plist`. Optional: `IonTabBar translucent`, `fixedSlotPlacement="before"` für den Fab, Spinner ohne `name` für das native iOS-Bild. Ausserhalb des Ionic-Rahmens: `@capacitor/push-notifications` ist installiert, wird aber nie importiert; auf iOS gibt es damit keine Push-Anmeldung.

---

## Kapitel der Ionic-React-Dokumentation

| Kapitel | Status | Kurzbefund |
|---|---|---|
| Overview, Quickstart, Add to Existing | eingehalten | CSS-Imports, `setupIonicReact` auf Modulebene, `IonApp → IonReactRouter → IonRouterOutlet`, nur Routen im Outlet, React Router 6. |
| Your First App | eingehalten | Kamera-Tutorial nicht relevant; Header/Content/Fab-Struktur nach Muster. |
| Lifecycle | **Abweichung (hoch)** | Befund 1. Kamera, Timer und Listener sind dagegen korrekt an Modal bzw. Tab-Hülle gebunden. |
| Navigation | **Abweichung (mittel)** | Befund 5. Tabs, Unterseiten mit Präfix, `IonBackButton defaultHref`, verschachteltes Outlet ohne `ionPage` («IonTabs renders an IonPage for you»): alles regelkonform. |
| Virtual Scroll | Hinweis | Befund 21. |
| Utility Functions | eingehalten | `useIonRouter` nur für Befund 9 nötig; Login/Logout über `Navigate replace` in den Guards. |
| Platform | eingehalten | Erzwungener iOS-Modus ist durch die Doku gedeckt; Android-Nebenwirkungen geprüft (Edge-to-Edge, DayNight-Theme). |
| PWA | eingehalten | Vite-PWA mit Manifest und Maskable-Icon; Service Worker bewusst nur im Browser. Farbabweichung Befund 19. |
| Overlays | eingehalten | Inline mit `isOpen` + `onDidDismiss`, `presentingElement`, `canDismiss` mit Rollen, `useSheetProps`. Barrierefreiheit Befund 8. |
| Storage | Hinweis | Befund 20. |
| Testing | eingehalten | Vitest + RTL + jsdom, `setupIonicReact` und Browser-API-Mocks im Setup nach Doku. |
| Performance | eingehalten | Alle JSX-Schleifen mit `key`. Hinweis: kein `React.lazy` für die ~30 Seiten (relevant für die Precache-Grenze). |
| Hardware Back Button | **Abweichung (mittel)** | Befund 9. |
| Keyboard | Hinweis | Felder liegen in `IonContent`, Scroll-Assist wirkt. Befund 18. |
| Dark Mode | **Abweichung (mittel)** | `dark.system.css` und `:root`-Overrides korrekt. Laufzeit-Theme Befund 6. |
| Platform Styles, Layout/Structure | eingehalten | SplitPane mit `contentId`, `viewport-fit=cover`. |
| Capacitor iOS-Konfiguration, Status Bar | eingehalten | Kamera-Berechtigung, URL-Schema in beiden Manifesten identisch, `UIViewControllerBasedStatusBarAppearance`, StatusBar im System-Standard. `UIDesignRequiresCompatibility` fehlt (Befund 25). |

---

## Was eingehalten ist und so bleiben soll

- Seitengerüst `AppPage`: translucenter Header, `collapse="condense"`, `fullscreen`, Refresher mit `complete()`, Fab als `slot="fixed"`-Kind mit Freiraum unten.
- Tabs: fünf Tabs, `href` stimmt mit den Routen überein, verschachteltes Outlet ohne `ionPage`, durch `TabsPage.test.tsx` abgesichert.
- Menü und SplitPane: `contentId`, `when="lg"`, `IonMenuToggle autoHide={false}`, Menüknopf blendet sich selbst aus.
- Modals: `isOpen`/`onDidDismiss`-Kopplung überall, `usePresentingElement` vor dem ersten Präsentieren, `useDiscardGuard` mit Rollen `gesture`/`backdrop`/`cancel`, Rückfrage-Sheet neben statt im Blatt, `useSheetProps` gegen den abgebrochenen Übergang.
- Alerts: `header` und `message` übersetzt, genau eine `cancel`-Rolle, testgesichert durch `overlayRoles.test.ts`. Action-Sheets mit Cancel und `destructive` zuerst.
- Toasts: Dauer statt Interaktion, Position oben mit Begründung, Standard-`role="status"`.
- Formularelemente: 136 von 136 mit moderner Label-Syntax, keine Legacy-`IonLabel position`, `onIonInput` bei allen Textfeldern, `cancelText`/`okText` bei allen 48 Selects übersetzt, Toggles und Checkboxen nur in nicht-klickbaren Items, Radios in Gruppen.
- `DateField`: `IonDatetimeButton` + `keepContentsMounted`, `locale` aus i18n, Montag als Wochenstart, übersetzte Knöpfe, `presentation` je Feld.
- Fab: `aria-label` auf jedem Knopf, `IonFabList side="top"`. Toolbar-Knöpfe ausschliesslich in `IonButtons`, Primäraktion `strong`.
- Listen: `IonListHeader` + `IonList inset` als iOS-Gruppenmuster, `IonNote className="app-footnote"` unter der Liste entspricht exakt der Doku, `lines` sinnvoll, `detail` überall explizit.
- Skeletons in `IonItem`/`IonLabel` mit Breiten als Inline-Style, wie in der Doku, mit `role="status"`. Accordion mit `IonItem slot="header"`.
- Deep Links: Schema identisch in `Info.plist` und `AndroidManifest.xml`, `appUrlOpen`-Listener wird sauber entfernt.

---

## Umsetzung am 2026-09-12

Alle 25 Befunde sind bearbeitet; `npm run typecheck`, `npm run lint`, `npm run i18n:check` und die Testsuite (870 Tests) sind grün. Neue Bausteine: `useRefreshOnEnter` (Lifecycle), `TextSection` (Fliesstext neben Listen), `HardwareBackExit` (Android-Zurück an der Wurzel), `adaptForDark` in `lib/theme.ts`.

| Befund | Stand | Bemerkung |
|---|---|---|
| 1 Lifecycle | erledigt | `useRefreshOnEnter` in Dashboard, Agenda, Marktplatz, Rangliste, Profil; `now` minutengenau im Agenda-Key mit `keepPreviousData`. |
| 2 Verschachtelte Interaktive | erledigt, eine bewusste Ausnahme | Agenda-Zeile ist selbst der Knopf; die Ampel am Zeilenanfang ist nur noch Anzeige, umgeschaltet wird per Wischen und im Detail. Marktplatz-Entwurf: Ausschreiben als Wischoption und im Formular. **NewsCard:** Der Teilen-Fab in der Karte bleibt auf ausdrücklichen Wunsch (Muster der alten App, guidelines §2 Regel 14). |
| 3 Icons | erledigt | `aria-hidden` an allen dekorativen Icons; `aria-label` an der Team-Option. |
| 4 Wischaktionen | erledigt | Alle sieben haben einen zweiten Weg (Knopf in Zeile oder Blatt). |
| 5 Cross-Tab | erledigt | Dashboard öffnet Termin- und Aufgaben-Detail direkt; verbleibende Sprünge über `useIonRouter().push(…, 'root')` bzw. `routerDirection="root"`. |
| 6 Dunkelmodus | erledigt | `applyClubTheme` hellt Vereinsfarben gegen `#222428` auf (`adaptForDark`, 3:1) und reagiert auf den Palettenwechsel. |
| 7 DateField | erledigt | Ohne `presentingElement`; Ausnahme in guidelines §2 und `usePresentingElement.test.tsx` festgehalten. |
| 8 Modal-Beschriftung | erledigt | `aria-labelledby` auf allen Hüllen, `header` an beiden Action-Sheets. |
| 9 Hardware-Zurück | erledigt | `HardwareBackExit` in `App.tsx`. |
| 10 IonImg | erledigt | natives `img loading="lazy"`. |
| 11 Login `fill` | erledigt | `mode="md"` an beiden Feldern. |
| 12 Container | erledigt | Sprachfelder je Item, Segmente ausserhalb der Liste, Diagramme in Karten, Knöpfe in `app-actions`, keine Fremdkinder in `ListSection`. |
| 13 Fliesstext | erledigt | `TextSection`; Listenzeilen mit `.app-clamp-3`. |
| 14 Metadaten | erledigt | Ein Sekundärtext, ein End-Element je Zeile. |
| 15 Icon-Position | erledigt | Platzhalter für Entwürfe, `MemberAvatar` in der Rangliste. |
| 16 Selects | erledigt | Formularblätter `stacked`, Filterzeilen einheitlich `start`. |
| 17 Tastatur/Segment | erledigt | `inputmode="numeric"`, `scrollable`. |
| 18 Tastatur-Feinheiten | erledigt | `enterkeyhint` überall, `inputmode="search"`, `autocorrect`, `autocomplete="off"`, `Keyboard.resize: 'ionic'`. |
| 19 Farben | erledigt | `#339bde` in Manifest, Splash, `theme-color` mit Hell/Dunkel-Variante. |
| 20 Speicherung | teilweise | Check-in-Warteschlange in Capacitor Preferences. Die gemerkte Einladung bleibt in `localStorage`: Sie wird synchron in den Routen-Weichen gelesen, und ihr Verlust kostet nur den Rücksprung. |
| 21 Lange Listen | erledigt | Punktehistorie mit `useInfiniteQuery` à 50 und `IonInfiniteScroll`. Mitgliederliste bleibt vollständig (Suchfeld filtert clientseitig). |
| 22 Kopfzeilen | erledigt | `translucent` im Menü entfernt, `role="heading"` an Titeln, Schliessen überall links. |
| 23 Overlay-Rollen | erledigt | `destructive` ergänzt, Alert-`message`, Toast-Icons. |
| 24 Listen-Semantik | erledigt | Keine `h3` als Metadaten, keine Note-only-Items, externer Link mit `openOutline`. |
| 25 Sonstiges | erledigt bis auf Push | Safe-Area im Login, Skeleton-Karte ohne `IonRow`, `UIDesignRequiresCompatibility`, `IonTabBar translucent`, `fixedSlotPlacement="before"`. Die ungenutzte Push-Anmeldung auf iOS ist ein eigener Use Case, kein Ionic-Befund. |
