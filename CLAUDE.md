# CLAUDE.md

Hinweise für Claude Code in diesem Repository.

## Was das Projekt ist

**nexus – rethink communities** – Engagement-Plattform für Vereine nach Schweizer
Recht. Ionic React 9 + Capacitor 8 (iOS, Android, PWA) auf einem Supabase-Backend.
Nachfolger der bestehenden Ionic-Angular-App unter `github.com/myclubapp/app`, aber
ohne Google-Stack: kein Firebase, kein FCM, kein Google-Login.

**Marke (Entscheid 16.09.2026):** Produkt- und Dachmarke ist **nexus**. «myclub»/
«my-club» bezeichnet nur noch die Alt-App, die migriert und nicht weiterentwickelt
wird. Der Arbeitstitel «TeamSpirit» ist abgelöst. Noch offen sind Domain,
App-Store-Name und Bundle-ID (`ch.myclub.nexus`) – bis dahin bleibt die Bundle-ID
im Code unverändert.

Massgebende Dokumente in `docs/`, in dieser Rangfolge:

1. `MVP_Scope_nexus.md` – der Leistungsschnitt. Übersteuert die anderen.
2. `Technische_Architektur_nexus.md` – Stack, Flows, Schreibpfade, RLS.
3. `Konzept_Gamification_nexus.md` – die sieben Punkte-Säulen samt Punktwerten.

Darüber liegen zwei Haltungs-Dokumente, die den Purpose und das Segment festlegen:
`nexus_Manifest_Vereinsfuehrungslogik.md` (Purpose, fünf Grundsätze, vier
Arbeitsprinzipien) und `Positionierung_nexus_Rethink_Communities.md` (Segment ist
die Rechtsform Verein, Marken-Architektur). Das Schema führt `entity_model.md`
zusammen mit `supabase/migrations/` – nicht das Architektur-Dokument.

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
  Web Push VAPID. Auch die Schriften: Space Grotesk und DM Sans liegen als
  `@fontsource-variable`-Paket im Bündel, kein `<link>` auf Googles
  Schriftserver.
- Commits nach [Conventional Commits](https://www.conventionalcommits.org/).

## Fallstricke

- **Ionic 9 verlangt React Router 6.** `<Route element={…}>` statt `component`,
  `<Navigate replace>` statt `<Redirect>`. Ältere Ionic-React-Beispiele im Netz
  zeigen die v5-Syntax und funktionieren hier nicht.
- **Eine Weiche darf ihr Zwischenbild nicht als `IonPage` zeigen.** Ionic
  blendet eine Seite nicht über CSS ein, sondern über einen Übergang, den der
  `StackManager` beim **Routenwechsel** startet; bis dahin trägt jede frisch
  eingehängte `IonPage` `ion-page-invisible` (`opacity: 0`). Tauscht
  `RequireAuth`/`RequireClub` innerhalb derselben Route ihr Skelett gegen die
  echte Seite, wechselt die Route nicht – die Seite steht vollständig im DOM
  und bleibt unsichtbar. Im Browser gemessen trifft es jeden Tausch, der
  zwischen etwa 30 und 200 ms nach dem Routenwechsel landet: genau die Dauer
  einer Supabase-Abfrage, deshalb «manchmal». Zwischenbilder und Fehlerseiten
  der Weichen laufen darum über `DetachedPage` (`div.ion-page`, meldet sich
  nicht beim Outlet an), die echte Seite bleibt die einzige `IonPage` der
  Route. **jsdom fängt das nicht** – dort läuft kein Übergang, und beide
  Hüllen ergeben dasselbe DOM.
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
  **`/auth/callback` und `/auth/verify` bleiben bewusst unbeansprucht.** Fängt
  die App den Rückweg einer Anmeldung ab, die im Browser begonnen hat, fehlt
  ihr der PKCE-Verifier und der Tausch scheitert wortlos.
- **Der Anmeldelink hat zwei Wege, und nur einer ist kopierbar.** Die
  Schaltfläche der Mail zeigt auf `/auth/v1/verify` von GoTrue; der schickt
  danach einen **PKCE-Code** an das Ziel, das die App bei der Anfrage genannt
  hat. Einlösen lässt der sich nur dort, wo der Verifier liegt – im Browser,
  der die Anmeldung gestartet hat, oder in der App. Eine kopierte Adresse
  landet fast nie dort und scheitert wortlos. Deshalb trägt die Mail darunter
  eine zweite, ausgeschriebene Adresse auf `/auth/verify` mit dem
  **Token-Hash**: Den löst die App über `verifyOtp()` ein, ohne Verifier und
  ohne Gerätebindung (`verifyLink()` in `supabase/functions/auth-mail/hook.ts`,
  `AuthVerifyPage`). Beide Wege lösen denselben Token ein – wer den einen geht,
  entwertet den anderen. `emailOtpType()` in `src/lib/authLink.ts` und
  `authAction()` in `auth-mail/template.ts` müssen dieselben sechs Anlässe
  kennen.
