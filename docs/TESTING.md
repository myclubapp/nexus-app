# Testkonzept: myclub nexus

Drei Ebenen, jede mit einer eigenen Frage. Was auf einer tieferen Ebene
beantwortet werden kann, gehört nicht auf eine höhere.

| Ebene                   | Frage                                                  | Werkzeug            | Wo                       |
| ----------------------- | ------------------------------------------------------ | ------------------- | ------------------------ |
| Unit / Komponente       | Rechnet und rendert der Code richtig?                  | Vitest + Testing Library | `src/**/*.test.ts(x)` |
| Manueller Test          | Funktioniert der Ablauf auf einem echten Gerät?        | Testplan + Person   | `docs/test-plans/`     |
| Datenbank               | Hält der Server die Regeln ein, die er halten muss?    | SQL gegen `supabase start` | `supabase/tests/`   |

---

## 1. Vitest

```bash
npm run test            # einmalig
npm run test:watch      # während der Arbeit
npm run test:coverage   # Abdeckung
npm run verify          # Typen + Lint + i18n-Parität + Tests
```

**Aufbau:** `src/test/setup.ts` bringt die Browser-APIs mit, die jsdom fehlen
(`matchMedia`, `IntersectionObserver`, `Element.animate`), setzt Ionic auf den
iOS-Modus und ersetzt Capacitor Preferences durch eine Map.
`src/test/utils.tsx` stellt `renderWithProviders()` bereit – i18n, React Query
und Router in einem Aufruf.

**Was getestet wird, in dieser Priorität:**

1. **Reine Logik in `src/lib/`.** `seasonLabel()` ist der wichtigste Fall: Läuft
   sie von `season_label()` in SQL weg, zeigt die App eine andere Saison als die
   Rangliste rechnet (NFR-035). Ebenso `theme.ts` (Kontrastberechnung) und
   `format.ts`.
2. **Regeln, die Zahlen erzeugen.** Punktesummen, Unterdeckung einer Schicht,
   Fristen. Ein Fehler hier ist still.
3. **Komponenten mit Verzweigung.** Alles, was je nach Rolle, Status oder
   Zustand etwas anderes zeigt – besonders die drei Zustände lädt/leer/Fehler.
4. **Wiederverwendbare Bauteile** aus `src/components/`.

**Wie geprüft wird:** über die Rolle und den sichtbaren Text
(`getByRole`, `getByText`), nicht über CSS-Klassen oder Testids.

### Was Ionic in jsdom anders macht

Sechs Eigenheiten, die reihenweise Tests scheitern lassen, wenn man sie nicht
kennt. Sie sind ausgemessen, nicht vermutet:

1. **Eigenschaften kommen als DOM-Properties an, nicht als Attribute** – und
   längst nicht alle kommen an.
   `<IonButton disabled>` ergibt `element.disabled === true`, aber
   `getAttribute('disabled') === null` und `outerHTML` zeigt
   `<ion-button>`. Für Zusicherungen gibt es `ionProp()` aus
   `src/test/utils.tsx`:

   ```ts
   expect(ionProp<boolean>(button, 'disabled')).toBe(true);   // richtig
   expect(button).toBeDisabled();                             // schlägt fehl
   ```

   **`ionProp()` ist nur so weit verlässlich, wie die Eigenschaft überhaupt
   ankommt** – und das ist von Komponente zu Komponente verschieden.
   Ausgemessen:

   | Element             | Eigenschaft  | Ergebnis                            |
   | ------------------- | ------------ | ----------------------------------- |
   | `ion-item`          | `routerLink` | kommt an                            |
   | `ion-button`        | `disabled`   | kommt an                            |
   | `ion-menu`          | `contentId`  | `undefined`                         |
   | `ion-select`        | `label`      | `undefined`                         |
   | `ion-input`         | `value`      | `undefined`                         |
   | `ion-menu-toggle`   | `autoHide`   | **`true`, obwohl `false` übergeben** |

   Die letzte Zeile ist die gefährliche: Kommt eine Eigenschaft nicht an, liest
   `ionProp()` **Stencils Vorgabe** – und die sieht aus wie ein echter Wert.
   Ein Test darauf schlägt entweder immer fehl oder, schlimmer, hält die
   Vorgabe für die eigene Absicht.

   **Regel:** Vor einer Zusicherung auf eine Ionic-Eigenschaft einmal
   nachmessen, ob sie ankommt. Kommt sie nicht an, wird stattdessen die
   **Quelle** geprüft – so wie `AppMenu.test.tsx` es für `autoHide={false}`
   und für die gemeinsame Kennung von Menü und `IonSplitPane` tut.

