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

Drei Eigenheiten, die reihenweise Tests scheitern lassen, wenn man sie nicht
kennt. Sie sind ausgemessen, nicht vermutet:

1. **Eigenschaften kommen als DOM-Properties an, nicht als Attribute.**
   `<IonButton disabled>` ergibt `element.disabled === true`, aber
   `getAttribute('disabled') === null` und `outerHTML` zeigt
   `<ion-button>`. Für Zusicherungen gibt es `ionProp()` aus
   `src/test/utils.tsx`:

   ```ts
   expect(ionProp<boolean>(button, 'disabled')).toBe(true);   // richtig
   expect(button).toBeDisabled();                             // schlägt fehl
   ```

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
Frontend. Sie werden gegen eine lokale Instanz geprüft:

```bash
supabase start
supabase db reset      # Migrationen neu anwenden
```

Zu prüfen sind mindestens:

- `point_transactions` nimmt vom Client kein `insert` an (NFR-012).
- `award_points` und `seed_point_rules` sind für `anon` und `authenticated`
  nicht ausführbar (NFR-013).
- Die Dedup-Regel `(member_id, rule_code, source_id)` verwirft die zweite
  Buchung (NFR-017).
- Kein Lesezugriff über Vereinsgrenzen (NFR-011).
- `season_label()` liefert dasselbe wie `seasonLabel()` in TypeScript (NFR-035).

---

## 4. Bewusst nicht automatisiert

Playwright-E2E ist vorbereitet (`/ai-playwright-test`), aber im MVP nicht
gesetzt: Die Abläufe brauchen fast alle eine echte Sitzung, eine Kamera oder
eine Push-Erlaubnis. Bis eine Testdatenbank mit Beispielverein steht, tragen die
manuellen Testpläne diese Last.
