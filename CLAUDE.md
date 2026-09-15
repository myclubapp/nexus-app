# CLAUDE.md

Hinweise für Claude Code in diesem Repository.

## Was das Projekt ist

**myclub nexus** – Engagement-Plattform für Vereine. Ionic React 9 + Capacitor 8
(iOS, Android, PWA) auf einem Supabase-Backend. Nachfolger der bestehenden
Ionic-Angular-App unter `github.com/myclubapp/app`, aber ohne Google-Stack:
kein Firebase, kein FCM, kein Google-Login.

Massgebende Dokumente in `docs/`, in dieser Rangfolge:

1. `MVP_Scope_myclub.md` – der Leistungsschnitt. Übersteuert die anderen.
2. `Technische_Architektur_TeamSpirit.md` – Stack, Schema, Flows.
3. `Konzept_Vereinsapp_Gamification.md` – die sieben Punkte-Säulen.

**Die Verwaltung ist das Substrat, das Punktesystem ist das Produkt.** Wer eine
Funktion baut, prüft zuerst, ob sie im MVP-Schnitt (§2.1) steht.

## Aufbau

```
app/                      Ionic React + Capacitor
  src/pages/              Fünf Tabs + Auth + Onboarding
  src/hooks/              useAuth, useClub, useAgenda, useGamification, useNews
  src/lib/                supabase.ts, database.types.ts, theme.ts, season.ts
  src/i18n/locales/       de, fr, it, en
  src/theme/variables.css Basisfarben (Vereinsfarben kommen zur Laufzeit)
  ios/  android/          Native Projekte, von `cap add` erzeugt
supabase/migrations/      Schema, Funktionen, RLS
docs/                     Konzept und Architektur
```

## Werkzeuge

```bash
cd app
npm run dev                 # Vite-Dev-Server auf :5173
npm run build               # tsc -b && vite build
npm run typecheck           # nur Typen
npm run i18n:check          # alle vier Sprachen müssen dieselben Schlüssel haben
npm run sync                # build + cap sync (iOS und Android)
npm run ios                 # sync + Xcode öffnen
npm run android             # sync + Android Studio öffnen
npm run types:generate      # database.generated.ts aus dem verknüpften Projekt

supabase start              # lokale Instanz
supabase db reset           # Migrationen neu anwenden
supabase db push            # Migrationen deployen
```

## Regeln, die nicht verhandelbar sind

- **Punkte schreibt nur der Server.** Der einzige Weg in `point_transactions`
  sind die `security definer`-Funktionen (`award_points`, `check_in`,
  `confirm_task`, `confirm_shift`). RLS erlaubt Clients kein `insert`. Wer eine
  neue Punktequelle baut, baut sie als Datenbankfunktion, nicht im Frontend.
- **Rollenprüfung serverseitig.** `is_club_admin()` in der Policy, nicht nur ein
  verstecktes Button im UI.
- **Geltungsbereich nach Team, für jede Entität.** Trägt eine Tabelle einen
  `team_id`, dann liest und schreibt sie nur, wer in diesem Team ist – plus
  der Vorstand (`is_club_board()`: sportchef, admin, superadmin), weil er den
  ganzen Verein führt. **Trainer:innen sind wie Mitglieder abgegrenzt:** Sie
  sehen und planen ihre eigenen Teams, nicht den Verein; was keinem Team
  gehört (`team_id` null), legt nur der Vorstand an. `is_club_member(club_id)`
  allein ist in einer Policy ein Befund, `is_club_trainer()` in einer
  Reichweiten-Prüfung ebenso – sie sagt nur «darf planen», nicht «wofür».
  Vorlage sind `event_in_scope()`/`task_in_scope()` fürs Lesen und
  `can_plan_for_team()` fürs Schreiben (alle `0073`); was am Termin hängt
  (Serie, Schichten, Teilnahmen, QR-Token), erbt seinen Geltungsbereich vom
  Termin. Das gilt auch für das **Schreiben**: Eine Policy, die nur das Lesen
  abgrenzt, grenzt nichts ab.
- **Vier Sprachen ab dem ersten Commit.** Neue UI-Texte gehören in alle vier
  Dateien unter `src/i18n/locales/`. `npm run i18n:check` erzwingt das.
- **Code-Bezeichner auf Englisch**, Benutzertexte über `react-i18next`.
  Kommentare und Dokumentation auf Deutsch.
- **Kein Sport-Vokabular im Kern.** «Training», «Spiel», «Probe» sind
  konfigurierbare Labels des Vereins (`clubs.settings.labels`), abgerufen über
  `useClub().eventLabel()`. Die Datenbank kennt nur `events.type`.
