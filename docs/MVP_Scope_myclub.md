# MVP-Scope: myclub (neue App)
## Vereinfachung, Modulschnitt & Billing als eigenständiger Dienst

> Dieses Dokument ist der massgebende Leistungsschnitt für die neue App und **übersteuert** die
> entsprechenden Abschnitte in «Abgleich Vorgaben», «Konzept Gamification» und «Technische Architektur».
> Prinzip: **Zurück zu den Basics – jede Funktion muss sich ihren Platz im MVP verdienen.**

---

## 1. Die vier Vereinfachungs-Entscheide

| # | Entscheid | Wirkung |
|---|---|---|
| 1 | **Rechnungsstellung wird eigenständiger Dienst** («myclub Billing») | Die komplexeste Domäne (SIX-QR-Spez, MOD10, camt.054, Mahnwesen, Perioden, Positionen) verlässt die App – sauber integriert über API + Webhooks |
| 2 | **Helfer-Modul geht in der Gamification auf** | Kein separates Helferpunkte-Konto, kein Soll-/Schwellwert-Reporting mehr. Es gibt genau **einen** Punkte-Ledger: die Gamification. Helfer-Schichten bleiben als Event-Typ erhalten |
| 3 | **Verbands-Sync nur noch mit API-Key pro Verein** (swiss unihockey neu wie Handball) | Kein globaler Presync aller Verbandsvereine mehr, kein Vereinsverzeichnis, kein Claiming-Problem – der API-Key **ist** die Verifikation |
| 4 | **Vereinsart-offen von Tag 1** | Onboarding ohne Sport-Fokus: Sport-, Musik-, Kultur-, Quartier-, Jugendvereine – alles gleichberechtigt. Meisterschaft/Verband ist ein optionales Add-on, kein Kernkonzept |
| 5 | **Gamification Basic ist der Kern, nicht ein Add-on** | Mitgliederverwaltung ist Commodity (Fairgate, ClubDesk, Webling & Co. machen das längst) – damit ist keine Differenzierung möglich. myclub positioniert sich als **Engagement-Plattform für Vereine**: Die Verwaltung ist das tragende Substrat, das Punkte-/Wertschätzungssystem ist das Produkt. Dazu kommt intern die **Mitgliederwert-Perspektive** (§11) nach dem Vorbild des Kundenwerts aus Sales Excellence/CX |

---

## 2. MVP-Modulschnitt

### 2.1 IN – Der Kern (MVP)

| Baustein | Umfang im MVP |
|---|---|
| **Auth & Onboarding** | Magic Link, Invite-first (Links/QR mit Scope/Rolle/Ablauf), Verein/Team-Workspace in 3 Min gründen, abgesicherter Anfrage-Pfad (Opt-in), Kontolöschung (Store-Pflicht) |
| **Mitglieder & Teams** | Mitglieder, Rollen (member/trainer/admin), Teams, Profil mit Datenschutz-Optionen |
| **Agenda** | Trainings (einzeln + Serie), Vereins-Events, **Helfer-Events mit Schichten**, Zu-/Absagen mit Grund, Erinnerung an Unentschlossene, QR-Check-in |
| **Gamification (der USP)** | Punkte-Ledger (7 Säulen, konfigurierbar), Dashboard mit «Nächste Punkte», Vereins-/Team-Leaderboard, Aufgaben-Marktplatz (einmalig/wiederkehrend), Schicht-Bestätigung → Punkte, **Spider-Selbstsicht** (eigenes Profil vs. Team/Verein) |
| **Vereins-Gesundheit & Frühwarnung (KERN)** | Health auf drei Ebenen (Verein/Team/Mitglied), Austritts-Frühwarnung mit rollenbasiertem Routing (Trainer + Sportchef/Vorstand), Fürsorge-Hinweise mit Status – Anti-Überwachung by Design (§11.4a) |
| **News & Benachrichtigungen** | Vereins-News, In-App-Inbox (100%-Fallback), Push (ntfy/APNs/WebPush), granulare Einstellungen |
| **i18n & Theming** | DE/FR/IT/EN ab erstem Commit, Laufzeit-Theming (White-Label-fähig ohne Builds) |

### 2.2 OUT – Ausgelagert oder ersetzt

| Was | Wohin |
|---|---|
| Beitragsverwaltung, QR-Rechnung, Perioden, Zuschläge, Positionen, Mahnwesen, Zahlungsabgleich | → **myclub Billing** (eigenständiger Dienst, §3) |
| Helferpunkte-Konto, Soll-/Schwellwert-Reporting, Reporting-Zeitraum | → **ersetzt durch Gamification-Ledger** (§4). Vorstands-Sicht = Filter auf Säule 3 statt eigenes Modul |
| Globaler Verbands-Presync + Vereinsverzeichnis + Kontakt-E-Mail-Claiming | → **entfällt**; Verbands-Anbindung per API-Key (§5) |

### 2.3 SPÄTER – Bewusst verschoben (Backlog, nicht gestrichen)

| Feature | Warum später |
|---|---|
| Badges, Level, Challenges, Rewards | Gamification-Ausbaustufe 2 – erst wenn der Punkte-Loop läuft |
| Funktionärsämter mit Factsheets & Vakanz-Anzeige | Ausbaustufe 2 des Marktplatzes – **vorgezogen am 12.09.2026** (UC-041): Factsheet, Sitze, Belegung, PDF im Vereinsspeicher, Vakanz im Marktplatz |
| Meisterschaft (Spielpläne, Resultate, Tabellen, Aufstellungen) | Optionales Modul, abhängig von API-Keys (§5) |
| Eltern/Kids (Verknüpfung, stellvertretend antworten) | Erstes Post-MVP-Inkrement – wichtig für Juniorenvereine, aber nicht Tag-1-kritisch |
| J+S-Exporte, Mitglieder-Export | Post-MVP; Datengrundlage (Anwesenheiten) entsteht im MVP bereits korrekt. **Der Mitglieder-Export ist am 14.09.2026 vorgezogen** (UC-043, FR-130): Verein und Team als CSV, mit wählbaren Feldern und strukturierten Stammdaten. Der J+S-Export (FR-131) bleibt Post-MVP – er braucht AHV-Nummer, Geschlecht und Nationalität, die das Profil bewusst nicht führt |
| Trainingsübungen, Vereinslinks, Vereinsstatistiken, Spielvorschau im Feed, Follow | Nice-to-have; keine MVP-Rechtfertigung |
| Bulk-Import (CSV) mit personalisierten Einladungen | Direkt nach MVP – wichtig für Migration der Bestandsvereine |

---

## 3. myclub Billing – der eigenständige Rechnungsdienst

### 3.1 Warum auslagern?

Die Rechnungsstellung hat einen anderen Charakter als der Rest der App: regulatorisch (SIX-Implementation-Guidelines, MOD10-Referenzen), bank-nah (camt.054), fehlerintolerant, mit eigenem Release-Rhythmus. Als eigener Dienst:
- hält sie die App schlank,
- kann sie unabhängig getestet, zertifiziert und weiterentwickelt werden,
- ist sie **auch standalone verkaufbar** (Vereine, die nur Rechnungen wollen – eigenes Produktpotenzial),
- bleibt sie vollständig in myclub integrierbar (Deep Integration, für Nutzer unsichtbar).

### 3.2 Architektur der Integration

