# Technische Architektur: TeamSpirit
## Ionic React + Capacitor | Supabase (100% – Deno Edge Functions, Postgres, pg_cron)
### Souverän & Open Source – ohne Google-Abhängigkeiten

---

## 1. Architekturübersicht

**Prinzip: Alles läuft in Supabase – und alles ist Open Source & selbst hostbar.** Kein separater Server, kein DevOps-Overhead im Start, und keine Abhängigkeit von Google-Diensten. Die gesamte Backend-Logik verteilt sich auf drei Supabase-Ebenen:

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ iOS App  │  │ Android  │  │ Web-App (PWA)        │  │
│  │(Capacitor)│ │(Capacitor)│ │ (Browser, Vorstand)  │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       └─────────────┴─── Ionic React ────┘              │
└──────────────────────┬──────────────────────────────────┘
                       │ supabase-js (Auth, CRUD, RPC,
                       │ Realtime, Storage, functions.invoke)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SUPABASE (managed EU oder self-hosted CH)  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ① POSTGRES (Herzstück)                            │  │
│  │   • Tabellen + Row Level Security (Multi-Tenant)  │  │
│  │   • Punkte-Engine als SQL-Funktionen              │  │
│  │     (security definer RPCs, Trigger)              │  │
│  │   • Materialized Views (Leaderboards)             │  │
│  │   • pg_cron: Zeitpläne  • pg_net: HTTP-Aufrufe    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ ② EDGE FUNCTIONS (Deno/TypeScript)                │  │
│  │   • push-send        (ntfy/UnifiedPush, APNs,     │  │
│  │                       Web Push VAPID)             │  │
│  │   • payment-import   (camt.054 / Schweizer PSP)   │  │
│  │   • jobs-streaks     (von pg_cron getriggert)     │  │
│  │   • jobs-loyalty     (Treuejubiläen)              │  │
│  │   • jobs-digest      (Wochenzusammenfassung)      │  │
│  │   • season-close     (Funktionärspunkte buchen)   │  │
│  │   • federation-sync  (swiss unihockey API etc.)   │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ ③ PLATTFORM-DIENSTE (alle Open Source)            │  │
│  │   • Auth/GoTrue (Magic Link, E-Mail, Passkeys)    │  │
│  │   • Realtime (Live-Leaderboard, Punkte-Ticker)    │  │
│  │   • Storage (Factsheets, Nachweise, Avatare)      │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ nur ausgehende Aufrufe zu souveränen Diensten:
                     ▼
        ntfy (self-hosted Push) · APNs · Schweizer SMTP ·
        Verbands-APIs · Bank (camt.054) / Schweizer PSP