2. **Stencil rendert nicht, also wirkt nichts.** Ein `disabled` Knopf ruft
   seinen `onClick` trotzdem auf, ein `IonModal` mit `isOpen={false}` hat
   seinen Inhalt trotzdem im DOM. Geprüft wird deshalb die **übergebene
   Eigenschaft**, nie das Verhalten von Ionic. Ionic selbst zu testen ist
   ohnehin nicht unsere Aufgabe.

3. **Ein blosser Textknoten direkt in einer Ionic-Komponente ist für
   `getByText` unsichtbar.** `<IonLabel>{title}</IonLabel>` steht im
   `textContent`, aber nicht in den `childNodes`, die Testing Library
   durchsucht. Text in gewöhnlichem HTML darin – `<IonLabel><h2>…</h2></IonLabel>`
   – wird dagegen gefunden.

   ```ts
   expect(container.querySelector('ion-list-header')).toHaveTextContent('…'); // richtig
   expect(screen.getByText('…')).toBeInTheDocument();                          // findet nichts
   ```

4. **Ionic-Ereignisse feuern gar nicht.** `onIonInput`, `onIonChange` und ihre
   Geschwister erreichen in jsdom keinen Handler – weder über `userEvent` noch
   über ein von Hand ausgelöstes `CustomEvent`. `ion-input` hat dort auch kein
   inneres `<input>`, in das man tippen könnte. **Eine Ionic-Eingabe lässt sich
   in jsdom nicht bedienen.**

   Daraus folgt eine Entwurfsregel, nicht nur eine Testregel: **Die
   Entscheidung hinter einem Formular gehört in eine reine Funktion in
   `src/lib/`, nicht in den Ereignis-Handler der Seite.** Dann prüft der Test
   die Verzweigung vollständig, und die Seite bleibt eine Darstellung.
   Vorbild ist `resolveSignInAction()` in `src/lib/authError.ts`: Sie
   entscheidet zwischen «Adresse ungültig», «Link senden» und «mit Passwort
   anmelden», und `LoginPage` führt nur noch aus.

   Ein Komponententest prüft deshalb **was in einem Zustand zu sehen ist**,
   nicht was ein Klick auslöst. Echte Bedienung braucht einen Browser; das ist
   bewusst zurückgestellt (§4).

5. **`IonModal` rendert seinen Inhalt gar nicht.** In jsdom bleibt das Blatt
   leer – auch mit `isOpen`. Ein Test gegen den Inhalt eines Blattes findet
   nichts.

   Auch daraus folgt eine Entwurfsregel: **Der Inhalt eines Blattes gehört in
   eine eigene, exportierte Komponente**, die der Test direkt rendert. Vorbild
   ist `DeleteAccountContent` in `src/components/DeleteAccountModal.tsx` – erst
   diese Trennung macht die Erklärung der Kontolöschung und die Sperre für den
   einzigen Vorstand prüfbar.

6. **Werte von Formularfeldern sind nicht auslesbar.** `ionProp()` erreicht
   `disabled` an einem `ion-button` und `routerLink` an einem `ion-item`, aber
   **nicht** `value` an einem `ion-input` oder `checked` an einem `ion-toggle`:
   Diese Komponenten verwalten ihren Wert über Refs, die in jsdom nie greifen.

   Geprüft wird deshalb, **womit das Formular speichert**, nicht was in den
   Feldern steht: Die Hülle (`FormModal`) wird durch gewöhnliches HTML ersetzt,
   der Bestätigen-Knopf geklickt und die Mutation geprüft. Vorbild:
   `ProfileEditModal.test.tsx`.

**Zusicherungen auf Ionic-Interna** wie `translucent` oder `collapse` sind
verboten. Geprüft wird die eigene Struktur (`ion-content > ion-header`) und das,
was eine Person sieht.

**ARIA gehört auf gewöhnliche Elemente.** `role="alert"` auf einem `IonNote`
kommt in jsdom gar nicht und im Browser nur über ARIA-Reflexion an. Deshalb
trägt die Komponente `InlineError` die Rolle auf einem `div` – und ist damit
auch die einzige Stelle, an der Fehlertexte im Seitenfluss entstehen.

**Die Sprache steht vor dem Render fest.** `src/test/setup.ts` setzt Deutsch,
weil der Spracherkenner sonst `navigator.language` folgt – in jsdom Englisch.
Für eine andere Sprache `await setLanguage('fr')` vor dem Render.

Nicht getestet werden: Supabase selbst, Ionic selbst, reine Weiterreichung von
Eigenschaften ohne Logik.

---

## 2. Manuelle Tests

Je Use Case ein Plan unter `docs/test-plans/uc-NNN-*.md`, erzeugt mit
`/ai-manual-test`. Er deckt den Hauptablauf und jeden alternativen Ablauf der
Spezifikation mit je einem Testfall ab.