```
┌────────────────────┐          ┌──────────────────────────┐
│    myclub App      │          │      myclub Billing      │
│  (Supabase Kern)   │          │  (eigenes Supabase-Proj.)│
│                    │  ①  API  │                          │
│ Mitglieder, Teams ─┼─────────►│ Debitoren-Spiegel        │
│ (Sync: minimal)    │          │ Creditor (QR-IBAN)       │
│                    │          │ Perioden, Rechnungen,    │
│ «Meine Rechnungen» │  ②  UI   │ Positionen, Zuschläge    │
│ (eingebettet) ◄────┼──────────┤ QR-PDF (swissqrbill)     │
│                    │          │ camt.054-Abgleich        │
│ award_points()  ◄──┼──────────┤ Mahnwesen                │
│ 'invoice_on_time'  │ ③Webhook │                          │
└────────────────────┘          └──────────────────────────┘
```

**Drei Integrationspunkte:**

1. **Mitglieder-Sync (myclub → Billing)**: Minimaler Datensatz (member_id, Name, Adresse, E-Mail, Team-Zuordnung). Push bei Änderung, Billing hält einen Debitoren-Spiegel. Kein Rückfluss von Stammdaten.
2. **Eingebettete UI (Billing → myclub)**: «Meine Rechnungen» (Mitglied) und «Rechnungslauf» (Kassier:in) als eingebettete Ansichten (signierte URL / Web Component) – für Nutzer fühlt es sich wie ein Teil von myclub an. SSO über signiertes Token (myclub-JWT → Billing verifiziert).
3. **Ereignisse (Billing → myclub, Webhooks)**: `invoice.created`, `invoice.paid`, `invoice.overdue`. Bei `invoice.paid` mit `paid_at <= due_date` bucht myclub `award_points('invoice_on_time')` – die Gamification-Säule 6 funktioniert damit ohne dass die App Rechnungen kennt.

**Grundregel der Abgrenzung**: myclub kennt nur *«Mitglied X hat Rechnung Y offen/bezahlt (Betrag, Fälligkeit, Link)»* – alles andere (Positionen, Referenzen, Bankdaten) bleibt im Billing-Dienst.

### 3.3 Technik (kompakt)

Gleicher Stack wie die App (Supabase-Projekt «myclub-billing»: Postgres + Edge Functions + Storage für PDFs), damit ein Team beide Dienste beherrscht. Eigene API (PostgREST + Edge Functions), eigene Mandanten-Tabelle (ein Billing-Mandant pro Verein, aktiviert aus den myclub-Vereinseinstellungen heraus). Die bisherigen Schema-Entwürfe `creditors`, `invoice_periods`, `invoices`, `invoice_positions`, `surcharges` wandern unverändert dorthin.

---

## 4. Helfer → Gamification: Ein Ledger statt zwei Systeme

**Was bleibt (organisatorisch, im Kern):** Helfer-Events mit Schichten (Zeitfenster, Personalbedarf), An-/Abmeldung, Admin-Bestätigung. Das ist Terminorganisation und gehört in die Agenda.

**Was sich ändert (Punkte):**
- Die Bestätigung einer Schicht bucht direkt in den **Gamification-Ledger** (`point_transactions`, Säule 3) – es gibt kein separates Helferpunkte-Konto mehr.
- **Soll/Schwellwert und Reporting-Zeitraum entfallen im MVP.** Statt Pflicht-Reporting: Der Vorstand filtert das Leaderboard nach Säule 3 («Helferpunkte pro Mitglied, Saison») – dieselbe Information, positive Rahmung, null Zusatzkomplexität.
- Manuelle Punktebuchung (bisher FR-061) bleibt als generische Admin-Funktion des Ledgers (`source_type='manual'`).
- Migration: bestehende `helferPunkte` → `point_transactions` (`source_type='migration'`, Säule 3) – wie im Architektur-Dokument beschrieben.
- Falls Vereine später ein verbindliches Helfer-Soll brauchen (Depot-Rückerstattung), wird das als **«Saisonziel»** auf dem Ledger gebaut (Ausbaustufe) – nicht als eigenes Modul.

---

## 5. Verbands-Anbindung: API-Key pro Verein

Neue Ausgangslage: swiss unihockey verlangt (wie Handball Schweiz) einen **API-Key pro Verein**. Das vereinfacht die Architektur erheblich:

**Vorher (alt):** Globaler Presync aller Verbandsvereine → inaktive Club-Einträge → Claiming via Kontakt-E-Mail-Match → still scheiternde Aktivierungen.

**Neu:**
```
Verein gründet sich generisch (§6) → Einstellungen → «Verband verbinden»
→ Verband wählen (swiss unihockey, Handball, Volleyball, Turnen, …)
→ API-Key einfügen (Anleitung mit Link zum Verbandsportal)
→ Test-Call validiert den Key → Verbindung aktiv, Sync startet
```

- **Der API-Key ist die Verifikation**: Wer den Key des Vereins besitzt, ist berechtigt – das Claiming-Problem löst sich auf.
- **Kein Vereinsverzeichnis-Presync mehr**: Es existieren nur noch selbst gegründete Vereine. Der Sync holt Spielpläne/Resultate/News **nur** für verbundene Vereine.
- Schema: `federation_connections (club_id, federation, api_key → Vault-verschlüsselt, status, last_sync_at)`; die Edge Function `federation-sync` iteriert über aktive Verbindungen statt über einen globalen Katalog.
- Verbände ohne Key-Zwang werden identisch modelliert (Key optional/leer) – ein Mechanismus für alle.

---

## 6. Vereinsart-offenes Onboarding

- Gründungs-Wizard fragt neutral: **«Was für ein Verein seid ihr?»** – Sport / Musik / Kultur / Jugend / Quartier / Anderes (Freitext). Keine Verbandslisten, keine Sportarten-Pflicht.
- Der Vereinstyp steuert nur **Vorlagen**: Punkteregel-Templates (Sport: Training/Match; Musik: Probe/Konzert/Auftritt; Quartier: Anlass/Arbeitseinsatz) und Standard-Begriffe. Alles nachträglich änderbar.
- Kern-Vokabular ist sport-neutral («Termin», «Anlass», «Einsatz»); «Training», «Spiel», «Probe» sind konfigurierbare Labels des Vereins.
- Meisterschaft/Verbands-Sync erscheint nur, wenn das Modul aktiviert und ein Verband verbunden ist – für einen Quartierverein existiert das Konzept schlicht nicht.

---

## 7. Vereinfachtes Produkt- & Preismodell

> Aktualisiert (Entscheid 5): **Gamification Basic ist im Basis-Abo enthalten** – sie ist das Produkt, nicht das Add-on. Bezahlt wird die Ausbaustufe.

| Stufe | Inhalt | Preis (Vorschlag) |
|---|---|---|
| **myclub Basis** | Kern gemäss §2.1 **inkl. Gamification Basic** (Punkte-Ledger, Dashboard, Leaderboards, einfacher Marktplatz, Spider-Selbstsicht) **und Vereins-Gesundheit mit Frühwarnsystem** (drei Ebenen, Rollen-Routing) | Grössenstaffel: micro CHF 0 (≤20) / small 6.90 / medium 12.90 / large 24.90 |
| **Add-on Engagement Pro** | Badges, Level, Challenges, Rewards, Funktionärsämter mit Factsheets & Vakanz-Anzeige – plus vertiefte Analytics: Langzeit-Trends, Saisonvergleiche, Ehrenamts-Bilanz (Stunden), Puls-Umfragen | ~CHF 6.90/Mt |
| **Add-on Verband** | Verbands-Sync (Spielpläne, Resultate, Tabellen) via API-Key | CHF 5.90/Mt |
| **myclub Billing** | Eigenständiger Dienst, aus myclub aktivierbar | Eigene Preisliste (z.B. Flat oder pro Rechnung) |

