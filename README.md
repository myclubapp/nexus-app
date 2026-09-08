# myclub nexus

Engagement-Plattform für Vereine. Ionic React 9 + Capacitor 8 für iOS, Android
und PWA, auf einem Supabase-Backend (Postgres, Auth, Edge Functions).

Der Leistungsschnitt steht in `docs/MVP_Scope_myclub.md`, der Stack in
`docs/Technische_Architektur_TeamSpirit.md`.

## Was drin ist

| Baustein | Stand |
|---|---|
| Auth per Magic Link, Deep Link auf iOS/Android | umgesetzt |
| Onboarding: Verein gründen oder Einladung einlösen | umgesetzt |
| Fünf Tabs: Start, Marktplatz, Ranglisten, Agenda, Profil | umgesetzt |
| Punkte-Ledger mit sieben Säulen, serverseitig gebucht | umgesetzt |
| QR-Check-in ohne Google ML Kit | umgesetzt |
| Aufgaben-Marktplatz mit Übernahme und Bestätigung | umgesetzt |
| Rangliste mit Opt-out | umgesetzt |
| DE/FR/IT/EN, geprüft durch `npm run i18n:check` | umgesetzt |
| White-Label-Theming zur Laufzeit aus `clubs.settings` | umgesetzt |
| Vereins-Gesundheit, «Stimme», Sitzungen, Billing, Verbands-Sync | Schema entworfen, UI offen |

## Voraussetzungen

- Node 22, npm 11
- Xcode 26 mit CocoaPods für iOS
- Android Studio mit SDK für Android
- Supabase CLI und Docker für das Backend

## Erste Schritte

```bash
# 1. Backend
supabase start                       # lokale Instanz inkl. Auth und Studio
supabase db reset                    # Migrationen aus supabase/migrations anwenden

# 2. App
cd app
npm install
cp .env.example .env.local           # URL und anon key eintragen
npm run dev                          # http://localhost:5173
```

Ohne ausgefüllte `.env.local` startet die App, zeigt aber einen Hinweis statt
des Logins.

## Auf dem Gerät

```bash
cd app
npm run ios                          # Build, Sync, Xcode öffnen
npm run android                      # Build, Sync, Android Studio öffnen
```

Der Magic Link kehrt über `ch.myclub.nexus://auth/callback` in die App zurück.
Diese URL muss in den Supabase-Auth-Einstellungen als Redirect erlaubt sein;
für die lokale Instanz steht sie bereits in `supabase/config.toml`.

## Struktur

```
app/                 Ionic React + Capacitor
supabase/migrations  Schema, Punktefunktionen, Row Level Security
docs/                Konzept, Architektur, MVP-Schnitt
```

Konventionen und Fallstricke stehen in `CLAUDE.md`.