```

### Arbeitsteilung: Was läuft wo?

| Aufgabe | Ort | Warum |
|---|---|---|
| CRUD (Profil, Events, Anmeldungen) | **Client → Postgres direkt** (supabase-js + RLS) | Kein Umweg, RLS sichert Mandantentrennung |
| **Punktevergabe** (Check-in, Aufgaben) | **Postgres-Funktionen** (`security definer` RPC) | Transaktional, atomar, manipulationssicher – Clients schreiben NIE direkt in `point_transactions` |
| Streak-/Treue-Berechnung | **pg_cron → SQL** oder **pg_cron → Edge Function** | Nächtliche Batch-Jobs, direkt in der DB am schnellsten |
| Push-Benachrichtigungen & Nudges | **Edge Function `push-send`** | Externe HTTP-Calls (ntfy/APNs/Web Push) gehören nicht in SQL |
| Zahlungsabgleich (Beitrag bezahlt) | **Edge Function `payment-import`** | camt.054-Import oder Webhook eines Schweizer PSP |
| Saisonabschluss (Funktionärspunkte) | **Edge Function `season-close`** + Admin-UI | Workflow mit Vorstands-Freigabe |
| Leaderboards | **Materialized Views** + Supabase Realtime | Performant, live, ohne Serverlogik |
| Badge-Vergabe | **Trigger/SQL nach Punktebuchung** + nächtlicher Sweep | Kriterien liegen als JSONB in der DB |
| Verbandsdaten (Spielpläne, Resultate) | **pg_cron → Edge Function `federation-sync`** | Muster aus myclub übernommen (s. Abschnitt 2) |

**Faustregel**: Transaktionale Geschäftslogik → **Postgres-Funktionen**. Alles mit externen HTTP-Aufrufen → **Edge Functions (Deno)**. Zeitsteuerung → **pg_cron**.

---

## 2. Referenz-Projekt: myclub (github.com/myclubapp)

Die bestehende myclub-App (Ionic **Angular** + Firebase) dient als UI- und Funktions-Referenz. Sie ist produktionserprobt für Schweizer Vereine – wir übernehmen die bewährten Patterns, ersetzen aber den gesamten Google-Stack (Firebase/Firestore/FCM/Google Maps).

### 2.1 UI-Referenz: Seiten-Mapping (Angular → React)

| myclub-Seite (Angular) | TeamSpirit (Ionic React) | Übernahme / Änderung |
|---|---|---|
| `tabs` (Tab-Navigation) | Tab-Layout mit 5 Tabs | Struktur übernehmen; Tabs: Dashboard, Marktplatz, Ranglisten, Agenda, Profil |
| `onboarding`, `auth` | Onboarding + Auth | Flow übernehmen; Login Google-frei (s. 3.2) |
| `club-request-list`, `team-request-list` (Join-Requests mit Approval) | Beitritts-Anfragen | 1:1 übernehmen – bewährter Flow: Mitglied stellt Anfrage, Admin genehmigt |
| `training` (Zu-/Absagen) | Agenda/Training | Übernehmen + QR-Check-in & Punkte ergänzen |
| `championship` (Spielpläne, Resultate) | Agenda/Meisterschaft | Übernehmen inkl. Verbands-Sync |
| `event` | Agenda/Vereinsevents | Übernehmen + Punkteanbindung (GV, Anlässe) |
| **`helfer`** (Helfer-Events mit **Schichten** & Bestätigung) | Aufgaben-Marktplatz | **Kern-Referenz!** Schichten-Modell + Confirm-Flow = Vorbild für unsere Task-Bestätigung; myclub kennt bereits `helferPunkte` |
| `club-billing-period`, `club-invoice`, `member-invoice-list`, **`qr-invoice-modal`** | Rechnungsmodul | Übernehmen inkl. **swissqrbill** (Schweizer QR-Rechnung) – Basis für «pünktlich bezahlt»-Punkte |
| `club-member-list`, `club-parents-list` (Eltern!), `team-member-list` | Mitglieder-/Teamverwaltung | Übernehmen; Eltern/Kids-Feature ist wichtig für Juniorenvereine |
| `news` | News-Feed | Übernehmen (Club-/Team-/Verbands-News) |
| `member`, `profile` | Profil | Übernehmen + Badges, Punktehistorie, Level |
| `follow` | Follow (Teams/Vereine folgen) | Später (Phase 3) |
| `club-links` | Vereins-Links | Übernehmen (einfach) |

### 2.2 Bewährte Patterns aus der myclub-Codebasis

- **Whitelabel-Themes pro Verein** (`custom-themes/app-uhc-win-u`): In TeamSpirit als CSS-Variablen (Ionic Theming), gespeichert in `clubs.settings` – kein Rebuild pro Verein nötig.
- **i18n** mit ngx-translate → in React: **react-i18next** (DE/FR/IT/EN, deckt Konzept-Phase 4 ab).
- **Trigger-Architektur**: myclub nutzt Firestore-Trigger (`onDocumentCreated/Updated/Deleted`) für Benachrichtigungen und Folgeaktionen → identisches Muster mit **Postgres-Triggern** (z.B. `after insert on news → notify`).
- **Helfer-Bestätigungs-Flow**: `helferEvents/schichten/attendees` + `confirmHelferEvent` → bei Bestätigung entsteht ein `helferPunkt`. Genau dieses Muster bildet unsere `confirm_task()`/`award_points()`-Kette ab – inkl. Migration: bestehende `helferPunkte` lassen sich 1:1 in `point_transactions` überführen.
- **Verbands-Sync-Scheduler**: myclub synchronisiert Clubs (Mo 08:00), Teams (Mo 08:10), Spiele (tägl. 06:00), News (stündlich) von Verbands-APIs (swiss unihockey etc.) – Zeitplan und Aufteilung übernehmen wir in pg_cron + `federation-sync`.
- **Kids-E-Mail-Verifikation**: Eltern legen Kinder an, Verifikation per Mail – wichtig für Jugendschutz (`is_minor`, Einwilligung).
- **Stripe für Vereins-Abos**: wird ersetzt (s. 3.1) – Vereinsrechnungen laufen bereits heute über QR-Rechnung, das bleibt.

---

## 3. Souveränitäts-Prinzip: Google-frei & Open Source

### 3.1 Ersatz-Matrix (Firebase/Google → souveräne Alternativen)

| Bisher (myclub) | Neu (TeamSpirit) | Bemerkung |
|---|---|---|
| Firebase Auth (inkl. Google-Login) | **Supabase Auth (GoTrue, Open Source)**: Magic Link, E-Mail/Passwort, Passkeys | Ohne Google-/Apple-Social-Login entfällt auch die «Sign in with Apple»-Pflicht im App Store |
| Firestore | **PostgreSQL** | Relational statt Dokumente; RLS statt Firestore Rules |
| Cloud Functions (Node) | **Edge Functions (Deno)** + Postgres-Trigger + pg_cron | Gleiche Trigger-Denkweise, offene Runtime |
| **FCM Push** | **ntfy/UnifiedPush** (self-hosted, Android) + **APNs** (iOS) + **Web Push VAPID** (PWA) | Details in 3.3 |
| @capacitor/google-maps | **MapLibre GL** + OpenStreetMap / **swisstopo**-Karten | swisstopo: freie Schweizer Geodaten – souveräner geht's nicht |
| @capacitor-mlkit Barcode (Google ML Kit) | **ZXing-basiertes Scanning** (z.B. html5-qrcode im WebView) | Open Source, kein Google-SDK im Build |
| Google Analytics / Crashlytics | **Matomo** oder **Plausible** (self-hosted), **Sentry** (self-hostbar) | Nutzungsdaten bleiben beim Verein |
| Stripe (US) | **Schweizer PSP** (Payrexx, Wallee, Datatrans) – oder ganz ohne PSP: **QR-Rechnung + camt.054-Bankabgleich** | swissqrbill-Library weiterverwenden; camt.054 = maximal souverän, keine Drittpartei |
| Firebase Hosting | Static Hosting bei Schweizer Provider (Infomaniak, Exoscale) oder eigener Caddy/Nginx | PWA ist nur statisches Bundle |
| Transaktions-E-Mails (Welcome etc.) | Schweizer SMTP (Infomaniak) oder self-hosted (Mailcow/Postal) | Supabase Auth erlaubt eigenen SMTP |

### 3.2 Auth ohne Google & Apple

- **Magic Link** als Standard (niedrigste Hürde, alle Altersgruppen).
- **E-Mail + Passwort** als Fallback.
- **Passkeys (WebAuthn)** als moderner, phishing-resistenter Weg – offener Standard, keine Big-Tech-Abhängigkeit. (Einführung sobald in Supabase Auth stabil verfügbar; bis dahin Magic Link.)
- Bewusst **kein** Google/Facebook-Login. Damit entfällt auch Apples Zwang zu «Sign in with Apple».

### 3.3 Push-Strategie ohne FCM (ehrliche Einordnung)

Push ist der einzige Punkt, an dem Google-Freiheit auf Android einen echten Trade-off bedeutet – hier die saubere Lösung pro Plattform:

| Plattform | Lösung | Einordnung |
|---|---|---|
| **iOS (nativ)** | **APNs direkt** aus der Edge Function (HTTP/2 + JWT) | Apple-Infrastruktur ist für iOS unvermeidbar, aber: kein Google |
| **Android (nativ)** | **UnifiedPush** mit self-hosted **ntfy**-Server (z.B. auf Infomaniak/Exoscale) | Voll souverän & Open Source. Trade-off: dauerhafte Verbindung der ntfy-App/SDK statt Play-Services – minimal höherer Akkuverbrauch, dafür null Google |
| **Web/PWA** | **Web Push (VAPID-Standard)** direkt aus der Edge Function | Offener W3C-Standard |
| Fallback überall | In-App-Inbox (`notifications`-Tabelle + Realtime) + wöchentlicher E-Mail-Digest | Erreicht 100% der Mitglieder, auch ohne Push-Erlaubnis |

Die Edge Function `push-send` abstrahiert alle vier Kanäle hinter einer Schnittstelle; `push_tokens.platform` steuert das Routing.

### 3.4 Hosting: zwei Stufen der Souveränität

| Option | Beschreibung | Souveränität | Aufwand |
|---|---|---|---|
| **A – Managed Supabase, Region Zürich** (AWS eu-central-2) | Schnellster Start, Backups/Updates inklusive | Daten in CH, aber US-Cloud-Anbieter (CLOUD Act) | Minimal |
| **B – Self-hosted Supabase auf Schweizer Cloud** (Exoscale, Infomaniak, cloudscale.ch) | Kompletter Supabase-Stack ist Open Source (Postgres, GoTrue, PostgREST, Realtime, Storage, Edge Runtime) und via Docker/K8s betreibbar | **Voll souverän** – Daten & Dienste zu 100% in Schweizer Hand | Ops-Know-how nötig (Updates, Backups, Monitoring) |

**Empfehlung**: Start mit **Option A** (Tempo, Fokus aufs Produkt). Da die Architektur ausschliesslich offene Supabase-Komponenten nutzt – keine proprietären Services –, ist der Umzug auf **Option B** jederzeit ein reiner Infrastruktur-Move ohne Code-Änderung. Das ist der eigentliche Souveränitäts-Gewinn gegenüber Firebase: **Es gibt einen Exit.**

---

## 4. Repo-Struktur

```
teamspirit/
├── app/                          # Ionic React + Capacitor
│   ├── src/
│   │   ├── pages/                # Dashboard, Marktplatz, Ranglisten, Agenda, Profil
│   │   │                         # + Club-Admin (Mitglieder, Rechnungen, Requests)
│   │   ├── components/
│   │   ├── hooks/                # useAuth, usePoints, useTasks, useRealtime...
│   │   ├── i18n/                 # react-i18next (de/fr/it/en)
│   │   ├── themes/               # Whitelabel: CSS-Vars pro Verein (aus clubs.settings)
│   │   └── lib/
│   │       ├── supabase.ts       # Client-Init
│   │       └── database.types.ts # generiert: supabase gen types typescript
│   ├── capacitor.config.ts
│   ├── ios/
│   └── android/
├── supabase/                     # Alles Backend lebt hier
│   ├── config.toml
│   ├── migrations/               # SQL: Schema, RLS, Funktionen, Trigger, Views
│   │   ├── 0001_core.sql
│   │   ├── 0002_points.sql
│   │   ├── 0003_tasks_roles.sql
│   │   ├── 0004_news_requests_shifts.sql
│   │   ├── 0005_rls.sql
│   │   └── 0006_cron.sql
│   ├── functions/                # Edge Functions (Deno/TypeScript)
│   │   ├── _shared/              # supabaseAdmin, push-Adapter (ntfy/apns/webpush)
│   │   ├── push-send/index.ts
│   │   ├── payment-import/index.ts
│   │   ├── jobs-streaks/index.ts
│   │   ├── jobs-loyalty/index.ts
│   │   ├── jobs-digest/index.ts
│   │   ├── season-close/index.ts
│   │   └── federation-sync/index.ts
│   └── seed.sql                  # Standard-Punkteregeln, Badges, Ämter aus Factsheets
└── package.json
```

Lokale Entwicklung mit `supabase start` (lokale Instanz inkl. Edge Runtime), Deployment mit `supabase db push` und `supabase functions deploy`. Deno 2 unterstützt npm-Pakete.

---

## 5. Datenmodell (PostgreSQL / Supabase)

### 5.1 Kern-Entitäten (ER-Übersicht)

```
clubs ─┬─< teams ──< team_members >── club_members >── auth.users
       ├─< club_members (Mitgliedschaft, Rolle, Eintritt)
       ├─< join_requests (Beitritts-Anfragen mit Approval – myclub-Muster)
       ├─< guardians (Eltern ↔ Kinder – myclub-Muster)
       ├─< events ──< event_shifts (Helfer-Schichten) ──< attendance
       ├─< news (Club-/Team-/Verbands-News)
       ├─< point_rules (konfigurierbare Punktwerte)
       ├─< point_transactions (JEDE Punktebewegung, append-only)
       ├─< tasks ──< task_assignments (Aufgaben-Marktplatz)
       ├─< functionary_roles ──< functionary_assignments (Ämter + Factsheets)
       ├─< badges ──< member_badges
       ├─< challenges ──< challenge_progress
       ├─< rewards ──< reward_redemptions
       ├─< invoices (QR-Rechnung → Punkte bei pünktlicher Zahlung)
       ├─< notifications (In-App-Inbox, Push-Spiegel)
       └─< push_tokens (ntfy/APNs/WebPush-Tokens pro Gerät)