Die Logik: Das Gratis-/Basis-Erlebnis macht den USP für **jedes Mitglied** spürbar (Punkte ab dem ersten Training) – das verkauft die App von innen. Der Vorstand zahlt für die Führungs-Perspektive (Engagement Pro) und die Anschlüsse (Verband, Billing).

---

## 8. MVP-Inkremente

| Inkrement | Inhalt | Ziel |
|---|---|---|
| **M1 – Fundament** | Auth (Magic Link), Invite-first-Onboarding, Vereins-/Team-Workspace, Mitglieder & Teams, i18n, Theming | Verein in 3 Min gegründet, Mitglied in 60 s beigetreten |
| **M2 – Agenda-Loop** | Trainings/Events/Helfer-Schichten, Zu-/Absagen, QR-Check-in, Punkte-Ledger + Dashboard | Der Kern-Loop lebt: Termin besuchen → Punkte sehen |
| **M3 – Gemeinschaft** | Leaderboards, Aufgaben-Marktplatz, News + Push/Inbox, Schicht-Bestätigung → Punkte | Gamification als spürbarer USP |
| **M4 – Anschlüsse** | Billing-Integration (Sync, eingebettete UI, Webhooks), Verbands-Add-on mit API-Key, Bulk-Import, Eltern/Kids | Bestandsvereine können vollständig migrieren |

---

## 9. Konsequenzen für die bestehenden Dokumente

- **Technische Architektur**: Invoicing-Tabellen (creditors, invoice_periods, invoice_positions, surcharges) wechseln ins Billing-Projekt; in der App bleibt nur ein schlanker Rechnungs-Spiegel (`invoice_refs`: member_id, amount, due_date, status, link). Neu: `federation_connections`. `payment-import` zieht ins Billing um; die App erhält stattdessen den Webhook-Endpunkt `billing-events`. Helfer-Soll-Logik entfällt.
- **Konzept Gamification**: Säule 6 («Rechnung pünktlich bezahlt») funktioniert unverändert – gespeist vom Billing-Webhook. Badges/Level/Challenges/Ämter als Ausbaustufe 2 markiert. Preismodell gemäss §7.
- **Onboarding-Konzept**: Verbands-Claiming-Abschnitt ersetzt durch API-Key-Flow (§5); Gründung vereinsart-offen (§6). Invite-first bleibt unverändert der Kern.
- **Abgleich Vorgaben**: FR-057–062 (Helfer) und FR-063–070 (Beiträge) gelten als «erfüllt durch Gamification-Ledger» bzw. «delegiert an myclub Billing»; FR-071 (J+S) und FR-016/017 (Eltern) → Post-MVP.

---

## 10. Service-Landschaft: Weitere Externalisierungs-Kandidaten

Das Billing-Muster lässt sich verallgemeinern. **Extraktions-Kriterien** (mind. 2 sollten zutreffen):
(a) regulatorisch/formatgetrieben mit eigenem Änderungsrhythmus, (b) für viele Vereinsarten irrelevant,
(c) schwere externe Abhängigkeiten (Banken, Verbände, Behörden), (d) standalone verkauf-/nutzbar,
(e) Fehler-Isolation gewünscht. **Gegenkriterium:** Alles am Kern-Loop (Punkte, Agenda, Mitglieder) bleibt in der App – Microservice-Wildwuchs wäre das Gegenteil der angestrebten Vereinfachung.

### 10.1 Zielbild

```
                    ┌──────────────────────────┐
                    │        myclub App        │  Kern + Gamification
                    │  (Supabase, ein Ledger)  │  ← bleibt bewusst monolithisch
                    └──┬──────┬──────┬──────┬──┘
       Webhooks/API      │      │      │      │ publish (Opt-in)
   ┌──────────────────┐  │      │      │   ┌──┴──────────────────────┐
   │  myclub Billing  │◄─┘      │      │   │  myclub Kalender        │
   │  QR-Rechnung,    │         │      │   │  (Publishing, read-only)│
   │  camt.054,       │         │      │   │  ICS-Feeds · Widget ·   │
   │  Mahnwesen       │         │      │   │  JSON-API · Webhooks    │
   └──────────────────┘         │      │   └───┬─────────────┬───────┘
                                │      │       ▼             ▼
                     ┌──────────┴──┐ ┌─┴────────────┐  Vereins-     getKanva.io
                     │ J+S         │ │ Federation   │  Websites     (Social-Media-
                     │ Connector   │ │ Gateway      │  (Embed/ICS)   Grafiken)
                     │ AWK-Exporte │ │ Verbands-APIs│
                     └─────────────┘ └──────────────┘
   Geteilte Infrastruktur (extern, aber nicht selbst gebaut):
   Supabase Auth als SSO-Hub · ntfy-Server (Push) · Schweizer SMTP · Matomo ·
   Whisper-Transkription (self-hosted, für «Stimme» §12)
```

### 10.2 Die Kandidaten im Einzelnen

**① Federation Gateway (Verbands-Sync als Dienst) – starker Kandidat, M4**
- Kriterien: (c) fremde APIs mit eigenem Takt (swiss unihockey v2, Handball, Volleyball, Turnverband – jede anders), (a) Formatänderungen der Verbände, (d) als normierte Vereins-Sport-API auch für Dritte interessant, (e) Verbands-Ausfall darf die App nie stören.
- Zuschnitt: nimmt API-Keys entgegen (Vault), normalisiert alle Verbände auf **ein** Schema (games, results, standings, news), liefert per API/Webhook an die App. Neue Verbände = nur Gateway-Release, App bleibt unberührt.
- Kopfstart: Das bestehende myclub-**GraphQL-Backend** für Verbandsdaten ist faktisch der Embryo dieses Dienstes – es wird herausgelöst und auf das API-Key-Modell umgestellt, statt neu gebaut.

**② J+S Connector – starker Kandidat, Post-MVP**
- Kriterien: (a) BASPO-/AWK-Formatvorgaben mit behördlichem Änderungsrhythmus, (b) für Musik-/Kultur-/Quartiervereine komplett irrelevant, (d) auch für andere Vereinssoftware nutzbar, perspektivisch (c) direkte NDS/«nationale Datenbank Sport»-Anbindung.
- Zuschnitt: liest Anwesenheiten + Personendaten über eine schmale myclub-API (nur J+S-relevante Felder, inkl. AHV-Nummer → Datenschutz-Isolation als Bonus: sensible Exportdaten verlassen den App-Kern nur in diesen Dienst), erzeugt AWK-CSV bzw. künftige Behördenformate.
- MVP-Haltung: Die App erfasst Anwesenheiten sauber (das passiert ohnehin via QR-Check-in) – der Connector kommt, wenn die ersten J+S-pflichtigen Sportvereine migriert sind.