**Gerätematrix** (C-001, NFR-032 – eine Codebasis, drei Ziele):

| Ziel    | Mindestens                                   |
| ------- | -------------------------------------------- |
| iOS     | ein iPhone, Safari-WebView, Hell und Dunkel  |
| Android | ein Telefon, Chrome-WebView                  |
| PWA     | Safari und Chrome auf dem Telefon            |

Immer mitzuprüfen, weil es automatisiert nicht sichtbar wird:

- Der grosse Titel klappt beim Scrollen zusammen.
- Vier Sprachen: kein abgeschnittener oder englischer Text (C-007).
- Vereinsfarben wirken ohne Neustart (C-013).
- Deep Link `ch.myclub.nexus://` landet in der App (C-012).
- Kamera, Push-Erlaubnis und Offline-Verhalten – nur auf dem Gerät prüfbar.

---

## 3. Datenbanktests

Die Regeln, die nicht verhandelbar sind, hängen an der Datenbank und nicht am
Frontend. Geprüft werden sie dort, wo sie gelten – gegen die **verknüpfte**
Instanz:

```bash
supabase db push                       # Migration einspielen
supabase db query --linked -f probe.sql
```

Eine Probe ist ein `do $probe$ … $probe$`-Block, der seinen Befund in einer
Textvariablen sammelt und mit `raise exception '%', report` endet. **Die
Ausnahme ist der Zweck**: Sie rollt alles zurück, was die Probe angelegt hat –
in einer Datenbank mit echten Vereinen ist das der Unterschied zwischen einem
Test und einem Schaden.

Rollen werden dabei umgeschaltet, nicht angenommen:

```sql
perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
perform set_config('role', 'authenticated', true);   -- ab hier greift RLS
perform set_config('role', 'postgres', true);        -- privilegiert aufbauen und **messen**
```

Vier Fallen, die eine Probe still bestehen lassen, obwohl sie nichts misst –
alle vier sind in diesem Projekt schon aufgetreten:

1. **«Kein Fehler» heisst nicht «hat gewirkt».** Ein `update`, für das keine
   Policy greift, trifft null Zeilen und wirft nichts. Gemessen wird die
   **Differenz**, nicht die Abwesenheit eines Fehlers.
2. **Unter RLS zählt man nur das Eigene.** Wer `notifications` als angemeldete
   Person zählt, bekommt seine eigenen – die Zustellung an andere ist unsichtbar
   und der Test bestätigt eine Null, die nichts bedeutet. Zählen: als `postgres`.
3. **Einen Endzustand ohne seinen Anfangszustand zu prüfen** beweist nichts.
4. **Eine Kennung, die nach einer Korrektur nicht mehr existiert**, vergleicht
   sich stillschweigend mit `null`.

Wer eine bereits eingespielte Migration überarbeitet:
`supabase migration repair --status reverted NNNN`, dann erneut `db push`.

Zu prüfen sind mindestens:

- `point_transactions` nimmt vom Client kein `insert` an (NFR-012).
- `award_points` und `seed_point_rules` sind für `anon` und `authenticated`
  nicht ausführbar (NFR-013).
- Die Dedup-Regel `(member_id, rule_code, source_id)` verwirft die zweite
  Buchung (NFR-017).
- Kein Lesezugriff über Vereinsgrenzen (NFR-011).
- `season_label()` liefert dasselbe wie `seasonLabel()` in TypeScript (NFR-035).
- Jede neue `security definer`-Funktion ist für `anon` **nicht** ausführbar –
  am Ende jeder Probe über `has_function_privilege()` nachgezählt.

---

## 4. Bewusst nicht automatisiert

**Bedienung von Ionic-Oberflächen.** Wie oben gemessen, feuert in jsdom kein
einziges Ionic-Ereignis. Ein Test, der einen Wert eintippt und den Knopf
drückt, braucht einen echten Browser – über Vitest im Browser-Modus oder über
Playwright. Beides ist im MVP nicht gesetzt, weil die Abläufe fast alle eine
echte Sitzung, eine Kamera oder eine Push-Erlaubnis brauchen.

Die Lücke wird zweifach geschlossen, statt sie offen zu lassen:

1. Jede Entscheidung, die ein Formular trifft, liegt als reine Funktion in
   `src/lib/` und ist dort vollständig geprüft.
2. Jeder Ablauf hat einen manuellen Testplan unter `docs/test-plans/`, der die
   Bedienung auf echten Geräten abdeckt.

Playwright-E2E ist damit vorbereitet (`/ai-playwright-test`), aber erst
sinnvoll, wenn eine Testdatenbank mit Beispielverein steht.