```

### 5.2 SQL-Schema (Kerntabellen)

```sql
-- ============ MANDANTEN & MITGLIEDER ============

create table clubs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  sport_type    text,                    -- 'unihockey', 'fussball', 'musik', ...
  season_start  date,                    -- z.B. 1. Juni
  settings      jsonb default '{}',      -- Feature-Flags, Theme (Whitelabel), Leaderboard-Optionen
  created_at    timestamptz default now()
);

create table club_members (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references clubs(id) on delete cascade,
  user_id       uuid references auth.users(id),   -- null bei Kind ohne eigenes Login
  role          text not null default 'member',  -- member|trainer|admin|superadmin
  member_since  date not null default current_date,
  display_name  text not null,
  avatar_url    text,
  leaderboard_opt_in boolean default true,
  is_minor      boolean default false,   -- Jugendschutz: Einwilligung nötig
  status        text default 'active',   -- active|passive|honorary|left
  unique (club_id, user_id)
);

-- Eltern/Kinder (myclub-Muster: parents-list, kids mit E-Mail-Verifikation)
create table guardians (
  parent_user  uuid not null references auth.users(id) on delete cascade,
  child_member uuid not null references club_members(id) on delete cascade,
  verified_at  timestamptz,
  primary key (parent_user, child_member)
);

-- Beitritts-Anfragen mit Approval (myclub-Muster: club/team requests)
create table join_requests (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     uuid references teams(id),
  user_id     uuid not null references auth.users(id),
  status      text default 'pending',    -- pending|approved|rejected
  decided_by  uuid references club_members(id),
  decided_at  timestamptz,
  created_at  timestamptz default now()
);

create table teams (
  id       uuid primary key default gen_random_uuid(),
  club_id  uuid not null references clubs(id) on delete cascade,
  name     text not null                -- 'Herren 1', 'Damen', 'U16'...
);

create table team_members (
  team_id   uuid references teams(id) on delete cascade,
  member_id uuid references club_members(id) on delete cascade,
  role      text default 'player',      -- player|trainer|staff
  primary key (team_id, member_id)
);

create table push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text unique not null,      -- ntfy-Topic / APNs-Token / WebPush-Subscription
  platform   text not null,             -- android_ntfy|ios_apns|webpush
  created_at timestamptz default now()
);

create table news (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid references clubs(id) on delete cascade,
  team_id      uuid references teams(id) on delete cascade,
  source       text default 'club',     -- club|team|federation
  title        text not null,
  body         text,
  image_url    text,
  published_at timestamptz default now()
);

-- ============ EVENTS, SCHICHTEN & ANWESENHEIT ============

create table events (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  team_id     uuid references teams(id),          -- null = Vereinsevent
  type        text not null,   -- training|match|gv|social|helper|meeting (0072)
  title       text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  location    text,
  geo         point,                              -- für MapLibre/swisstopo-Karte
  qr_token    text unique default encode(gen_random_bytes(16), 'hex'),
  point_rule_code text          -- welcher Punktwert bei Teilnahme greift
);

-- Helfer-Schichten (myclub-Muster: helferEvents/schichten)
create table event_shifts (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  title      text not null,              -- 'Festwirtschaft 10–14 Uhr'
  starts_at  timestamptz,
  ends_at    timestamptz,
  needed     int not null default 1,     -- benötigte Helfer:innen
  point_rule_code text                   -- Punktwert dieser Schicht
);

create table attendance (
  event_id     uuid references events(id) on delete cascade,
  shift_id     uuid references event_shifts(id),  -- null bei Training/Spiel
  member_id    uuid references club_members(id) on delete cascade,
  status       text not null default 'present', -- registered|present|excused|absent|substitute
  checked_in_at timestamptz default now(),
  confirmed_by uuid references club_members(id), -- Trainer-/OK-Bestätigung
  primary key (event_id, member_id)
);

-- ============ PUNKTESYSTEM ============

create table point_rules (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  pillar      smallint not null,        -- 1..7 (Säulen aus dem Konzept)
  code        text not null,            -- 'training_attend', 'invoice_on_time', ...
  label       text not null,
  points      int not null,
  is_active   boolean default true,
  meta        jsonb default '{}',       -- z.B. Streak-Länge, Max pro Woche
  unique (club_id, code)
);

-- Append-only Ledger: JEDE Punktebewegung, nie updaten/löschen → Korrektur = Gegenbuchung
-- (Migrationspfad: bestehende myclub-«helferPunkte» werden 1:1 hierhin überführt)
create table point_transactions (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references clubs(id) on delete cascade,
  member_id   uuid not null references club_members(id) on delete cascade,
  rule_code   text,
  points      int not null,             -- kann negativ sein (nur für Korrekturen!)
  season      text not null,            -- '2026/27'
  source_type text not null,            -- attendance|task|invoice|loyalty|manual|migration|...
  source_id   uuid,
  note        text,
  created_by  uuid,                     -- null = System
  created_at  timestamptz default now()
);
create index on point_transactions (club_id, member_id, season);

create materialized view member_points as
select club_id, member_id, season,
       sum(points) as season_points,
       sum(sum(points)) over (partition by club_id, member_id) as career_points
from point_transactions
group by club_id, member_id, season;

-- ============ AUFGABEN-MARKTPLATZ ============

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references clubs(id) on delete cascade,
  team_id      uuid references teams(id),
  title        text not null,
  description  text,
  category     text,                    -- kommunikation|material|infrastruktur|...
  points       int not null,
  task_type    text not null default 'oneoff', -- oneoff|recurring|season_role
  due_at       timestamptz,
  max_assignees int default 1,
  status       text default 'open',     -- open|claimed|submitted|done|expired
  created_by   uuid not null references club_members(id)
);

create table task_assignments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  member_id    uuid not null references club_members(id),
  claimed_at   timestamptz default now(),
  submitted_at timestamptz,
  proof_url    text,
  confirmed_at timestamptz,
  confirmed_by uuid references club_members(id),
  kudos        text,
  unique (task_id, member_id)
);