**③ myclub Kalender (Publishing-Dienst) – starker Kandidat, der einfachste von allen**
- Kriterien: (e) Fehler-/Last-Isolation – öffentlicher Website-Traffic (Embed-Widget, Feed-Abrufe) darf nie die App-Datenbank belasten; rein **read-only**, kein transaktionaler Zustand – die risikoärmste Extraktion der ganzen Landschaft. Datenquelle für **getKanva.io** (eigenes myclub-Projekt) und Vereinswebsites.
- **Manifest-Korrektur K6a («Struktur vor Sichtbarkeit»)**: Der Kalender ist **kein Standalone-Produkt** und wird nicht einzeln verkauft. Sichtbarkeit ist Ergebnis innerer Struktur: Embed, ICS und Kanva-Grafiken werden für einen Verein erst freigeschaltet, wenn die Basis steht (Ämter besetzt, Vereins-Puls aktiv, erster Onboarding-Zyklus abgeschlossen). Technisch bleibt der Dienst früh verfügbar (M3), kommerziell und im Onboarding-Pfad kommt er nach der Struktur.
- Zuschnitt – drei Ausgabekanäle aus einer Quelle:
  1. **Embed-Widget** (Web Component/iframe) für Vereinswebsites – Agenda/Spielplan im Vereins-Theming (Farben/Logo aus `clubs.settings`), responsive, ohne Login.
  2. **iCal/ICS-Feeds** pro Verein und pro Team – abonnierbar in Apple/Google/Outlook-Kalendern («Termine immer im eigenen Kalender» ist für viele Mitglieder wertvoller als jede App).
  3. **JSON-API + Webhooks** für Partner – primär **getKanva.io**: `event.published`, `game.upcoming`, `game.result` lösen automatisch generierte Grafiken aus (Spielankündigung, Resultat-Kachel, Event-Promo), inkl. Vereins-Branding aus den Kalender-Metadaten. Partner-Zugriff über API-Keys.
- Datenschutz-Leitplanke: Der Dienst kennt **ausschliesslich publizierte Termindaten** – nie Teilnehmer, Anwesenheiten oder Mitgliederdaten. Publikation ist **Opt-in pro Verein und Termin-Typ** (z.B. «Spiele & Vereinsanlässe öffentlich, Trainings nicht»). Das ist die bewusste, kontrollierte Ausnahme von der bisherigen Out-of-Scope-Regel «kein öffentlicher Bereich» – öffentlich wird nur, was der Verein aktiv publiziert.
- Architektur: Die App pusht bei Publikation (`event.published`-Webhook) in den Kalender-Dienst; dieser cached (CDN-tauglich) und liefert Widget/ICS/JSON aus. Kein Rückkanal in die App nötig.

**④ Messaging-Dienst (Push + E-Mail) – mittlerer Kandidat, pragmatisch gestuft**
- Motivation: App **und** Billing (Rechnungsversand, Mahnungen) **und** Gateway (Spielverschiebungs-Push) brauchen dieselben Kanäle (ntfy/APNs/WebPush/SMTP) samt Empfänger-Präferenzen.
- Stufenplan: Im MVP eine geteilte `_shared`-Library der Edge Functions (kein eigener Dienst!). Extraktion zum Dienst erst in M4, wenn Billing produktiv Mails versendet – vorher wäre es Overhead ohne Nutzen.

**⑤ Bewusst NICHT extrahieren**
- **Punkte-Engine, Agenda, Mitglieder/Teams, Aufgaben-Marktplatz**: der Kern-Loop – transaktional eng verzahnt, lebt von RLS und atomaren Postgres-Funktionen. Eine Trennung würde genau die Latenz, Komplexität und Fehlerquellen einführen, die der MVP-Schnitt beseitigt.
- **Auth**: kein Eigenbau nötig – die Supabase-Auth-Instanz der App wird zum SSO-Hub; Billing/Gateway/Connector verifizieren deren JWTs. Ein Login für alles.
- **Analytics, Karten, Fehler-Tracking**: bereits externe Open-Source-Bausteine (Matomo, MapLibre/swisstopo, Sentry self-hosted) – konsumieren statt bauen.

### 10.3 Ausbau-Reihenfolge der Service-Landschaft

| Wann | Dienst | Auslöser |
|---|---|---|
| **M3** | **myclub Kalender** | Read-only, risikoarm – erster externer Dienst: ICS-Feeds & Website-Widget schaffen sofort sichtbaren Nutzen; JSON-API/Webhooks für getKanva.io |
| M4 | myclub Billing | Bestandsvereine brauchen Rechnungen (bereits entschieden) |
| M4 | Federation Gateway | Erste Sportvereine verbinden Verbände per API-Key; GraphQL-Backend wird herausgelöst |
| M4+ | Messaging-Dienst | Sobald Billing produktiv versendet (vorher: shared Library) |
| Post-MVP | J+S Connector | Erste J+S-pflichtige Vereine migriert |
| Später | KI-Assistenzdienste (z.B. Matchbericht-Entwurf für den Marktplatz) | Nachfrage aus der Gamification |

---

## 11. Mitgliederwert: Kundenwert-Denken für Vereine

> Übertragung des Kundenwert-Ansatzes aus Sales Excellence / Customer Experience (Staudacher, CustomersX)
> auf die Mitgliederbeziehung. Grundidee dort: Alle Investitionen in Erlebnisse richten sich am
> **Kundenwert** aus – nicht an blosser Zufriedenheit. Für Vereine heisst das: Die Gamification ist
> nicht Selbstzweck, sondern das Instrument, das den **Mitgliederwert** systematisch steigert und
> messbar macht.

### 11.1 Zwei Seiten derselben Medaille

| Perspektive | Sichtbar für | Sprache | Zweck |
|---|---|---|---|
| **Wertschätzung** (Gamification) | Mitglieder | Punkte, Fortschritt, Dank – immer positiv | Motivation, Spass, Bindung |
| **Mitgliederwert** (Cockpit) | Vorstand/Trainer (Engagement Pro) | Health, Trends, Frühwarnung | Führen, Fürsorge, Austrittsprävention |

Beide lesen **denselben Punkte-Ledger** – es wird nichts zusätzlich über Mitglieder erhoben, nur anders aggregiert.

### 11.2 Die Mitglieder-Journey (CLV-Logik übersetzt)

Kundenwert integriert im Vertrieb die Phasen Akquisition → Onboarding → Expansion → Retention → Advocacy. Die Vereins-Übersetzung – und wie die Gamification-Säulen sie bedienen:

| Phase (CX) | Vereins-Phase | Gamification-Hebel | Cockpit-Kennzahl |
|---|---|---|---|
| Akquisition | Beitritt | Invite-first-Onboarding, Willkommenspunkte | Beitritte/Monat, Aktivierungsquote |
| Onboarding | Erste 90 Tage | Erste Punkte sofort, Gotti/Götti, «Nächste Punkte» | 90-Tage-Aktivierung (≥3 Teilnahmen) |
| Expansion | Vom Teilnehmen zum Mittragen | Aufgaben-Marktplatz, Helfer-Schichten, Ämter | Anteil Mitglieder mit Punkten in ≥3 Säulen |
| Retention | Dabeibleiben | Treue-Boni, Streaks, Saisonziele | **Member Health Score**, Austrittsquote |
| Advocacy | Mitglieder werben Mitglieder | Säule 5 (Werbeprämie), Badge «Werber:in» | Referral-Quote, geworbene Mitglieder inkl. Folgewert |

### 11.3 Der Mitgliederwert – bewusst mehrdimensional

Ein Mitglied ist nie nur sein Beitrag. Der Wert setzt sich zusammen aus:

- **Engagement-Wert**: Teilnahme am Vereinsleben (Säulen 1, 2, 4) – der Puls der Beziehung
- **Ehrenamts-Wert**: Helfereinsätze, Aufgaben, Ämter (Säulen 3, 7) – approximierbar in Stunden × Freiwilligenarbeits-Ansatz: macht den «unsichtbaren» Beitrag für den Vorstand erstmals beziffbar
- **Finanzieller Wert**: Beiträge, Zahlungszuverlässigkeit (Säule 6, gespeist vom Billing-Webhook)
- **Netzwerk-Wert**: geworbene Mitglieder samt deren Engagement (Säule 5) – die Referral-Kette
- **Treue-Wert**: Vereinszugehörigkeit in Jahren

