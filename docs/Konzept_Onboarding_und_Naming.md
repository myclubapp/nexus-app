# Konzept: Onboarding-Redesign, Team-first-Wachstum & Naming
> **Markenentscheid 16.09.2026**: Produkt- und Dachmarke ist **nexus – rethink communities**. «myclub»/«my-club» bezeichnet in diesem Dokument ausschliesslich die **Alt-App** (Ionic Angular/Firebase) und deren Bestand; Modul- und Preisnamen sind auf nexus umgestellt. Zielsegment: **Vereine nach Schweizer Recht** (Sport zuerst, dann Musik/Kultur/Jugend/Quartierverein) – keine NGOs, keine Unternehmen.

## Analyse der myclub-App und Vorschlag für die neue App

---

## 1. Ist-Analyse: Der heutige Onboarding-Flow

### 1.1 Wie es heute funktioniert (aus App- und Backend-Code)

**Neuer User → Verein beitreten:**
```
Registrierung → onboarding-club: Suche über ALLE Vereine
(gruppiert nach Verband: Unihockey, Volleyball, Handball, Turnen,
Sport, Kultur, Andere) → Klick auf Verein → clubRequest wird erstellt
→ Push + E-Mail an ALLE Club-Admins → Admin prüft und genehmigt
→ User ist Club-Mitglied → DANACH: separater teamRequest nötig
→ nochmals Warten auf Genehmigung → erst jetzt im Team
```

**Neuer Verein aktivieren (Claiming):**
```
Vereine existieren vorab als inaktive Einträge (Verbands-Sync).
User stellt clubRequest an inaktiven Verein
→ System prüft: Ist die E-Mail des Users in der contacts-Liste
  des Vereins (Verbandsdaten)?
→ JA: Club wird aktiviert, User wird automatisch Admin
→ NEIN: Request wird stillschweigend abgelehnt
  («Bitte info@my-club.app kontaktieren»)
```

**Manueller neuer Verein:** FAB-Button «+» → create-new-club → Club wird sofort aktiv, Ersteller wird Admin.

### 1.2 Identifizierte Schwachstellen

| # | Problem | Beleg im Code | Wirkung |
|---|---|---|---|
| 1 | **Pull-Modell statt Push**: Mitglieder müssen den Verein suchen und eine Anfrage stellen – die Hürde liegt beim Mitglied | `onboarding-club.page.html`: Suchfeld über alle Vereine, `joinClub()` → Request | Hohe Abbruchrate; jedes einzelne Mitglied erzeugt Admin-Arbeit |
| 2 | **Doppeltes Approval**: Club-Request UND Team-Request sind zwei getrennte Anfragen mit zwei Wartezyklen | `createClubRequest.ts` + `createTeamRequest.ts` als separate Flows | Mitglied wartet zweimal; Admins genehmigen zweimal; `requestTeamId` wird zwar mitgegeben, aber nicht automatisch aufgelöst |
| 3 | **Opakes Club-Claiming**: Aktivierung hängt am E-Mail-Match mit Verbands-Kontaktliste – schlägt der Match fehl (private vs. offizielle Adresse!), wird der Request kommentarlos abgelehnt | `createClubRequest.ts`: `contacts.where('email','==',…)`, sonst `approve:false` | Genau der von dir beschriebene Hauptfrust: Gründer scheitern ohne zu verstehen warum |
| 4 | **Öffentliche Anfragbarkeit**: Jeder registrierte User kann jedem Verein eine Beitrittsanfrage stellen | Suchliste zeigt alle Vereine aller Verbände | Dein Spam-/Sicherheitsrisiko; Admins erhalten Anfragen von Unberechtigten |
| 5 | **Benachrichtigungs-Rauschen**: Jede Anfrage löst Push + Mail an *alle* Club-Admins aus (bei Team-Requests zusätzlich an alle Team-Admins) | Loops über `admins`-Collections in beiden create-Funktionen | Admins stumpfen ab, Anfragen bleiben liegen |
| 6 | **Fragile Trigger-Kette**: Der Flow läuft über Firestore-Dokument-Trigger (write → onDocumentCreated → copy → onDocumentUpdated → …) | u.a. Tippfehler `db.collection('teamId')` statt `'teams'` in `approveTeamRequest.ts` | Schwer zu debuggen, eventual consistency, stille Fehler |
| 7 | **Kein Einladungsmechanismus**: Es gibt keinen Link/QR-Code, mit dem ein Admin Mitglieder aktiv einladen kann | Kein invite-Konzept in App oder Backend auffindbar | Der einfachste und sicherste Onboarding-Weg fehlt komplett |
| 8 | **Kein Team-only-Einstieg**: Einstieg setzt immer einen Verein voraus | Onboarding-Flow: Club zuerst, Team danach | Kleine Teams ohne Vereinsstruktur können nicht starten |