-- ============ FUNKTIONÄRSÄMTER ============

create table functionary_roles (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references clubs(id) on delete cascade,
  title          text not null,
  duties         jsonb not null,         -- Pflichtenheft (aus Factsheet)
  hours_per_season text,
  helper_points  numeric,                -- Vereinsskala (1–7)
  app_points_per_season int not null,    -- z.B. helper_points * 50
  contact_member uuid references club_members(id),
  max_holders    int default 1,
  is_paid        boolean default false,
  factsheet_url  text
);

create table functionary_assignments (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references functionary_roles(id) on delete cascade,
  member_id  uuid not null references club_members(id),
  season     text not null,
  confirmed  boolean default false,
  unique (role_id, member_id, season)
);

create view vacant_roles as
select r.*,
       r.max_holders - count(a.id) filter (
         where a.season = current_season(r.club_id)
       ) as open_slots
from functionary_roles r
left join functionary_assignments a on a.role_id = r.id
group by r.id
having r.max_holders > count(a.id) filter (
  where a.season = current_season(r.club_id)
);

-- ============ BADGES, RECHNUNGEN, NOTIFICATIONS ============

create table badges (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid references clubs(id),
  code      text not null,
  label     text not null,
  tier      text,
  criteria  jsonb not null
);

create table member_badges (
  member_id  uuid references club_members(id) on delete cascade,
  badge_id   uuid references badges(id) on delete cascade,
  awarded_at timestamptz default now(),
  primary key (member_id, badge_id)
);

-- QR-Rechnung (swissqrbill-Generierung im Client; PDF in Storage)
create table invoices (
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  member_id uuid not null references club_members(id),
  amount    numeric not null,
  reference text,                        -- QR-Referenz für camt.054-Matching
  due_date  date not null,
  paid_at   timestamptz,
  pdf_url   text,
  season    text not null
);
-- Trigger: paid_at gesetzt UND paid_at <= due_date → Punktebuchung 'invoice_on_time'

-- In-App-Inbox (Fallback-Kanal, erreicht 100% der Mitglieder)
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz default now()
);
```

### 5.3 Punkte-Engine als Postgres-Funktionen

Die gesamte Punktelogik lebt in SQL-Funktionen mit `security definer` – sie sind die **einzigen** Schreibpfade in den Punkte-Ledger:

```sql
-- Zentrale Buchungsfunktion
create function award_points(
  p_club uuid, p_member uuid, p_rule_code text,
  p_source_type text, p_source_id uuid default null
) returns void
language plpgsql security definer as $$
declare v_rule point_rules%rowtype;
begin
  select * into v_rule from point_rules
   where club_id = p_club and code = p_rule_code and is_active;
  if not found then return; end if;

  -- Rate-Limit aus meta (z.B. max 3x/Woche für Social-Posts)
  if (v_rule.meta->>'max_per_week') is not null then
    if (select count(*) from point_transactions
         where member_id = p_member and rule_code = p_rule_code
           and created_at > now() - interval '7 days')
       >= (v_rule.meta->>'max_per_week')::int
    then return; end if;
  end if;

  insert into point_transactions
    (club_id, member_id, rule_code, points, season, source_type, source_id)
  values
    (p_club, p_member, p_rule_code, v_rule.points,
     current_season(p_club), p_source_type, p_source_id);
end $$;

-- QR-Check-in: vom Client via supabase.rpc('check_in', {qr_token}) aufgerufen
create function check_in(p_qr_token text) returns json
language plpgsql security definer as $$
declare v_event events%rowtype; v_member club_members%rowtype;
begin
  select * into v_event from events where qr_token = p_qr_token;
  if not found then raise exception 'Ungültiger QR-Code'; end if;

  if now() not between v_event.starts_at - interval '30 min'
                   and coalesce(v_event.ends_at, v_event.starts_at + interval '3 h')
  then raise exception 'Check-in-Fenster geschlossen'; end if;

  select * into v_member from club_members
   where club_id = v_event.club_id and user_id = auth.uid();
  if not found then raise exception 'Kein Mitglied dieses Vereins'; end if;

  insert into attendance (event_id, member_id) values (v_event.id, v_member.id)
  on conflict do nothing;

  perform award_points(v_event.club_id, v_member.id,
                       coalesce(v_event.point_rule_code, 'training_attend'),
                       'attendance', v_event.id);
  return json_build_object('ok', true);
end $$;

-- Helfer-Schicht bestätigen (myclub-Muster confirmHelferEvent)
-- bzw. Aufgabe bestätigen: Rollenprüfung + award_points()
create function confirm_task(p_assignment uuid, p_kudos text default null)
returns void language plpgsql security definer as $$
  -- prüft Rolle des Aufrufers, setzt confirmed_at/kudos,
  -- ruft award_points(..., 'task', task_id) auf
$$;
```

### 5.4 Row Level Security (Multi-Tenancy)

```sql
alter table club_members enable row level security;

create function my_club_ids() returns setof uuid
language sql stable security definer as $$
  select club_id from club_members where user_id = auth.uid()
$$;

create policy "read own club" on club_members
  for select using (club_id in (select my_club_ids()));

-- point_transactions: lesbar für Vereinsmitglieder, NIE direkt beschreibbar
alter table point_transactions enable row level security;
create policy "read own club points" on point_transactions
  for select using (club_id in (select my_club_ids()));
-- KEINE insert/update/delete-Policy → Schreiben nur via security-definer-Funktionen
```

Admin-Aktionen prüfen zusätzlich `role in ('admin','superadmin')` bzw. `role = 'trainer'` – in der Policy oder in der jeweiligen Funktion. Eltern sehen die Daten ihrer Kinder via `guardians`-Join in den Policies.

---

## 6. Edge Functions (Deno)

```typescript
// supabase/functions/_shared/admin.ts
import { createClient } from "npm:@supabase/supabase-js@2";

export const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!   // umgeht RLS kontrolliert
);
```

```typescript
// supabase/functions/push-send/index.ts – ein Interface, vier souveräne Kanäle
import { supabaseAdmin } from "../_shared/admin.ts";
import { sendNtfy } from "../_shared/ntfy.ts";      // self-hosted ntfy (Android)
import { sendApns } from "../_shared/apns.ts";      // APNs HTTP/2 + JWT (iOS)
import { sendWebPush } from "../_shared/webpush.ts"; // VAPID (PWA)

Deno.serve(async (req) => {
  const { userIds, title, body, link } = await req.json();

  // 1. Immer: In-App-Inbox (erreicht 100%)
  await supabaseAdmin.from("notifications").insert(
    userIds.map((u: string) => ({ user_id: u, title, body, link }))
  );

  // 2. Push je nach Plattform des Tokens
  const { data: tokens } = await supabaseAdmin
    .from("push_tokens").select("*").in("user_id", userIds);

  for (const t of tokens ?? []) {
    if (t.platform === "android_ntfy") await sendNtfy(t.token, title, body);
    if (t.platform === "ios_apns")     await sendApns(t.token, title, body);
    if (t.platform === "webpush")      await sendWebPush(t.token, title, body);
  }
  return new Response("ok");
});
```

| Edge Function | Trigger | Aufgabe |
|---|---|---|
| `push-send` | DB-Webhook oder Invocation | ntfy / APNs / Web Push + In-App-Inbox |
| `payment-import` | camt.054-Upload durch Kassier:in oder PSP-Webhook | `invoices.paid_at` setzen (Matching via QR-Referenz) → Trigger bucht Punkte |
| `jobs-streaks` | pg_cron (nächtlich 03:00) | Trainingsserien erkennen, Boni buchen |
| `jobs-loyalty` | pg_cron (nächtlich 03:10) | Vereinstreue-Jubiläen (1/5/10/20 Jahre) |
| `jobs-digest` | pg_cron (So 18:00) | Wochenzusammenfassung als Push/Mail |
| `season-close` | Manuell durch Admin (mit Freigabe-UI) | Funktionärspunkte nach Bestätigung buchen, Leaderboard archivieren |
| `federation-sync` | pg_cron (Zeitplan wie myclub: Spiele tägl. 06:00, News stündlich, Teams/Clubs Mo früh) | Spielpläne/Resultate/News von Verbands-APIs importieren |

### Zeitsteuerung mit pg_cron + pg_net

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Leaderboard-View alle 5 Minuten aktualisieren (reines SQL, kein HTTP)
select cron.schedule('refresh-leaderboard', '*/5 * * * *',
  $$refresh materialized view concurrently member_points$$);

-- Nächtlicher Streak-Job: ruft die Edge Function via pg_net auf
select cron.schedule('streaks-nightly', '0 3 * * *', $$
  select net.http_post(
    url    := 'https://<project-ref>.supabase.co/functions/v1/jobs-streaks',
    headers:= jsonb_build_object('x-cron-secret',
                (select value from vault.decrypted_secrets where name = 'cron_secret'))
  )
$$);
```

