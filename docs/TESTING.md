# Testkonzept: myclub nexus

Drei Ebenen, jede mit einer eigenen Frage. Was auf einer tieferen Ebene
beantwortet werden kann, gehört nicht auf eine höhere.

| Ebene                   | Frage                                                  | Werkzeug            | Wo                       |
| ----------------------- | ------------------------------------------------------ | ------------------- | ------------------------ |
| Unit / Komponente       | Rechnet und rendert der Code richtig?                  | Vitest + Testing Library | `src/**/*.test.ts(x)` |
| Manueller Test          | Funktioniert der Ablauf auf einem echten Gerät?        | Testplan + Person   | `docs/manual_tests/`     |
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
(`getByRole`, `getByText`), nicht über CSS-Klassen oder Testids. Ionic-Interna
sind in jsdom **nicht** verlässlich lesbar: Web-Component-Eigenschaften wie
`translucent` oder `collapse` kommen dort nicht an. Zusicherungen darauf sind
verboten – geprüft wird die eigene Struktur (`ion-content > ion-header`) und das,
was eine Person sieht.

Nicht getestet werden: Supabase selbst, Ionic selbst, reine Weiterreichung von
Eigenschaften ohne Logik.

---

## 2. Manuelle Tests

Je Use Case ein Plan unter `docs/manual_tests/UC-NNN-*.md`, erzeugt mit
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