**Kernbefund:** Das heutige Modell macht *Anfragen* zum Standardweg und *Prüfung* zur Daueraufgabe. Das skaliert nicht und erzeugt genau die zwei Probleme, die du nennst: mühsames Onboarding für Berechtigte und gleichzeitig offene Türen für Unberechtigte.

---

## 2. Zielbild: Invite-first Onboarding

### 2.1 Das neue Grundprinzip

> **«Wer den Link hat, ist berechtigt. Wer keinen hat, braucht eine geprüfte Anfrage.»**

Die Beweislast wird umgedreht: Statt dass Fremde anklopfen und Admins prüfen müssen, laden Berechtigte aktiv ein. Der Einladungslink/QR-Code *ist* die Autorisierung – kürzester Weg für 95% der Fälle, und das Anfrage-Modell wird zum abgesicherten Ausnahmepfad.

### 2.2 Die vier Onboarding-Flows

**Flow A – Verein oder Team gründen (Ziel: unter 3 Minuten)**

```
1. Account erstellen (Magic Link – keine Passwort-Hürde)
2. Eine Frage: «Was möchtest du verwalten?»
   [ Ganzer Verein ]   [ Nur mein Team ]
3. Name + Sportart/Vereinstyp eingeben → FERTIG.
   Gründer:in ist Superadmin, Workspace ist sofort aktiv.
4. Direkt im Anschluss: «Lade jetzt deine Mitglieder ein»
   → Einladungslink/QR wird prominent angezeigt (Share-Sheet)
```

Entscheidend: **Keine Verifikation blockiert die Gründung.** Die Verbands-Anbindung (Spielpläne, Resultate) wird zum optionalen Schritt *nach* der Gründung:

```
Einstellungen → «Verband verbinden» → Verein aus Verbandsliste wählen
→ Verifikation transparent: (a) Mail an offizielle Verbands-Kontaktadresse
  mit Bestätigungslink, ODER (b) manuelle Prüfung mit sichtbarem Status
  («In Prüfung – wir melden uns innert 24h»)
→ Nach Bestätigung: «Verifizierter Verein»-Badge + Verbands-Sync aktiv
```