Secrets (APNs-Key, ntfy-Zugang, VAPID-Keys, CRON_SECRET) via `supabase secrets set` bzw. Supabase Vault.

---

## 7. Schlüssel-Flows

### 7.1 QR-Check-in am Training
1. Trainer:in öffnet Event → App zeigt QR-Code (`qr_token`).
2. Mitglied scannt (ZXing-basiert, kein Google ML Kit).
3. Client ruft `supabase.rpc('check_in', ...)` → Funktion validiert Token + Zeitfenster, schreibt `attendance`, bucht Punkte.
4. Supabase Realtime pusht den neuen Punktestand live aufs Dashboard ✨.

### 7.2 Helfer-Event mit Schichten (myclub-Muster)
1. OK erstellt Event `type='helper'` mit `event_shifts` (Festwirtschaft 10–14, Aufbau, ...).
2. Mitglieder melden sich pro Schicht an (`attendance` mit `shift_id`, Status `registered`).
3. Nach dem Event bestätigt das OK die Anwesenheit → Statuswechsel auf `present` triggert `award_points()` mit dem Punktwert der Schicht.

### 7.3 Pünktliche Rechnungszahlung (QR-Rechnung, souverän)
1. Kassier:in erstellt `invoices`; Client generiert QR-Rechnung-PDF mit **swissqrbill** (inkl. QR-Referenz) → Storage.
2. Mitglied zahlt per Banking-App. Kassier:in lädt periodisch das **camt.054** der Bank hoch → `payment-import` matcht via QR-Referenz und setzt `paid_at`. (Kein PSP, keine Drittpartei.)
3. DB-Trigger: `paid_at <= due_date` → `award_points(..., 'invoice_on_time', ...)`.
4. 7 Tage vor Fälligkeit: pg_cron → `push-send`: «30 Punkte sichern 💰».

### 7.4 Aufgabe übernehmen & abschliessen
1. Mitglied claimt Aufgabe → `task_assignments` Insert (RLS prüft Slots).
2. Nachweis-Upload (`proof_url`) in Storage-Bucket `proofs/`.
3. Verantwortliche:r bestätigt → `confirm_task()` bucht Punkte + Kudos.
4. Trigger prüft Badge-Kriterien; nächtlicher Sweep fängt Restfälle ab.

---

## 8. Ionic React App: Aufbau

### Seitenstruktur (Tabs – Layout-Referenz: myclub)
```
🏠 Dashboard      → Punkte, Level, Streak, «Nächste Punkte», offene Aufgaben, News
📋 Marktplatz     → Aufgaben + vakante Ämter (Filter: Team, Kategorie, Frist)
🏆 Ranglisten     → Team-/Vereins-Leaderboard, Kategorien, Zeiträume
📅 Agenda         → Trainings, Spiele (Verbands-Sync), Events, Helfer-Schichten, QR-Check-in
👤 Profil         → Badges, Historie, Rechnungen (QR), Kinder (Eltern), Einstellungen
```

### Wichtige Plugins & Libraries (Google-frei)
| Baustein | Zweck |
|---|---|
| `@capacitor/push-notifications` nur iOS-Registrierung (APNs); Android: **UnifiedPush/ntfy-SDK** | Push ohne FCM |
| **ZXing/html5-qrcode** (WebView) | QR-Check-in ohne Google ML Kit |
| **MapLibre GL** + swisstopo/OSM-Tiles | Hallen-/Platzkarte |
| `@capacitor/preferences` | Session/Cache persistent |
| `@capacitor/share` | Badges/Erfolge teilen |
| `@capacitor/app` | Deep Links (Magic-Link-Login) |
| **react-i18next** | DE/FR/IT/EN (myclub: ngx-translate) |
| **swissqrbill** | QR-Rechnungs-PDF (aus myclub übernommen) |

### Auth-Hinweise
- **Magic Link** als Default – Deep-Link-Handling in Capacitor (`appUrlOpen` + `exchangeCodeForSession`).
- E-Mail/Passwort als Fallback, **Passkeys** sobald verfügbar.
- Kein Google-/Apple-Login → keine «Sign in with Apple»-Pflicht.
- Onboarding: Einladungslink/QR **oder** Beitritts-Anfrage mit Admin-Approval (`join_requests`, myclub-Muster).

### Offline-Strategie (MVP-tauglich)
- Lesecache via TanStack Query + `@capacitor/preferences`.
- Check-ins offline puffern und bei Reconnect via RPC nachsenden (serverseitige Validierung).

---

## 9. Supabase-Featureübersicht

| Feature | Einsatz |
|---|---|
| **Auth (GoTrue)** | Magic Link, E-Mail/Passwort, später Passkeys; eigener Schweizer SMTP |
| **Postgres + RLS** | Multi-Tenancy, Punkte-Engine, gesamte Geschäftslogik |
| **Edge Functions (Deno)** | Push (ntfy/APNs/VAPID), camt.054-Import, Jobs, Verbands-Sync |
| **pg_cron + pg_net** | Zeitpläne (View-Refresh, nächtliche Jobs, Digest, Sync) |
| **Realtime** | Live-Leaderboard, Punkte-Ticker, neue Aufgaben, In-App-Inbox |
| **Storage** | `factsheets/`, `proofs/`, `avatars/`, `badges/`, `invoices/` (QR-PDFs) |
| **Vault / Secrets** | CRON_SECRET, APNs-Key, ntfy-Zugang, VAPID-Keys |
| **Deployment** | Option A: Managed EU (Zürich) · Option B: Self-hosted auf Schweizer Cloud (voll souverän) |

---

## 10. Sicherheit & Manipulationsschutz

- **Punkte-Ledger append-only**: Korrekturen nur als Gegenbuchung, volle Nachvollziehbarkeit.
- **Kein Client-Write auf Punkte**: einziger Pfad sind `security definer`-Funktionen mit eigener Validierung.
- **QR-Tokens** mit Zeitfenster und Rotation pro Event.
- **Rate-Limits in `point_rules.meta`**, geprüft in `award_points()`.
- **Edge Functions abgesichert**: Cron nur mit `CRON_SECRET`, Payment-Import nur für Rolle `admin`/Kassier.
- **Rollenprüfung serverseitig** (RLS/Funktionen), nie nur im Frontend.
- **Jugendschutz**: `is_minor` + `guardians` → Eltern-Einwilligung, Leaderboard nur mit Opt-in, keine öffentlichen Profile.
- **Datensouveränität**: alle Komponenten Open Source, Exit-Fähigkeit auf Schweizer Self-Hosting jederzeit gegeben.

---