Das Cockpit zeigt diese Dimensionen als Portfolio-Sicht (Verein/Team) und pro Mitglied – ausdrücklich als **Führungs- und Fürsorge-Instrument**, nicht als Rangliste des «Werts» von Menschen.

### 11.4 Vereins-Gesundheit auf drei Ebenen + Frühwarnsystem (KERN der App)

> Entscheid: Das Frühwarnsystem ist **Kernfunktion (Basis-Abo)**, nicht Add-on. Vereine sind ein
> Retention-Geschäft – ein gehaltenes Mitglied ist günstiger als drei geworbene. Die vertieften
> Analytics (Langzeit-Trends, Puls-Umfragen, Ehrenamts-Bilanz) bleiben in Engagement Pro.

**Drei Ebenen, eine Logik – Gesundheit ist überall dieselbe Ampel:**

| Ebene | Ansicht | Sichtbar für |
|---|---|---|
| **Verein** | Health-Übersicht: Aktivierungsquote, Anteil aktive Mitglieder, offene Frühwarnungen, Trend zur Vorsaison | Vorstand |
| **Team** | Team-Health: Trainingsbeteiligung, Antwortquote (Zu-/Absagen), Mitgliederliste mit Ampeln | Trainer:in (eigenes Team), Sportchef:in, Vorstand |
| **Mitglied** | Mitglieder-Detail: Health-Status, Verlauf, **Spider-Diagramm** (s.u.), konkreter Fürsorge-Hinweis | Rollenabhängig (s. Routing) |

**Das Spider-Diagramm (Radar) – die Dashboard-Ansicht der fünf Wertdimensionen:**
Engagement · Ehrenamt · Finanzen · Netzwerk · Treue, jeweils normalisiert (0–100) und überlagert mit
**Team-Durchschnitt** und **Vereins-Durchschnitt** als Vergleichslinien. Zwei Verwendungen:
- **Selbstsicht (Mitglied, Basis)**: Jedes Mitglied sieht sein eigenes Profil im Vergleich zu Team/Verein – positiv gerahmt («Deine Stärke: Ehrenamt 💪»). Das ist Wertschätzung, keine Bewertung.
- **Führungssicht (Trainer/Sportchef/Vorstand)**: Dasselbe Diagramm pro Mitglied im eigenen Zuständigkeitsbereich – als Gesprächsgrundlage, nicht als Rangliste. Es gibt bewusst **keine** Ansicht «alle Mitglieder nach Wert sortiert».

**Frühwarn-Signale (aus vorhandenen Teilnahme-Daten, nichts Neues wird erhoben):**
- Trainingsfrequenz sinkt deutlich / lange Streak reisst
- **Silent Churn**: keine Zu-/Absagen mehr (gefährlicher als Absagen!)
- Keine Reaktion auf Einladungen/News über längere Zeit
- Rechnungsverzug als Spätindikator (via Billing-Webhook)

**Rollenbasiertes Hinweis-Routing** – derselbe Hinweis erreicht alle Verantwortlichen seiner Ebene:
«Luca war seit 6 Wochen nicht im Training» geht an die **Trainer:in des Teams** UND an **Sportchef:in/Vorstand** (pro Verein konfigurierbar: welche Rolle erhält welche Hinweis-Kategorie). Jeder Hinweis kommt mit Handlungsvorschlag («Kurzes Gespräch am Donnerstag?») und Status (offen / in Kontakt / gelöst), damit sich niemand doppelt meldet und nichts liegen bleibt. Aufgelöste Hinweise verschwinden – es entsteht **keine Akte**.

### 11.4a Anti-Überwachung by Design (nicht nur Regel, sondern Architektur)

Volle Übereinstimmung: Die App soll Überwachung **nicht können**, nicht bloss nicht tun. Konkret:

1. **Nur Teilnahme-Daten**: Signale entstehen ausschliesslich aus Daten, deren Erfassung Mitglieder kennen (Anwesenheit, Zu-/Absagen, Zahlungsstatus). Kein App-Nutzungs-Tracking, keine Lesebestätigungen pro Person, keine Standortdaten, keine Verhaltensprofile.
2. **Keine Werkzeuge für Missbrauch**: Kein Export individueller Health-Daten, keine «schlechteste Mitglieder»-Sortierung, keine Health-Historie über die Saison hinaus (Signale verfallen), keine automatischen Konsequenzen (Sperren, Mahnungen o.ä. sind technisch nicht an Health koppelbar).
3. **Strikte Rollen-Reichweite**: Trainer:innen sehen nur ihr Team; Sportchef:in ihren Bereich; Vorstand den Verein. Durchgesetzt in RLS, nicht im Frontend.
4. **Transparenz-Seite für Mitglieder**: «Was sieht mein Verein?» zeigt jedem Mitglied exakt, welche Signale existieren und wer sie sieht – plus Opt-out der individuellen Health-Hinweise (aggregierte Team-/Vereinswerte bleiben anonym enthalten).
5. **Sprache der Fürsorge**: Hinweise formulieren nie Vorwürfe («inaktiv», «säumig»), sondern Anlässe für Kontakt.

### 11.5 Leitplanken (nicht verhandelbar)

1. **Fürsorge statt Überwachung**: Der Health Score löst Gespräche aus, nie automatische Konsequenzen. Zweckbindung: Bindung & Betreuung.
2. **Kein öffentlicher «Wert»**: Mitglieder sehen Punkte und Wertschätzung – nie eine Bewertung ihres «Werts». Das Cockpit ist rollenbeschränkt (Vorstand; Trainer nur eigenes Team).
3. **Keine neuen Datenerhebungen**: Alles entsteht aus dem bestehenden Ledger + Agenda + Billing-Status. DSG: Zweck in der Datenschutzerklärung transparent, Analytics-Opt-out möglich.
4. **Mensch entscheidet**: Empfehlungen sind Vorschläge an Menschen, die ihre Mitglieder kennen.

### 11.6 Technik (kompakt)

Materialized View `member_value` über `point_transactions` (nach Säulen aggregiert) + `attendance`-Frequenztrends + `invoice_refs.status` + Referral-Kante aus Säule-5-Buchungen; Health-Regeln als konfigurierbare Schwellen in `clubs.settings`. Teil des Add-ons Engagement Pro; nächtlicher Refresh via pg_cron. Kein neuer Dienst nötig – es ist eine Lese-Schicht auf dem Ledger.

### 11.7 Prüfergebnis Sales-Excellence-Framework (CustomersX/Staudacher)

Das Mitgliederwert-Konzept wurde gegen das 5-Dimensionen-Reifegradmodell, die Kundenorientierungs-Diagnostik und das Customer-Data-Management-Framework geprüft (Details: «Prüfbericht Mitgliederwert Sales Excellence»). Ergebnis: bestanden, mit vier kleinen Verfeinerungen, die hiermit Teil des Scopes sind:
- **V1 Definitionskatalog** (MVP): «aktiv», «Aktivierung», Silent-Churn-Schwellen als dokumentierte, pro Verein konfigurierbare Definitionen mit Info-Icons an jedem KPI.
- **V2 Mini-Playbooks** (MVP): Jeder Fürsorge-Hinweis enthält 2–3 anpassbare Gesprächsimpulse pro Signaltyp.
- **V3 Sentiment-Darstellung** (MVP-korrekt, Erhebung in Pro): Stimmung wird als «nicht erhoben» gezeigt, nie als 0 – Puls-Umfragen schliessen die Lücke in Engagement Pro.
- **V4 Trainer-Aufwand-Budget** (MVP): Ein-Tap-Triage (<10 s pro Hinweis) und Deckel für gleichzeitig offene Hinweise pro Team.