- **Kein Google.** Keine Firebase-, FCM-, Google-Maps- oder ML-Kit-Abhängigkeit.
  QR-Scan läuft über `html5-qrcode` im WebView, Push über APNs, ntfy und
  Web Push VAPID.
- Commits nach [Conventional Commits](https://www.conventionalcommits.org/).

## Fallstricke

- **Ionic 9 verlangt React Router 6.** `<Route element={…}>` statt `component`,
  `<Navigate replace>` statt `<Redirect>`. Ältere Ionic-React-Beispiele im Netz
  zeigen die v5-Syntax und funktionieren hier nicht.
- **Das verschachtelte Outlet in `TabsPage` darf kein `ionPage` bekommen.**
  `IonTabs` legt selbst einen `PageManager` um sich – das ist die Seite, die
  das äussere Outlet einblendet. Mit `ionPage` wird zusätzlich das
  `ion-router-outlet` zur Seite, startet mit `ion-page-invisible` und wird nie
  eingeblendet: Die Tabs stehen, jeder Screen ist weiss. Der Fehler sieht aus
  wie fehlende Daten, das DOM ist aber vollständig – `TabsPage.test.tsx` hält
  ihn fest.
- **Generierte Typen und Handarbeit sind getrennt.** `types:generate`
  überschreibt `src/lib/database.generated.ts` vollständig – dort geht jede
  Änderung von Hand verloren. Die Aufzählungen hinter den `text`-Spalten
  (`EventType`, `AttendanceStatus`, `ClubKind`), die Form von `clubs.settings`
  und die Zeilen-Aliase stehen in `src/lib/database.types.ts`, das die App
  importiert. Beide Dateien verwenden Type-Aliase, keine Interfaces: supabase-js
  verlangt Kompatibilität zu `Record<string, unknown>`; Interfaces bekommen in
  TypeScript keine implizite Index-Signatur und ergeben stille `never`-Typen.
- **`season_label()` in SQL und `seasonLabel()` in `src/lib/season.ts` müssen
  übereinstimmen.** Laufen sie auseinander, zeigt die App eine andere Saison an
  als die Rangliste ausrechnet.
- **Der Punkte-Ledger dedupliziert über `(member_id, rule_code, source_id)`.**
  Eine zweite Buchung zur selben Quelle wird still verworfen – nicht durch eine
  Differenzbuchung auf derselben Quelle umgehen.
- **Aufgaben tragen ihren Punktwert selbst**, Termine nehmen den Regelwert.
  `confirm_task` bucht deshalb direkt, `check_in` über `award_points`.
- **Eine neue `security definer`-Funktion ist sofort ein offener Endpunkt.**
  Postgres vergibt `execute` automatisch an `public`, Supabase zusätzlich an
  `anon` und `authenticated` – die Funktion hängt damit unter `/rest/v1/rpc/`
  und umgeht die RLS, die sie schützen soll. Interne Routinen brauchen deshalb
  ein `revoke execute … from public, anon, authenticated` (Vorlage:
  `0007_function_grants.sql`). `revoke … from anon` allein wirkt nicht: `anon`
  zieht sein Recht aus PUBLIC, dessen Grant dabei stehen bleibt.
- **Deep Links, zwei Wege.** Das Schema `ch.myclub.nexus` bringt den
  Anmeldelink zurück und steht an vier Stellen: `Info.plist`
  (`CFBundleURLSchemes`), `AndroidManifest.xml`, `supabase/config.toml`
  (`additional_redirect_urls`) und `env.appScheme` in `src/lib/env.ts`.
  Änderungen immer überall nachziehen – nicht in `capacitor.config.ts`, dessen
  `ios.scheme` das WebView meint und nichts damit zu tun hat.
  **Für Links aus E-Mails taugt das Schema nicht**: E-Mail-Programme machen
  `ch.myclub.nexus://` gar nicht erst anklickbar, und ohne installierte App
  führt es ins Leere. Die Mails tragen deshalb `https://app.my-club.ch/…`
  (`appLink()`), und die App beansprucht diese Adressen über Universal Links
  bzw. App Links. Dafür hängen fünf Dinge zusammen:
  `public/.well-known/apple-app-site-association`,
  `public/.well-known/assetlinks.json`, das Entitlement
  `ios/App/App/App.entitlements`, der `autoVerify`-Intent-Filter im
  `AndroidManifest.xml` und `CLAIMED_PREFIXES` in `src/lib/deepLink.ts`. Die
  beanspruchten Pfade – heute `/tabs` und `/invite` – müssen in allen vier
  Zuordnungen dieselben sein.
  **`/auth/callback` bleibt bewusst unbeansprucht.** Fängt die App den Rückweg
  einer Anmeldung ab, die im Browser begonnen hat, fehlt ihr der
  PKCE-Verifier und der Tausch scheitert wortlos.