## 11. Umsetzungs-Reihenfolge (MVP)

1. **Supabase-Projekt** aufsetzen (Region Zürich), Migrationen `0001–0005` + Seed (Standard-Punkteregeln, Badge-Katalog, Ämter-Templates aus den Factsheets)
2. **Ionic React Scaffold** mit Auth-Flow (Magic Link + Deep Links), Tab-Layout nach myclub-Vorbild, Club-Onboarding (Einladungslink + `join_requests`)
3. **Events + QR-Check-in (ZXing) + `check_in()`-RPC** – der Kern-Loop: Training besuchen → Punkte sehen
4. **Dashboard + Vereins-Leaderboard** (Materialized View + Realtime + pg_cron-Refresh)
5. **Push-Setup** (In-App-Inbox zuerst, dann ntfy/APNs/VAPID) + erster Cron-Job (`jobs-streaks`)
6. **Aufgaben-Marktplatz** inkl. Funktionärsämter mit Vakanz-View + Helfer-Schichten
7. **Rechnungsmodul** (swissqrbill + camt.054-Import)
8. Pilotverein onboarden 🚀

---

## 12. Ergänzungen aus dem offiziellen Requirements-Katalog (docs/, 2026-07-17)

Abgleich mit `vision.md`, `requirements.md`, `use_cases.md`, `entity_model.md` – Details im Dokument «Abgleich Vorgaben myclub». Schema- und Funktions-Ergänzungen:

```sql
-- Beitragsverwaltung (PRO, FR-063–070; Entities CREDITOR/SURCHARGE/INVOICE_POSITION)
create table creditors (        -- QR-Rechnungs-Absender pro Verein
  club_id uuid primary key references clubs(id) on delete cascade,
  name text, street text, zip text, city text, country text default 'CH',
  qr_iban text not null
);
create table invoice_periods (  -- z.B. «Jahresbeitrag 2027»
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  title text not null, season text not null, due_date date
);
create table surcharges (       -- Zuschläge/Abzüge pro Mitglied/Team
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  label text not null, amount numeric not null
);
create table invoice_positions (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  label text not null, amount numeric not null
);
alter table invoices add column period_id uuid references invoice_periods(id);
alter table teams add column annual_fee numeric;          -- FR-040

-- Trainings-Vollausbau (FR-024–030)
create table event_series (id uuid primary key default gen_random_uuid(),
  club_id uuid, team_id uuid, rule jsonb not null);       -- Wiederholungsregel
alter table events add column series_id uuid references event_series(id);
alter table events add column cancelled_reason text;      -- Absage mit Grund
alter table events add column capacity_needed int;        -- FR-031 Teilnehmerbedarf
alter table events add column closed boolean default false;
create table exercises (id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  title text, description text, media_url text);
create table event_exercises (event_id uuid references events(id) on delete cascade,
  exercise_id uuid references exercises(id) on delete cascade,
  sort int, primary key (event_id, exercise_id));

-- Meisterschaft (FR-052/056)
create table lineups (game_event_id uuid references events(id) on delete cascade,
  member_id uuid references club_members(id), sort int,
  primary key (game_event_id, member_id));

-- Benachrichtigungen & Privacy (FR-014/015)
create table notification_prefs (user_id uuid references auth.users(id) on delete cascade,
  channel text, category text, enabled boolean default true,
  primary key (user_id, channel, category));
alter table club_members add column privacy jsonb default '{}';  -- hide_email/hide_phone

-- Vereinslinks & Abo-Gate (FR-047/075)
create table club_links (id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  label text, url text, kind text, sort int);
alter table clubs add column subscription_status text default 'active';
```

Neue Edge Functions / RPCs:

| Baustein | Vorgabe | Zweck |
|---|---|---|
| `js-export` (Edge Function) | FR-071, C-005 | J+S-/AWK-CSV aus `attendance` + Personendaten – ohne Doppelerfassung |
| `member-export` (Edge Function) | FR-049 | Excel/CSV-Export mit konfigurierbaren Feldern |
| `delete_account()` (RPC) | FR-006, C-010 | Kontolöschung (Store-Pflicht): anonymisiert Mitglied, löscht Auth-User, Punktehistorie bleibt anonym |
| `remind_undecided()` (RPC → push-send) | FR-029/034 | Erinnerung an Unentschlossene – zugleich Gamification-Nudge |
| `convert_event_to_helper()` (RPC) | FR-035 | Event → Helfer-Event mit Schichten |
| Abo-Gate | FR-075 | `subscription_status != 'active'` → RLS-/App-Sperre mit Hinweis-Modal |

Weitere übernommene Vorgaben: QR-Referenz mit MOD10-Prüfziffer nach SIX-Spez (C-004, PDF in docs/), NFR-Ziele (Kaltstart ≤3s, Listen ≤2s@500, Push ≤60s, ≥500 Mitglieder), Lizenz EUPL v1.2 (C-008), Out-of-Scope-Abgrenzung (kein Chat, kein öffentlicher Bereich, keine Buchhaltung, kein Verbands-Write-back). White-Label wechselt von 12 Build-Konfigurationen (C-011) zu Laufzeit-Theming aus `clubs.settings`.

---

## 13. MVP-Schnitt (übersteuert Teile der Abschnitte 5, 6 und 12)

Gemäss Dokument «MVP-Scope myclub»:

- **Billing ausgelagert**: `creditors`, `invoice_periods`, `invoice_positions`, `surcharges` sowie die volle `invoices`-Logik ziehen in das eigenständige Supabase-Projekt **myclub-billing** um. In der App verbleibt nur ein Spiegel:
  ```sql
  create table invoice_refs (          -- read-only Spiegel aus Billing-Webhooks
    id uuid primary key,               -- = Billing-Invoice-ID
    club_id uuid not null references clubs(id) on delete cascade,
    member_id uuid not null references club_members(id) on delete cascade,
    amount numeric, due_date date, status text,   -- open|paid|overdue
    paid_at timestamptz, detail_url text          -- signierte Billing-URL
  );
  ```
  Neue Edge Function `billing-events` (ersetzt `payment-import` in der App): verarbeitet `invoice.created/paid/overdue`, aktualisiert `invoice_refs` und bucht bei fristgerechter Zahlung `award_points('invoice_on_time')`.
- **Ein Punkte-Ledger**: Helferpunkte-Konto und Soll-/Schwellwert-Reporting entfallen; Schicht-Bestätigungen buchen direkt in `point_transactions` (Säule 3). Vorstands-Reporting = Leaderboard-Filter nach Säule.
- **Verbands-Sync per API-Key** (swiss unihockey neu wie Handball):
  ```sql
  create table federation_connections (
    club_id uuid not null references clubs(id) on delete cascade,
    federation text not null,          -- 'swiss_unihockey' | 'handball_ch' | ...
    api_key_secret text,               -- Referenz auf Vault-Secret
    status text default 'pending',     -- pending|active|error
    last_sync_at timestamptz,
    primary key (club_id, federation)
  );
  ```
  `federation-sync` iteriert über aktive Verbindungen statt über einen globalen Katalog; der Presync aller Verbandsvereine und das E-Mail-Claiming entfallen ersatzlos – der gültige API-Key ist die Verifikation.
- **Vereinsart-offen**: `clubs.sport_type` wird zu `clubs.club_kind` (sport|music|culture|youth|neighborhood|other) + frei konfigurierbare Terminologie-Labels in `clubs.settings` («Training»/«Probe»/«Anlass»).
- **Post-MVP verschoben**: `exercises`, `event_exercises`, `lineups`, J+S-/Mitglieder-Export, `guardians`-Flow, `club_links`, Badges/Challenges/Ämter-Tabellen bleiben im Schema-Entwurf dokumentiert, werden aber erst in den Inkrementen M4+ migriert.