Geschärfte Positionierung aus der Prüfung: myclub ist **das Betriebssystem für Mitgliederorientierung** – es liefert einem ressort-orientierten Verein Struktur (Rollen-Routing), Metriken (Health), Entscheidungsrechte (Signal-Konfiguration) und Prozesse (Status-Workflow) schlüsselfertig.

---

## 12. «Stimme»: Sprachmemos & analoges Feedback (Kern)

> Vereinsleben findet analog statt – in der Garderobe, nach dem Training, am Fest. «Stimme» ist die
> Brücke: **Sprechen statt Tippen.** Eine Sprachnachricht wird transkribiert und landet als
> adressierbares, nachverfolgbares Anliegen bei der richtigen Person – oder bleibt privat.
> Damit wird zugleich die Sentiment-Lücke (V3) qualitativ geschlossen: Voice of Member, wörtlich.

### 12.1 Ein Mechanismus, vier Anwendungen

| Anwendung | Wer → Wohin | Sichtbarkeit | Beispiel |
|---|---|---|---|
| **Selbstreflexion** | Mitglied → an sich selbst | Strikt privat (nur Autor:in) | Spielerin nach dem Training: «Erste Halbzeit gut, aber ich verliere die Konzentration…» – privates Sprachjournal, optional mit Trainer:in geteilt |
| **Trainer-Logbuch (Coaching)** | Trainer:in → an sich selbst | Privat | Nach jedem Training 60 Sekunden: Was lief gut? Was ändere ich? – Saisonverlauf als Führungs-Werkzeug; später KI-Coaching-Impulse (Pro) |
| **Gerichtetes Feedback** | Alle → Person oder Rolle (Trainer:in, Mitglied, Sportchef:in, Vorstand) | Persönlich | «Der neue Trainingsaufbau kommt super an, aber 19 Uhr ist für die Lehrlinge zu früh» → wird beim Empfänger zum Anliegen mit Status, optional zur Aufgabe im Marktplatz |
| **Anonymer Kanal** | Mitglied → Vorstand (definierte Rollen) | Anonym | Kummerkasten 2.0: Kritik, heikle Themen, Ideen – ohne Namen, aber mit Antwort (s. 12.3) |

### 12.2 Der Ablauf (bewusst einfach)

```
🎙️ Aufnehmen (max. 3 Min, ein Tap)
→ Transkription (souverän, s. 12.4)
→ Absender:in PRÜFT und korrigiert das Transkript (nichts geht ungesehen raus;
  Audio beilegen oder verwerfen – Standard: verwerfen)
→ Adressieren: an mich | an Person/Rolle | anonym an Vorstand
→ Empfänger-Inbox mit derselben Triage wie Fürsorge-Hinweise:
  offen → in Arbeit → beantwortet/erledigt (Ein-Tap, V4-konform)
→ Optional: «In Aufgabe umwandeln» (Aufgaben-Marktplatz) oder mit
  Fürsorge-Hinweis verknüpfen («Gespräch mit Luca geführt ✓»)
```

### 12.3 Anonymität mit Antwort: Speak-up braucht Listen-up

Design-Grundsatz aus der Speak-up-/Listen-up-Forschung (Palazzo): Sprechkanäle sterben nicht an fehlendem Mut, sondern an fehlender Reaktion – «die Geschichte des letzten Anliegens bestimmt das nächste». Deshalb:

- **Echt anonym, nicht pseudonym**: Bei anonymen Memos wird die Autorschaft **nie gespeichert**; Zeitstempel werden auf Kalenderwoche vergröbert (De-Anonymisierungs-Schutz in kleinen Teams).
- **Antwort trotz Anonymität**: Das Gerät der Absender:in behält ein lokales Ticket-Token – damit lassen sich Vorstands-Antworten lesen und nachfassen, ohne die Identität preiszugeben (anonymer Zwei-Weg-Faden).
- **Listen-up-Pflicht eingebaut**: Jedes Anliegen hat einen Status, und unbeantwortete anonyme Anliegen werden dem Vorstand sichtbar angemahnt. Optional publiziert der Verein aggregiert: **«Ihr habt gesagt – wir haben gemacht»** – die sichtbare Reaktion, die den Kanal am Leben hält.
- **Missbrauchsschutz**: Rate-Limit, anonymer Kanal nur an definierte Rollen, Melde-Funktion bei Beleidigung; optional «**vertraulich statt anonym**» an eine Vereins-Ombudsperson (Identität nur ihr sichtbar).
- **Konsistenz mit Anti-Überwachung (§11.4a)**: «Stimme» ist ein freiwilliger *Eingabe*-Kanal – kein Monitoring. Keine Schlagwort-Scans der Transkripte, Selbstreflexionen sind per RLS nur für die Autor:in lesbar, kein Export, Audio wird nach Transkription standardmässig gelöscht.

### 12.4 Souveräne Transkription (Google-/OpenAI-frei)

- **On-Device zuerst**: Private Selbstreflexionen und Trainer-Logbücher werden wo möglich **auf dem Gerät** transkribiert (Whisper/whisper.cpp, kleines Modell) – das Audio verlässt das Telefon nie. Maximale Privatsphäre für die sensibelste Anwendung.
- **Self-hosted Whisper für den Rest**: Ein kleiner Transkriptions-Dienst (faster-whisper, Open Source) auf Schweizer Infrastruktur – geteilte Infrastruktur wie ntfy/SMTP (Service-Landschaft §10). Mehrsprachig (DE inkl. Mundart-Toleranz, FR, IT, EN) ohne US-API.
- Fair-Use im Basis-Abo (z.B. 20 Memos/Monat pro Mitglied); unlimitiert + KI-Funktionen in Engagement Pro.

### 12.5 Einordnung Basis vs. Pro

| Basis (alle) | Engagement Pro |
|---|---|
| Alle vier Anwendungen, Transkription, Triage-Inbox, Umwandlung in Aufgaben, anonymer Zwei-Weg-Kanal | KI-Zusammenfassung langer Memos, anonymisiertes Themen-Clustering für den Vorstand («Top-3-Anliegen dieser Saison»), Coaching-Impulse aufs Trainer-Logbuch, Saison-Reflexions-Rückblick |

---

## 13. Sitzungs-Anbindung: Vorstand & Gremien (Kern, bewusst schmal)

> Leitsatz: **Die App verwaltet nicht die Sitzung, sondern den Dialog um die Sitzung.**
> Keine Traktandenverwaltung, kein Protokoll-Tool, keine allgemeinen Todo-Listen – dafür gibt es
> bessere Werkzeuge, und das wäre erneut Aufblähung. In der App lebt nur, was Mitglieder,
> Ämtli und Helferaufgaben verbindet: Inputs hinein, dokumentierte Antworten hinaus.

### 13.1 Sitzungen als Termine mit Ämter-Anbindung

- Vorstandssitzung, Teamsitzung, GV = Event vom Typ `meeting` in der Agenda – mit allem, was Termine können (Einladung, Zu-/Absage, Erinnerung; GV-Teilnahme gibt wie gehabt Punkte, Säule 4).
- **Teilnehmerkreis über Ämtli statt Namenslisten**: Die Einladung geht an Amts-Inhaber:innen (`functionary_roles`: Präsident:in, Kassier:in, Aktuar:in, Sportchef:in …). Wechselt ein Amt die Person, stimmt der Verteiler automatisch – die Ämter-Verwaltung wird damit vom Verzeichnis zum lebenden Organigramm.