Damit wird das heutige stille Scheitern (Problem #3) durch einen sichtbaren, nachvollziehbaren Prozess ersetzt – und das Claiming eines vorab synchronisierten Vereins wird zum Feature statt zur Hürde: «Dein Verein ist schon im Verzeichnis – jetzt übernehmen.»

**Flow B – Mitglied via Einladung (Ziel: unter 60 Sekunden, Standardweg)**

```
Mitglied erhält Link/QR (WhatsApp, Mail, Aushang in der Garderobe)
→ Link öffnen → Name eingeben → Magic Link bestätigen
→ SOFORT Mitglied im richtigen Team mit der richtigen Rolle. Fertig.
```

Einladungslinks sind konfigurierbare Objekte:

| Eigenschaft | Optionen | Beispiel |
|---|---|---|
| **Scope** | Verein / bestimmtes Team | «U16-Einladung» landet direkt im U16-Team |
| **Rolle** | member / trainer / admin / parent | Trainer-Link für den neuen Coach |
| **Gültigkeit** | Ablaufdatum | Saisonstart-Link läuft Ende September ab |
| **Nutzungen** | max. Anzahl (1x bis unbegrenzt) | Einmal-Link für den neuen Kassier |
| **Approval** | sofort beitreten ODER «Link + Freigabe» | Für vorsichtige Vereine kombinierbar |
| **Widerruf** | jederzeit deaktivierbar | Link ist im Chat geleakt → sperren, neuen erzeugen |

Damit löst sich auch das Doppel-Approval-Problem (#2): Ein Team-Link erzeugt Club- UND Team-Mitgliedschaft in einem Schritt.

**Flow C – Beitritt ohne Einladung (abgesicherter Ausnahmepfad)**

Für den Fall «Ich bin neu im Dorf und will dem Verein beitreten»:

```
Suche → nur Vereine, die «öffentlich auffindbar» aktiviert haben
→ Anfrage MIT Pflicht-Nachricht («Wer bist du, warum möchtest du beitreten?»)
→ optional: Verifikationsfrage des Vereins («Wie heisst unser Trainingslokal?»)
→ genau EIN zuständiger Admin erhält die Anfrage (konfigurierbar)
→ Anfragen verfallen automatisch nach 30 Tagen
```

Schutzmechanismen gegen dein Spam-Risiko (#4):
- **Discoverability ist Opt-in**: Vereine sind standardmässig NICHT öffentlich suchbar. Wer nur mit Einladungen arbeiten will, ist für Fremde unsichtbar.
- **Rate-Limiting**: max. 3 offene Anfragen pro User, Cooldown nach Ablehnung.
- **Kein Rauschen**: Anfragen landen in einer Inbox mit Badge-Counter, nicht als Push an alle Admins (Behebung von #5).

**Flow D – Bulk-Onboarding (für den Vereinswechsel von Papier/Excel)**

```
Admin lädt Mitgliederliste hoch (CSV oder Verbands-Export)
→ System erstellt Mitglieder-Platzhalter (Name, Team, Rolle vorbefüllt)
→ pro Person wird eine persönliche Einladung generiert (Mail/Link-Liste)
→ Mitglied klickt → Account wird mit vorbefülltem Profil verknüpft
→ Dashboard zeigt Aktivierungsquote («34 von 80 Mitgliedern aktiv»)
```

Wichtig für die Gamification: Platzhalter-Mitglieder können bereits Punkte erhalten (z.B. Trainer erfasst Anwesenheit), bevor sie ihren Account aktiviert haben – nichts geht verloren, und der bestehende Punktestand ist ein Aktivierungsanreiz («Du hast schon 120 Punkte – hol sie dir!»).

### 2.3 Vergleich Alt vs. Neu

| Szenario | Heute (myclub) | Neu |
|---|---|---|
| Verein gründen | Anfrage an inaktiven Club, E-Mail-Match gegen Verbandsliste, bei Fehlschlag stille Ablehnung | Self-Service in 3 Min, Verbands-Verifikation optional & transparent danach |
| Mitglied tritt bei | Suchen → Club-Anfrage → warten → Team-Anfrage → warten | Link/QR → 60 Sekunden → drin (Club + Team in einem Schritt) |
| 80 Mitglieder onboarden | 80 einzelne Anfragen, 160 Genehmigungen | 1 CSV-Upload + 1 Linkversand, Aktivierungs-Dashboard |
| Unberechtigte Anfragen | Jeder kann jedem Verein Anfragen stellen | Nur bei Opt-in-Sichtbarkeit, mit Pflichtnachricht, Rate-Limit, Auto-Verfall |
| Admin-Aufwand | Dauerhafte Prüfarbeit + Benachrichtigungsflut | Einladen statt prüfen; Anfragen als seltene, gebündelte Ausnahme |

---

## 3. Team-first: «Start klein, wachse zum Verein»

### 3.1 Das Workspace-Modell

Dein Wunsch (Teams sollen eigenständig starten und später zum Vereins-Abo wachsen) lässt sich elegant lösen, wenn technisch **alles ein Club-Workspace ist** – nur in zwei Ausprägungen:

```
workspace_kind = 'club'   → voller Verein (Teams, Ämter, GV, Rechnungen, …)
workspace_kind = 'team'   → Team-Workspace: technisch ein Club mit genau
                            einem Team; Vereins-Features sind ausgeblendet
```

Vorteile dieser Modellierung:
- **Kein separates Datenmodell** für Teams-only – RLS, Punkte-Engine, Marktplatz, alles funktioniert identisch.
- **Upgrade = Umschalten, nicht Migration**: `team → club` blendet die Vereinsebene ein (weitere Teams, Funktionärsämter, GV-Events, Vereins-Leaderboard). Alle Daten (Punkte, Historie, Mitglieder) bleiben nahtlos erhalten.
- **Späteres Andocken**: Ein Team-Workspace kann in einen bestehenden Vereins-Workspace **einziehen** (Merge: Team + Mitglieder + Punktehistorie werden übertragen, Duplikate über E-Mail gematcht). Typischer Fall: Die U18 hat die App eingeführt, ein Jahr später übernimmt der Gesamtverein.

### 3.2 Wachstumspfad & Abo-Stufen

```
   GRATIS                TEAM                 VEREIN
┌───────────┐      ┌───────────────┐      ┌───────────────────┐
│ 1 Team    │      │ 1 Team        │      │ unbegrenzt Teams  │
│ bis 15    │ ───► │ unbegr. Mitgl.│ ───► │ Ämter, Rechnungen │
│ Mitglieder│      │ volle Gamific.│      │ GV, Vereins-Lead. │
│ Basis-    │      │ Helfer-Events │      │ Whitelabel,       │
│ Punkte    │      │ ~ CHF 9/Mt    │      │ Verbands-Sync     │
└───────────┘      └───────────────┘      │ ~ CHF 29–49/Mt    │
                                          └───────────────────┘
```

- Die Gratis-Stufe ist das Akquise-Werkzeug: Ein einzelner Trainer kann heute Abend starten.
- Der Übergang Team → Verein ist der zentrale Upsell-Moment – die App kann ihn aktiv vorschlagen («Ihr seid jetzt 3 Teams aus demselben Verein – zusammenführen?» via Matching gleicher Vereinsnamen/Domains).
- Preise sind Platzhalter zur Diskussion.

---

## 4. Naming-Analyse

### 4.1 Das Problem mit «TeamSpirit»

Deine Intuition stimmt: *TeamSpirit* betont die Team-Ebene, während dein Produktkern das **Vereinsleben** ist (GV, Ämter, Helfereinsätze, Vereinstreue – alles Club-, nicht Team-Konzepte). Zudem ist «Team Spirit» generisch, stark besetzt und markenrechtlich schwierig.

Gleichzeitig gilt: Der Name darf den Team-first-Einstieg nicht verhindern – das löst aber das Marketing («Starte mit deinem Team»), nicht der Produktname.

### 4.2 Kriterien

1. Verein/Klub im Fokus, nicht Team
2. Funktioniert in DE/FR/IT/EN (Schweizer Mehrsprachigkeit!)
3. Transportiert Spass/Wertschätzung (Gamification-Charakter)
4. Kurz, App-Store-tauglich, Domain realistisch verfügbar
5. Trägt auch Nicht-Sportvereine (Musik, Kultur, Pfadi)

### 4.3 Shortlist

| Name | Idee | Stärken | Schwächen |
|---|---|---|---|
| **ClubSpirit** | Direkte Korrektur von TeamSpirit | Club-Fokus, mehrsprachig, Gamification-Vibe bleibt | Etwas generisch |
| **myclub behalten** | Die neue App als myclub 2.0 | Bestehende Marke, User & App-Store-Historie, Name ist bereits club-fokussiert! | Alt-Image des umständlichen Onboardings haftet evtl. an |
| **Vereint** | Wortspiel Verein + vereint | Emotional stark, einzigartig | Nur Deutsch – fällt in FR/IT durch |
| **ClubLife** | Vereinsleben wörtlich | Beschreibt exakt den Fokus, mehrsprachig | Wenig Gamification-Charakter |
| **Clubup** | Club + Level-up | Kurz, Gamification drin, modern | Verwechslungsgefahr mit generischen «-up»-Namen |

### 4.4 Empfehlung ~~(überholt)~~

> **Überholt durch §4.6 (16.09.2026).** Dieser Abschnitt hielt fest, die neue App heisse
> «myclub». Das gilt nicht mehr – Produkt- und Dachmarke ist **nexus**. Der Abschnitt bleibt
> als Protokoll der Abwägung stehen.

> **Entscheid (aktualisiert):** Mit dem offiziellen Vision-Dokument (`docs/vision.md`, «Vision — myclub») ist die Frage geklärt: **Die neue App heisst myclub.** Marke, Domain (my-club.app) und Store-Präsenz werden weitergeführt; der Relaunch mit dem neuen Onboarding ist die Story. «TeamSpirit» bzw. «Spirit» bleibt allenfalls als Arbeitstitel des neuen Gamification-Moduls nutzbar.

Die ursprüngliche Abwägung (für die Akten): **ClubSpirit** wäre die konsequente Korrektur des Team-Fokus gewesen – die Weiterführung von **myclub** als etablierte, bereits club-fokussierte Marke war aber schon in der Analyse die risikoärmste Option und ist nun bestätigt.

---

## 5. Technische Umsetzung (Supabase, kompakt)

Ergänzungen zum bestehenden Architektur-Dokument:

```sql
-- Einladungslinks (Kern des Invite-first-Modells)
create table invite_tokens (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references clubs(id) on delete cascade,
  team_id      uuid references teams(id),          -- null = Vereinsebene
  role         text not null default 'member',     -- member|trainer|admin|parent
  token        text unique not null default encode(gen_random_bytes(12),'hex'),
  label        text,                               -- 'Saisonstart U16'
  expires_at   timestamptz,
  max_uses     int,                                -- null = unbegrenzt
  use_count    int default 0,
  requires_approval boolean default false,
  revoked_at   timestamptz,
  created_by   uuid references club_members(id)
);

-- Beitritt via Token: EINE Funktion statt Trigger-Kette
create function join_with_token(p_token text, p_display_name text)
returns json language plpgsql security definer as $$
  -- validiert: revoked_at is null, expires_at, use_count < max_uses
  -- legt club_members an (+ team_members falls team_id gesetzt)
  -- bei requires_approval: status 'pending' statt 'active'
  -- inkrementiert use_count atomar; gibt Club-/Team-Kontext zurück
$$;

-- Workspace-Modell & Sichtbarkeit
alter table clubs add column workspace_kind text default 'club';  -- club|team
alter table clubs add column discoverable boolean default false;   -- Opt-in!
alter table clubs add column verified_at timestamptz;              -- Verbands-Badge

-- Bulk-Import: club_members.user_id bleibt null bis zur Aktivierung;
-- invite_tokens mit max_uses=1 pro importiertem Mitglied (personalisiert)
```

Die gesamte heutige Trigger-Kaskade (Problem #6) kollabiert zu wenigen atomaren `security definer`-Funktionen (`join_with_token`, `decide_request`, `claim_federation_club`) – transaktional, testbar, ohne stille Fehler.

---

## 6. Migration von myclub

1. **Vereine & Teams**: 1:1-Export nach `clubs`/`teams` (aktive Clubs → `workspace_kind='club'`, `verified_at` gesetzt, wenn Verbands-Typ vorhanden).
2. **Mitglieder**: `userProfile` → `auth.users` + `club_members`; bestehende Logins per Magic Link reaktivieren.
3. **Offene Requests**: nicht migrieren – stattdessen erhalten betroffene User automatisch eine persönliche Einladung (sauberer Neustart).
4. **helferPunkte**: wie im Architektur-Dokument beschrieben in `point_transactions` überführen (`source_type='migration'`).

---

## 7. Zusammenfassung

Das heutige Onboarding scheitert an einem strukturellen Prinzip: Es macht die *Anfrage* zum Normalfall und die *Prüfung* zur Daueraufgabe – mühsam für Berechtigte, offen für Unberechtigte. Das neue Konzept dreht das um: **Einladungslinks als Standardweg** (60-Sekunden-Beitritt, Link = Berechtigung), Self-Service-Gründung ohne blockierende Verifikation, transparentes Verbands-Claiming statt stillem E-Mail-Matching, und ein abgesicherter Anfrage-Pfad nur für Vereine, die das explizit wollen. Das **Workspace-Modell** (Team = Club light) ermöglicht den kleinen Start mit nahtlosem Upgrade- und Merge-Pfad zum Vereins-Abo. Beim Naming ist die Abwägung entschieden: Produkt- und Dachmarke ist **nexus – rethink communities** (§4.6); «ClubSpirit» und die Weiterführung von «myclub» sind verworfen.

### 4.5 Entscheid vom 15.09.2026: Marke, Projekt, Arbeitstitel ~~(überholt)~~

> **Überholt durch §4.6 (16.09.2026).** Die Trennung «Marke myclub / Codename nexus» ist
> aufgehoben; nexus ist beides. Der Abschnitt bleibt als Protokoll stehen.

| Ebene | Name | Wo er erscheint |
|---|---|---|
| **Marke (Produkt)** | **myclub** | App-Stores, UI, Domain (my-club.app), Kommunikation, Kunden- und Vereinsgespräche |
| **Projektnamen (Technik)** | **nexus-app** (Client), **nexus-backend** (Supabase-Projekt) | Repositories, Pakete, CI/CD, Supabase-Projektnamen, Umgebungsvariablen, interne Dokumentation |
| **Arbeitstitel (abgelöst)** | ~~TeamSpirit~~ | Nur noch als historischer Verweis in den frühen Konzeptversionen; nicht mehr verwenden |

Regel: «nexus» ist ein reiner Codename und taucht nie in der Oberfläche oder gegenüber Vereinen auf. Weitere Dienste folgen der Konvention `nexus-<dienst>` (billing, calendar, gateway, js-connector); nach aussen heissen sie «nexus Billing», «nexus Kalender» usw.

**Ergänzung (Webseiten-Konzept)**: «Das Nexus-Prinzip» ist als öffentlicher Name der *Methode* hinter myclub zugelassen (lat. *nexus* = Verbindung) – «myclub, gebaut nach dem Nexus-Prinzip». Das Wort bezeichnet nach aussen nie das Produkt, sondern die drei Sätze: Verbindung vor Aufruf · Verantwortung anbieten statt ausschreiben · Jeden Beitrag sehen. nexus-app/nexus-backend bleiben reine Projektnamen.

**Aktualisierung 15.09.2026 (Positionierung «nexus – Rethink Communities»)**: nexus ist nun die **öffentliche Dach-Marke** für Denkweise, Manifest, Playbook und Plattform («Rethink Communities», getragen von liitu consulting). myclub bleibt die App-Marke für Vereine («die App zum Prinzip»); spätere Editionen für NGOs/Quartiere folgen nach Pilot. nexus-app/nexus-backend bleiben Codenamen. Die Regel «nexus erscheint nie nach aussen» ist damit aufgehoben – Details und Marken-Architektur im Dokument «Positionierung nexus Rethink Communities» §3.

### 4.6 Finaler Markenentscheid (16.09.2026) – **gültig**

| Ebene | Name |
|---|---|
| **Produkt- und Dachmarke** | **nexus – rethink communities** (Denkweise, Manifest, Playbook, Website, App, Dienste) |
| **Alt-App** | my-club – Legacy, wird migriert, nicht weiterentwickelt |
| **Zielsegment** | Vereine nach Schweizer Recht; Reihenfolge Sport → Musik/Kultur → Jugend → Quartier |
| **Code** | nexus-app · nexus-backend (unverändert, jetzt deckungsgleich mit der Marke) |

Damit sind §4.4 und §4.5 überholt. Offen: Domain, App-Store-Name, Bundle-ID (`ch.myclub.nexus` → z.B. `ch.nexus.app`), Deep-Link-Schema, neue Store-Listung vs. Update. Empfehlung: neue App im Store, Migration der Bestandsvereine per Einladungslink mit Punkte-Übernahme.