---

## 14. Vereins-Gesundheit & Frühwarnsystem (Kern, gemäss MVP-Scope §11.4)

```sql
-- Wertdimensionen pro Mitglied (normalisiert 0–100) + Team-/Vereinsschnitt fürs Spider-Diagramm
create materialized view member_value_dimensions as
select m.club_id, m.id as member_id, s.season,
       norm(sum(points) filter (where pillar in (1,2,4))) as engagement,
       norm(sum(points) filter (where pillar in (3,7)))   as volunteering,
       norm(sum(points) filter (where pillar = 6))        as finance,
       norm(sum(points) filter (where pillar = 5))        as network,
       norm(extract(year from age(current_date, m.member_since))) as loyalty
from club_members m
join point_transactions t on t.member_id = m.id
join point_rules r on r.club_id = t.club_id and r.code = t.rule_code
group by m.club_id, m.id, t.season;
-- Team-/Vereins-Durchschnitte als einfache Aggregat-Views darauf.

-- Frühwarn-Signale: verfallen, keine Akte (Anti-Überwachung by Design)
create table health_signals (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references clubs(id) on delete cascade,
  member_id    uuid not null references club_members(id) on delete cascade,
  team_id      uuid references teams(id),
  signal_type  text not null,      -- attendance_drop|streak_broken|silent_churn|no_response|invoice_overdue
  severity     text not null,      -- info|attention|urgent  (Ampel)
  suggestion   text,               -- «Kurzes Gespräch am Donnerstag?»
  status       text default 'open',-- open|in_contact|resolved
  detected_at  timestamptz default now(),
  expires_at   timestamptz not null -- Auto-Verfall (z.B. Saisonende); gelöste/abgelaufene werden GELÖSCHT
);

-- Hinweis-Routing pro Verein konfigurierbar (Trainer + Sportchef + Vorstand)
create table health_alert_routing (
  club_id      uuid not null references clubs(id) on delete cascade,
  signal_type  text not null,
  recipient_role text not null,    -- trainer|sportchef|admin  (trainer: nur eigenes Team via RLS)
  primary key (club_id, signal_type, recipient_role)
);
alter table club_members add column health_opt_out boolean default false;  -- Transparenz-Seite
```

Durchsetzung der Leitplanken in der Architektur (nicht im Frontend):
- **RLS-Reichweite**: Trainer:innen lesen `health_signals` nur für Teams, in denen sie `role='trainer'` sind; `sportchef` bereichsweise; `admin` vereinsweit. Mitglieder lesen nur die eigenen Signale (Transparenz-Seite «Was sieht mein Verein?»).
- **Nur Teilnahme-Daten**: Der nächtliche pg_cron-Sweep (`run_health_sweep()`) liest ausschliesslich `attendance`, RSVP-Status und `invoice_refs.status`. Es existieren keine Tabellen für App-Nutzung, Lesebestätigungen oder Standort – was nicht erfasst wird, kann nicht missbraucht werden.
- **Kein Export, keine Sortierung nach Health**: keine entsprechenden RPCs/Endpunkte; `health_signals` ist von `member-export` ausgeschlossen.
- **Verfall statt Akte**: `expires_at`-Cleanup löscht physisch (kein Soft-Delete); `point_transactions` bleibt davon unberührt (Punkte sind Wertschätzung, keine Überwachung).
- **Opt-out**: `health_opt_out=true` → keine individuellen Signale; Mitglied fliesst nur anonym in Team-/Vereins-Aggregate ein.

---

## 15. «Stimme»: Sprachmemos & Feedback (gemäss MVP-Scope §12)

```sql
create table voice_notes (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs(id) on delete cascade,
  author_member_id uuid references club_members(id) on delete set null,
                       -- NULL bei anonym: Autorschaft wird NIE gespeichert
  kind             text not null,    -- self_reflection|coach_log|feedback|anonymous
  target_member_id uuid references club_members(id),   -- gerichtetes Feedback an Person
  target_role      text,            -- oder an Rolle: trainer|sportchef|admin
  target_team_id   uuid references teams(id),
  transcript       text not null,   -- von Absender:in geprüft/editiert vor Versand
  audio_url        text,            -- optional; Standard: nach Transkription gelöscht (TTL-Job)
  status           text default 'open',   -- open|in_progress|answered|resolved
  response         text,            -- Antwort des Empfängers (auch im anonymen Faden)
  converted_task_id uuid references tasks(id),
  anon_token_hash  text,            -- Hash des lokalen Ticket-Tokens → anonymer Zwei-Weg-Faden
  created_week     text not null,   -- 'KW31/2026' – bei anonym NUR Kalenderwoche (De-Anon-Schutz)
  created_at       timestamptz      -- bei anonym: NULL (kein präziser Zeitstempel!)
);
```

RLS-Kernregeln:
- `self_reflection`/`coach_log`: **nur** `author_member_id = eigene ID` liest – auch Admins nicht (strikt privat).
- `feedback`: Autor:in + adressierte Person/Rolle (Rollen via Team-/Vereins-Scope).
- `anonymous`: nur die konfigurierten Empfänger-Rollen lesen; Antworten werden über `anon_token_hash` abgeholt (RPC `read_anon_thread(token)` – kein Login-Bezug); keine Insert-Spalte für Autorschaft vorhanden → Anonymität ist Schema-, nicht Policy-Eigenschaft.

Pipeline & Funktionen:
| Baustein | Zweck |
|---|---|
| Client-Aufnahme (MediaRecorder/Capacitor) | max. 3 Min; für private Kinds **On-Device-Transkription** (whisper.cpp klein) – Audio verlässt das Gerät nicht |
| Edge Function `transcribe` → self-hosted **faster-whisper** (Schweizer Infra, geteilt) | Server-Transkription für adressierte Memos; Sprachen DE/FR/IT/EN |
| `voice-cleanup` (pg_cron) | löscht `audio_url`-Objekte nach Transkription bzw. TTL; mahnt unbeantwortete anonyme Anliegen beim Vorstand an (Listen-up-Pflicht) |
| RPC `convert_note_to_task()` | Transkript → Aufgabe im Marktplatz (Titel aus erster Zeile, Beschreibung = Transkript) |
| Rate-Limit | in `award_points`-Manier serverseitig: Fair-Use pro Mitglied/Monat |

Bewusst NICHT vorhanden (Anti-Überwachung, konsistent zu §14): kein Schlagwort-Scan über Transkripte, kein Export von voice_notes, keine Volltextsuche für Admins über fremde Notizen, keine Verknüpfung anonymer Memos mit Health-Signalen.

---

## 16. Sitzungs-Anbindung (gemäss MVP-Scope §13)

```sql
-- Sitzungen = events (type='meeting'); Teilnehmerkreis über Ämter statt Namenslisten
alter table events add column audience_role_ids uuid[];   -- functionary_roles → Einladung an Amts-Inhaber:innen
-- Auflösung zur Einladungszeit: functionary_assignments der aktuellen Saison

create table meeting_inputs (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references clubs(id) on delete cascade,
  body              text not null,                     -- Text-Input ODER Transkript
  source_voice_note_id uuid references voice_notes(id),-- via «Stimme» (auch anonym)
  author_member_id  uuid references club_members(id),  -- NULL bei anonym (Schema wie §15)
  committee_role_ids uuid[] not null,                  -- Zielgremium über Ämter (z.B. Vorstand)
  meeting_event_id  uuid references events(id),        -- NULL = laufende Bearbeitung; gesetzt = «an Sitzung mitgenommen»
  status            text default 'open',               -- open|scheduled|in_progress|answered|declined
  decision_response text,                              -- dokumentierte Antwort (2–3 Sätze)
  responded_at      timestamptz,
  responded_by      uuid references club_members(id),
  published_news_id uuid references news(id),          -- optional: «Aus dem Vorstand»
  converted_task_id uuid references tasks(id),         -- Folge-Artefakt 1: Helferaufgabe
  functionary_action jsonb                             -- Folge-Artefakt 2: {action: 'open_vacancy'|'assign'|'update_factsheet', role_id}
);
```