### 13.2 Eingang: Mitglieder-Inputs in die Sitzung

- Jedes Mitglied kann einen **Input als Vorschlag** einreichen – als Text oder Sprachmemo via «Stimme» (§12), persönlich oder anonym.
- Inputs landen im **Eingangskorb des Gremiums**. Der Vorstand entscheidet pro Input: **sofort individuell/laufend bearbeiten** oder **der nächsten Sitzung zuordnen** («nehmen wir am 14.3. mit»). Die Einreicher:in sieht diesen Status («eingeplant für Vorstandssitzung März») – schon das ist gelebtes Listen-up.
- In der Sitzung selbst zeigt die App nur eine **Sammelansicht der zugeordneten offenen Anliegen** – plus die zwei Dauerthemen, die ohnehin im System leben: **vakante Ämtli** und **offene Helfereinsätze**. Mehr nicht.

### 13.3 Ausgang: Dokumentierte Kommunikation zurück (der Kern!)

Jeder behandelte Input erhält eine **dokumentierte Antwort**: Entscheid/Haltung des Vorstands in 2–3 Sätzen, mit Datum und Gremium. Diese Antwort
1. geht **an die Einreicher:in zurück** – bei anonymen Inputs über den Ticket-Token-Faden (§12.3),
2. kann optional als News-Beitrag **«Aus dem Vorstand»** vereinsweit publiziert werden – der formalisierte «Ihr habt gesagt – wir haben gemacht»-Kanal (Listen-up sichtbar gemacht),
3. bleibt am Input dokumentiert – Mitglieder können nachvollziehen, was aus ihren Vorschlägen wurde.

Unbeantwortete Inputs werden dem Gremium angemahnt (gleiche Mechanik wie §12.3) – ein Anliegen kann «abgelehnt» werden, aber nicht versanden.

### 13.4 Folge-Artefakte: exakt zwei, bewusst nicht mehr

Aus einem behandelten Input kann die App genau zwei Dinge erzeugen:
1. **Helferaufgabe** im Aufgaben-Marktplatz («Jemand soll die Festbeiz-Bewilligung abklären» → Aufgabe mit Punkten), oder
2. **Ämtli-Aktion**: Amt ausschreiben (Vakanz-Anzeige), neu besetzen oder Factsheet anpassen.

**Bewusst ausgeschlossen**: freie Todo-Listen, Beschluss-Protokolle, Traktanden-Verwaltung, Abstimmungs-Tools. Wer das braucht, nutzt sein Protokoll-Werkzeug – die App bleibt schlank und übernimmt nur, was in ihren Kreislauf gehört (Aufgaben → Punkte, Ämter → Vakanzen).

### 13.5 Einordnung

Basis-Funktion (Kern): Der Kreislauf Mitglied → Input → Gremium → dokumentierte Antwort → ggf. Aufgabe/Ämtli ist die organisatorische Klammer um «Stimme» (§12), Marktplatz (§2.1) und Ämter – und macht die Mitgliederorientierung (§11.7) im wichtigsten Gremium des Vereins konkret erlebbar.

### 11.8 Ergänzende Verfeinerungen aus dem HWZ-Skills-Review (V5–V7)

Aus der Prüfung aller EMBA- und Kommunikations-Frameworks (Details: «HWZ Skills Mapping myclub») gehen drei weitere Verfeinerungen in den Scope über:
- **V5 Symmetrie-Prinzip** (People Analytics, «Greater Good»): Führungs-Reaktionszeiten werden mit denselben Instrumenten sichtbar wie Mitglieder-Signale – Antwortzeit des Vorstands auf Inputs, Triage-Zeit der Trainer auf Fürsorge-Hinweise, Vakanz-Dauer von Ämtern. Zudem: Punkteregeln als GV-Traktandum-Vorlage (Mitsprache der Gemessenen).
- **V6 AI-Governance-Check** (Digital Law): DSFA für das Health-Profiling vor Launch, KI-Register ab Tag 1, Health-Daten bezahlter Funktionäre nie für Anstellungsentscheide verwendbar.
- **V7 Crowding-out-Schutz** (Sinnstiftendes Leadership): Punkte machen Sinn sichtbar, ersetzen ihn nicht – Kudos vor Punktzahl, dezenter Rewards-Shop, Konfig-Option «nur Dank» pro Kategorie, Tonalität feiert den Beitrag statt die Zahl.

Die Kommunikations-Skills (GFK, 4-Ohren, Wertequadrat, Glasl) definieren den Inhalt der Playbooks (V2) und den «Feedback schärfen»-Assistenten in Engagement Pro – inklusive der Eskalations-Grenze: Die App ist Brücke zum persönlichen Gespräch, nie Austragungsort von Konflikten.

### 12.6 Kontext-Check-ins: Die Feedback-Schlaufe nach Training, Spiel und Einsatz

> Die konkrete Ausgestaltung der Feedback-Schlaufe pro Mitglied: kurze, kontextbezogene
> Mikro-Fragen, ausgelöst durch das, was tatsächlich stattgefunden hat.

**Designprinzip 1 – Die App fragt nie, was sie schon weiss.** «Warst du im Training?» (Check-in), «Warst du im Aufgebot?» (Aufstellung), «Habt ihr gewonnen?» (Resultat) – alles bekannt. Gefragt wird nur das Subjektive, das allein das Mitglied kennt: Befinden, Zufriedenheit, Erleben. Das respektiert Aufmerksamkeit und hält Check-ins unter 10 Sekunden.

**Designprinzip 2 – Kontext bestimmt die Frage.** Der Auslöser ist das Ereignis plus die Rolle darin:

| Kontext (Auslöser) | Fragen (Standard, pro Verein/Team anpassbar) | Format |
|---|---|---|
| Nach dem Training (teilgenommen) | «Wie geht es dir?» · «Wie zufrieden bist du mit deinem Training?» | Emoji-Skala + Skala 1–5, optional Sprachmemo |
| Nach dem Spiel (im Aufgebot) | «Wie zufrieden bist du mit deiner Leistung?» · «Wie war das Spiel als Team-Erlebnis?» | 2× Skala, optional Sprachmemo |
| Nach dem Spiel (Ersatz/Bank) | «Wie war der Tag für dich?» – bewusst eigene Frage: das Bank-Erlebnis ist ein unterschätzter Austrittstreiber | Emoji + optional Memo |
| Nach dem Helfereinsatz | «Was lief gut?» · «Was lief nicht?» | 2 freie Felder oder Sprachmemo |
| **Nicht dabei gewesen** | **Keine Frage.** Abwesenheit wird nicht beforscht – «Warum warst du nicht da?» wäre Kontrolle (Chilling-Effekt) und ist per Design ausgeschlossen. Das Silent-Churn-Signal (§11.4) genügt | – |