Funktionen & Regeln:
- RPC `submit_meeting_input()` (Text oder aus voice_note), `schedule_input(meeting_event_id)`, `answer_input(response, publish?)` – beim Beantworten: Rückmeldung an Einreicher:in (persönlich via Inbox/Push, anonym via `anon_token_hash`-Faden), optional News-Insert `source='board'` («Aus dem Vorstand»).
- Sitzungs-Sammelansicht = Query: `meeting_inputs where meeting_event_id = X and status in ('scheduled','in_progress')` **plus** `vacant_roles` **plus** offene Helfer-Schichten – reine Leseansicht, kein Sitzungs-Workflow.
- Anmahnung unbeantworteter Inputs über den bestehenden `voice-cleanup`/Listen-up-Cron (§15).
- **Bewusst kein Schema für**: Traktanden, Protokolle, Beschlüsse ausserhalb `decision_response`, freie Action-Items – Folge-Artefakte sind auf `converted_task_id` und `functionary_action` beschränkt (Scope-Schutz per Schema, analog Anti-Überwachung by Design).
- RLS: Inputs liest das Zielgremium (Ämter-basiert) + Autor:in; `decision_response` nach Publikation vereinsweit über die News.

---

## 17. Kontext-Check-ins (gemäss MVP-Scope §12.6)

```sql
create table checkin_prompts (          -- Fragenkatalog, pro Verein/Team anpassbar
  id        uuid primary key default gen_random_uuid(),
  club_id   uuid not null references clubs(id) on delete cascade,
  context   text not null,   -- training_attended|match_lineup|match_bench|helper_shift
  question  text not null,
  scale     text not null,   -- emoji5|stars5|freetext|voice
  sort      int,
  is_active boolean default true
);

create table checkin_responses (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references clubs(id) on delete cascade,
  member_id    uuid not null references club_members(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  prompt_id    uuid not null references checkin_prompts(id),
  value_num    smallint,              -- Skalenwert
  value_text   text,                  -- Freitext/Transkript (Einsatz-Feedback)
  voice_note_id uuid references voice_notes(id),
  visibility   text not null default 'private',  -- private|shared_trainer|event_organizer
  created_at   timestamptz default now(),
  unique (member_id, event_id, prompt_id)
);
```

Regeln (per Schema/RLS/Job durchgesetzt):
- **Trigger**: Prompt erscheint nur bei passendem Kontext (attendance vorhanden; `match_lineup` via lineups; `match_bench` via attendance.status='substitute'). **Kein Prompt ohne Teilnahme** – es existiert kein `absent`-Kontext (Chilling-Effekt-Schutz per Schema).
- **Sichtbarkeit**: `private` → RLS nur Autor:in; `shared_trainer` nur durch aktiven Entscheid des Mitglieds (RPC `share_checkin()`); `event_organizer` für Einsatz-Feedback (optional anonym → member_id-lose Kopie analog §15).
- **Aggregation mit Mindestgruppe**: View `team_mood` liefert Durchschnitt/Trend **nur wenn n ≥ 5** Antworten im Zeitfenster (`having count(*) >= 5`) – sonst NULL. De-Anonymisierung kleiner Teams per Query-Design ausgeschlossen.
- **Selbst-Nudge statt Weiterleitung**: Nächtlicher Job erkennt anhaltend tiefe *eigene* Werte und benachrichtigt **nur das Mitglied** («Magst du das teilen?») – kein Signal an Dritte ohne `share_checkin()`.
- **Keine Punkte**: kein `award_points`-Aufruf im Check-in-Pfad (Gaming-/V7-Schutz); Frequenz-Deckel max. 1 Check-in-Serie pro Mitglied/Tag.
- Team-Stimmungstrend fliesst als aggregiertes (nie individuelles) Zusatzsignal in die Team-Health-Ansicht (§14).

---

## 18. Manifest-Korrekturen K1–K7 (gemäss MVP-Scope §14)

```sql
-- K6c Vereins-DNA: erdet alle KI-Funktionen und das Onboarding
alter table clubs add column dna jsonb default '{}';
-- { why: '...', values: [...], tone: 'du/Sie, herzlich…', traditions: [...], vocabulary: {training:'Probe',…} }

-- K3a Warum-Pflichtfeld (Publikation ohne Sinnzusammenhang unmöglich)
alter table tasks add column why text not null default '' check (length(why) > 0 or status = 'draft');
alter table events add column why text;              -- Pflicht für type in ('helper','gv','social') per Trigger
alter table functionary_roles add column why text;   -- «Wem hilft dieses Amt?»

-- K3b Beitrags-Profil: Anfrage statt Abfrage
create table member_contribution_profile (
  member_id    uuid primary key references club_members(id) on delete cascade,
  interests    text[],           -- 'kommunikation','material','events','betreuung',…
  strengths    text,             -- Freitext/Transkript («Was wäre für dich ein sinnvoller Beitrag?»)
  time_budget  text,             -- 'einmalig'|'monatlich'|'saisonal'
  updated_at   timestamptz default now()
);
-- Matching: tasks.category / functionary_roles ↔ interests → persönliche Vorschläge («Passt zu dir»)

-- K4 Nachfolge & Verantwortungsverteilung
alter table functionary_assignments add column since date;
alter table functionary_assignments add column successor_member_id uuid references club_members(id);
alter table functionary_assignments add column succession_planned boolean default false;
-- View responsibility_concentration: Anteil Mitglieder, die 80% der Säule-3/7-Punkte tragen (pro Saison)
-- View succession_watch: Ämter mit since < now()-interval 'x years' and succession_planned = false

-- K1 Verbindungs-Quote (Messaging-Zähler pro Verein)
create table club_messages_log (
  club_id  uuid not null references clubs(id) on delete cascade,
  kind     text not null,        -- 'connection' (news, board_answer, kudos, pulse, thanks) | 'call' (vacancy, helper_request, task_push)
  sent_at  timestamptz default now()
);
-- Health-Sweep: ratio connection/call (rollend 6 Wochen) + Wochen seit letztem Puls → Vorstands-Signal;
-- optionale sanfte Sperre in push-send: kind='call' nur wenn Puls in den letzten 14 Tagen versendet

-- K2 Vereins-Puls (ersetzt jobs-digest): Edge Function pulse-compose
--   Quellen: events (nächste 14 Tage), meeting_inputs.decision_response (letzte 2 Wochen),
--   tasks/vacant_roles (offen, gematcht auf Beitrags-Profil) → Entwurf → Vorstands-Freigabe (2 Min) → push-send
-- K5 Vorstands-Signale: health_signals.signal_type erweitert um
--   'comms_pause','connection_ratio','inputs_unanswered','succession_gap' mit member_id = NULL (Vereinsebene)
-- K6b Entlastungs-Test: kein Schema – Gate im Produktprozess (Feature-Template mit Zeit-Bilanz Vorstand)
-- K7 Vereins-Tempo: clubs.settings.enabled_modules jsonb; Aktivierungs-Vorschläge regelbasiert
--   (z.B. active_members >= 40 → 'functionary_roles' vorschlagen), Defaults für point_rules/definitions/routing
```

Konsistenz-Hinweise: Vorstands-Signale (K5) laufen über denselben `health_signals`-Mechanismus mit `member_id = NULL` und unterliegen denselben Regeln (Verfall, keine Akte, Signal statt Urteil). Die Verbindungs-Quote ist eine Vereins-Kennzahl, nie eine Personen-Kennzahl.