**Designprinzip 3 – Sichtbarkeit ist bei jeder Antwort explizit und liegt beim Mitglied:**
- **Befinden & Zufriedenheit** («Wie geht's dir?», Leistung): standardmässig **privat** – sie speisen die persönliche Verlaufskurve in der Selbstsicht («Deine Zufriedenheit über die Saison») und fliessen **nur anonym und aggregiert** in die Team-Stimmung (Mindestgruppengrösse 5, sonst keine Anzeige). Bei wiederholt tiefen Werten stupst die App **das Mitglied selbst** an: «Magst du das mit deiner Trainerin teilen?» – Teilen ist immer ein aktiver Entscheid des Mitglieds, nie automatische Weiterleitung.
- **Einsatz-Feedback** («Was lief gut/nicht?»): adressiert an die Organisator:in des Events (wahlweise anonym) – das ist Feedback **über den Anlass**, nicht über Personen, und schliesst den Verbesserungs-Loop der Helfereinsätze; die Organisator:in antwortet mit Dank/Kudos oder Massnahme (Listen-up ✓).

**Designprinzip 4 – Ehrlichkeit vor Anreiz:** Check-ins geben **bewusst keine Punkte**. Belohntes Befinden wird verzerrtes Befinden (Gaming) und erzeugt Antwortdruck (V7). Die Teilnahme selbst gab die Punkte – das Check-in ist freiwillig, überspringbar, max. eines pro Tag (Fatigue-Deckel).

**Einordnung:** Die Team-Stimmungskurve schliesst die Sentiment-Lücke (V3) quantitativ, «Stimme»-Memos qualitativ; die Bank-Frage und die Zufriedenheits-Verläufe verfeinern das Health-System (§11.4) um die subjektive Dimension – unter voller Kontrolle des Mitglieds (Greater-Good-konform, V5).

---

## 14. Manifest-Konformität: Korrekturen K1–K7 (Voicible-Manifest)

> Der Abgleich des gesamten Konzepts mit dem Voicible-Manifest (Purpose, Vision 2031, Mission, fünf Werte,
> Führungsverständnis, Verzichts-Liste) ist im Dokument «Abgleich Voicible Manifest» dokumentiert.
> Die daraus folgenden sieben Korrekturen sind ab jetzt Teil des Scopes und **übersteuern** ältere Aussagen.

**Gemeinsamer Purpose-Satz für myclub**: *myclub existiert, damit Ehrenamt tragfähig bleibt: damit Menschen sich in ihrem Verein verbunden fühlen, Verantwortung teilen können und nicht an ihrem Engagement zerbrechen.* Positionierung geschärft: nicht «Betriebssystem für Mitgliederorientierung» als Selbstzweck, sondern **das Werkzeug, mit dem Verbindung, geteilte Verantwortung und Entlastung zur täglichen Routine werden.**

| # | Korrektur | Konkrete Umsetzung im Produkt |
|---|---|---|
| **K1 Verbindung-vor-Aufruf-Regel** | Die App misst pro Verein die **Verbindungs-Quote** (Verbindungs-Nachrichten: News, «Aus dem Vorstand», Kudos, Puls, Dank ↔ Aufrufe: Vakanzen, Helfergesuche, Aufgaben-Pushes). Kippt sie, erhält der Vorstand einen Symmetrie-Hinweis (V5): «Seit 5 Wochen nur Aufrufe – Zeit für ein Update, was läuft.» Optional konfigurierbar als sanfte Sperre: Helferaufruf-Push erst nach einem Vereins-Puls. **Nicht toleriert (per Design)**: Aufrufe an eine Gemeinschaft, die seit Monaten nichts gehört hat. |
| **K2 Vereins-Puls** | Der Wochen-Digest wird umgebaut: statt «45 Punkte, Platz 12» die drei Fragen der Vision 2031 – **Was passiert · Woran arbeiten wir · Wo kannst du dabei sein**. Automatisch komponiert aus Agenda, Sitzungs-Antworten und offenen Aufgaben/Ämtern; Vorstand gibt in zwei Minuten frei (oder Auto-Versand). Persönliche Punkte erscheinen nachgeordnet. Das ist «Verbindung vor Aufruf» als Routine. |
| **K3 Anfragen statt Abfragen** | (a) **Warum-Pflichtfeld** an jeder Aufgabe, jedem Amt, jedem Helfer-Event («Wozu dient das? Wem hilft es?») – ohne Sinnzusammenhang kann kein Aufruf publiziert werden. (b) **Beitrags-Profil**: Beim Onboarding und jährlich fragt die App jedes Mitglied «Womit trägst du gern bei? Was wäre für dich ein sinnvoller Beitrag?» (Interessen, Stärken, Zeitbudget); Marktplatz und Vakanz-Anzeige **matchen** darauf und schlagen Beiträge persönlich vor – Verantwortung wird angeboten, nicht ausgeschrieben. |
| **K4 Verantwortung teilen & Nachfolge** | Zwei neue Vereins-Health-KPIs: **Verantwortungsverteilung** (Anteil der Mitglieder, die 80% der Einsätze tragen – der «dieselben 20 Leute»-Index, Trend über Saisons) und **Nachfolge-Vorlauf** (Ämter ohne designierte Nachfolge, Amtsdauer > x Jahre). Ämter-Factsheets erhalten «Inhaber:in seit» und «Nachfolge geplant». Frühwarnung an den Vorstand: «Kassier seit 9 Jahren, keine Nachfolge – Zeit, Verantwortung anzubieten.» |
| **K5 «Was können wir verändern?»** | Jedes Team-/Vereins-Signal im Cockpit trägt eine **Handlungsfrage an den Verein**, nicht nur einen Gesprächsvorschlag ans Mitglied (Beteiligung sinkt → «Trainingszeit? Bank-Erlebnis? Zuletzt erklärt, wofür trainiert wird?»). Dazu eigene **Vorstands-Signale** (Symmetrie): Kommunikationspause > 4 Wochen, Verbindungs-Quote gekippt, Inputs unbeantwortet, Ämter ohne Nachfolge. Playbooks (V2) erhalten eine Vorstands-Seite. Keine Schuldnarrative – auch nicht in Richtung Vorstand: Signal, kein Urteil. |
| **K6 Verzicht per Design** | (a) Kalender/Kanva **nie standalone**, Freischaltung nach innerer Struktur (§10.2 angepasst). (b) **Entlastungs-Test als Feature-Gate**: Jede Funktion weist aus, welche Vorstandszeit sie spart und welche sie kostet – netto negativ wird nicht gebaut. (c) **Vereins-DNA als Objekt**: Vereinsprofil mit Warum, Werten, Tonalität, Traditionen, Begriffen; alle KI-Funktionen (Playbooks, Matchbericht-Entwürfe, Antwort-Vorlagen, Clustering) arbeiten damit – keine generische KI. myclub liefert der Vereins-KI zudem die operative DNA (wer macht was, Ämter, Termine, offene Anliegen). |
| **K7 Vereins-Tempo** | **Zero-Config-Start** mit drei Dingen: Agenda, Einladung, Punkte (Standardregeln). Alles Weitere – Ämter, Stimme, Sitzungs-Inputs, Check-ins, Cockpit – schaltet die App **vorschlagend** frei, wenn der Verein bereit ist («Ihr habt 40 aktive Mitglieder – Zeit für Ämter-Factsheets?»). Definitionskatalog, Punkteregeln, Alert-Routing haben Defaults; Konfiguration ist Kür. «Machbar statt perfekt» – immer im Tempo des Vereins. |

**Erfolgsdefinition von myclub (Kennzahlen-Test des Manifests)**: Verantwortungsverteilung, Nachfolge-Vorlauf, Verbindungs-Quote und ein freiwilliger, privater **Entlastungs-Index** der Funktionäre («Wie tragfähig fühlt sich dein Amt gerade an?», Check-in-Mechanik §12.6) – Mitgliederwachstum bleibt sichtbar, ist aber Folge, nicht Ziel.

**Verzichts-Liste myclub** (Produkt-Entsprechung von Manifest §8): keine Sichtbarkeit ohne Struktur · kein Feature, das dem Vorstand netto Aufgaben aufbürdet · keine generische KI · keine Schuldnarrative · kein Versprechen schneller Mitgliederzahlen.
