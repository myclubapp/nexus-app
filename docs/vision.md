# Vision: myclub nexus

Grundlagendokument der Engagement-Plattform **myclub nexus**. Es beschreibt, warum das Produkt
existiert, für wen, was es leistet und woran sein Erfolg gemessen wird. Der Anforderungskatalog
(`requirements.md`) und die Use-Case-Spezifikationen (`use_cases/`) bauen darauf auf.

**Abgeleitet aus:** `MVP_Scope_myclub.md` (massgebend) · `Technische_Architektur_TeamSpirit.md` ·
`Konzept_Vereinsapp_Gamification.md` · `Abgleich_Voicible_Manifest.md`

---

## 1. Purpose

> **myclub existiert, damit Ehrenamt tragfähig bleibt: damit Menschen sich in ihrem Verein verbunden
> fühlen, Verantwortung teilen können und nicht an ihrem Engagement zerbrechen.**

myclub nexus ist das Werkzeug, mit dem Verbindung, geteilte Verantwortung und Entlastung zur
täglichen Routine werden – nicht zum guten Vorsatz.

---

## 2. Das Problem

Schweizer Vereine leben von freiwilligem Engagement, und genau dieses Engagement steht unter Druck:

| Problem | Auswirkung heute |
|---|---|
| **Engagement bleibt unsichtbar** | Wer Trikots wäscht, Kuchen backt oder seit zwölf Jahren die Kasse führt, bekommt selten mehr als ein «danke» an der GV. |
| **Verantwortung konzentriert sich** | Dieselben 20 Leute tragen 80 Prozent der Einsätze; Ämter bleiben vakant, Nachfolge wird erst gesucht, wenn es brennt. |
| **Kommunikation ist Aufruf-lastig** | Der Verein meldet sich, wenn er Hilfe braucht. Wer seit Monaten nichts gehört hat, reagiert nicht mehr. |
| **Austritte kommen ohne Vorwarnung** | Der gefährlichste Zustand ist nicht die Absage, sondern das Verstummen – und niemand bemerkt es rechtzeitig. |
| **Vorstände brennen aus** | Die vorhandenen Werkzeuge bürden dem Vorstand Arbeit auf, statt ihn zu entlasten. |
| **Mitgliederverwaltung ist Commodity** | Fairgate, ClubDesk, Webling & Co. verwalten längst gut – Verwaltung allein löst keines der obigen Probleme. |

**Die Schlussfolgerung:** Die Verwaltung ist das tragende Substrat, das Punkte- und
Wertschätzungssystem ist das Produkt.

---

## 3. Produkt-Vision

**Für** Vereine jeder Art – Sport, Musik, Kultur, Jugend, Quartier –
**die** ihr Engagement erhalten und Verantwortung breiter verteilen wollen,
**ist** myclub nexus **eine** Engagement-Plattform für Mitglieder, Trainer:innen und Vorstände,
**die** jeden Beitrag sichtbar würdigt, Verantwortung persönlich anbietet statt anonym ausschreibt
und früh erkennt, wo jemand Unterstützung braucht – Mitglieder wie Vorstände.

**Anders als** klassische Vereinsverwaltungen, die Daten pflegen, und anders als Helfer-Tools, die
Einsätze abfragen, **macht myclub nexus** den Kreislauf aus Verbindung, Beitrag und Wertschätzung
zur wöchentlichen Routine – und misst, ob er tatsächlich funktioniert.

### Das Zukunftsbild

Mitglieder erfahren regelmässig drei Dinge, ohne danach suchen zu müssen:
**was passiert · woran gearbeitet wird · wo sie dabei sein können.**
Vorstände fragen nicht «warum macht niemand mit?», sondern «was können wir verändern?».
Nachfolge ist geplant, bevor sie dringend wird. Und niemand muss sein Amt abgeben, weil es ihn
aufgezehrt hat.

---

## 4. Zielgruppen

### Primär

| Zielgruppe | Grösse | Bedürfnis |
|---|---|---|
| **Schweizer Sportvereine** | 30–500 Mitglieder, Breitensport | Anwesenheiten, Helfereinsätze, Ämter, Austrittsprävention |
| **Musik-, Kultur-, Jugend- und Quartiervereine** | ab 20 Mitglieder | dieselbe Struktur, ohne Sport-Vokabular |

### Rollen im System

| Rolle | Was sie tut | Was sie sieht |
|---|---|---|
| **Mitglied** | teilnehmen, zu-/absagen, Aufgaben übernehmen, Beiträge einbringen | eigene Punkte, Agenda, Marktplatz, eigene Wertdimensionen |
| **Trainer:in** | Termine führen, Anwesenheiten bestätigen, Team begleiten | eigenes Team – Beteiligung, Antwortquote, Fürsorge-Hinweise |
| **Sportchef:in** | Bereich führen | Teams des eigenen Bereichs |
| **Vorstand** | Verein führen, konfigurieren, Anliegen beantworten | Verein gesamt, Vorstands-Signale, Verantwortungsverteilung |
| **Kassier:in** | Rechnungsstellung über den Billing-Dienst | Rechnungslauf, Zahlungsstatus |
| **System** | Punkte buchen, Signale erzeugen, Puls komponieren | – |

---

## 5. Die fünf Produktprinzipien

1. **Verbindung vor Aufruf.** Wer um Hilfe bittet, hat vorher erzählt, was läuft. Die App misst
   dieses Verhältnis und meldet dem Vorstand, wenn es kippt (K1).
2. **Verantwortung beginnt beim Vorstand.** Es gibt keine Schuldnarrative in Richtung Mitglieder.
   Zu jedem Signal gehört eine Frage an den Verein, nicht nur ein Gespräch mit der Person (K5).
3. **Struktur vor Sichtbarkeit.** Nach aussen glänzt erst, wer innen trägt. Publishing-Kanäle
   werden nach innerer Struktur freigeschaltet, nie einzeln verkauft (K6a).
4. **Machbar statt perfekt.** Zero-Config-Start mit Agenda, Einladung und Punkten. Alles Weitere
   schaltet die App vorschlagend frei, im Tempo des Vereins (K7).
5. **Selbst getan, nicht nur gesagt.** Punktwerte, Ämter-Factsheets und Aufwände stammen aus einem
   real geführten Verein, nicht aus einem Whiteboard.

**Und darüber:** *Sinn ist der Motor, Punkte machen ihn nur sichtbar.* Wertschätzung verstärkt
intrinsische Motivation – sie ersetzt sie nicht (V7).

---

## 6. Der Kern-Loop

```
Verbindung          Beitrag                    Wertschätzung        Führung
───────────         ──────────                 ──────────────       ─────────
Vereins-Puls   →    Termin besuchen       →    Punkte im Ledger →   Health-Signal
News, Kudos         Schicht übernehmen         Kudos, Dank          Handlungsfrage
«Aus dem Vorstand»  Aufgabe erledigen          Spider-Selbstsicht   Fürsorge-Hinweis
                    Amt tragen                 Leaderboard          Nachfolge-Vorlauf
        ▲                                                                  │
        └──────────────  Anliegen · Stimme · Sitzungs-Input  ◄─────────────┘
```

Der Loop schliesst sich: Beiträge erzeugen Punkte, Punkte speisen die Führungssicht,
die Führungssicht löst Gespräche und Verbindung aus – und Verbindung erzeugt den nächsten Beitrag.
**Es gibt genau einen Punkte-Ledger.** Helferpunkte, Aufgaben, Treue und Zahlungszuverlässigkeit
laufen alle dort hinein.

---

## 7. Die sieben Punkte-Säulen

| # | Säule | Beispiele |
|---|---|---|
| 1 | **Trainingsengagement** | Teilnahme, Serien-Boni, Pünktlichkeit |
| 2 | **Wettkampf** | Meisterschaftsspiel, Turnier, Ersatzbereitschaft |
| 3 | **Freiwilliges Engagement** | Helfereinsatz, Schiedsrichter, Fahrdienst, Vorstandsarbeit |
| 4 | **Vereinsleben** | GV, Vereinsanlass, Sponsorenlauf |
| 5 | **Wachstum & Treue** | geworbene Mitglieder, Vereinsjubiläen, Gotti/Götti |
| 6 | **Verlässlichkeit** | Rechnung pünktlich bezahlt, Profil vollständig, rechtzeitige Abmeldung |
| 7 | **Aufgaben-Marktplatz** | Matchbericht, Trikots waschen, Fotos, Ämter |

Alle Werte sind pro Verein konfigurierbar; Säulen lassen sich vollständig deaktivieren.

---

## 8. Wertversprechen je Rolle

| Rolle | Versprechen |
|---|---|
| **Mitglied** | «Mein Einsatz wird gesehen – und ich weiss, wo ich gebraucht werde.» Punkte ab dem ersten Termin, Beiträge, die zu mir passen, und volle Kontrolle darüber, was der Verein über mich sieht. |
| **Trainer:in** | «Ich merke früh, wenn jemand abtaucht – und weiss, wie ich das Gespräch beginne.» Ein-Tap-Triage, Gesprächsimpulse, Reichweite strikt auf das eigene Team begrenzt. |
| **Vorstand** | «Ich sehe, ob Verantwortung breiter getragen wird – und werde entlastet, nicht beschäftigt.» Vereins-Puls in zwei Minuten freigegeben, Nachfolge-Frühwarnung, keine Funktion, die netto Zeit kostet. |
| **Verein als Ganzes** | «Wir bleiben tragfähig.» Weniger stille Austritte, breitere Schultern, dokumentierte Antworten statt versandeter Anliegen. |

---

## 9. Umfang

### 9.1 Im Kern (MVP)

| Baustein | Umfang |
|---|---|
| **Auth & Onboarding** | Magic Link, Invite-first mit Scope/Rolle/Ablauf, Vereinsgründung in 3 Minuten, Beitritts-Anfrage, Kontolöschung, Start mit Beispielinhalten statt leerer App |
| **Mitglieder & Teams** | Mitglieder, Rollen, Teams, Profil mit Datenschutz-Optionen |
| **Agenda** | Termine einzeln und als Serie, Vereins-Events, Helfer-Events mit Schichten, Zu-/Absagen mit Grund, Erinnerung an Unentschlossene, QR-Check-in |
| **Gamification** | Punkte-Ledger über 7 konfigurierbare Säulen, Dashboard mit «Nächste Punkte», Team- und Vereins-Leaderboard, Aufgaben-Marktplatz, Spider-Selbstsicht |
| **Vereins-Gesundheit** | Health auf drei Ebenen, Austritts-Frühwarnung mit rollenbasiertem Routing, Fürsorge-Hinweise mit Status – Anti-Überwachung by Design |
| **«Stimme»** | Sprachmemos: Selbstreflexion, Trainer-Logbuch, gerichtetes Feedback, anonymer Zwei-Weg-Kanal |
| **Sitzungs-Anbindung** | Mitglieder-Inputs an Gremien, dokumentierte Antwort, genau zwei Folge-Artefakte |
| **Kontext-Check-ins** | Kurze Mikro-Fragen nach Teilnahme, Sichtbarkeit beim Mitglied, bewusst punktefrei |
| **News & Benachrichtigungen** | Vereins-News, In-App-Inbox als vollständiger Fallback, Push, granulare Einstellungen, Vereins-Puls |
| **i18n & Theming** | DE/FR/IT/EN ab Commit eins, Laufzeit-Theming ohne Rebuild |

### 9.2 Ausgelagert

| Was | Wohin |
|---|---|
| Rechnungsstellung, QR-Rechnung, Perioden, Mahnwesen, Zahlungsabgleich | **myclub Billing** – eigenständiger Dienst, per API und Webhook integriert |
| Verbandsdaten (Spielpläne, Resultate, Tabellen) | **Federation Gateway** – Anbindung ausschliesslich über API-Key pro Verein |
| Terminpublikation nach aussen (ICS, Widget) | **myclub Kalender** – read-only, opt-in, nie standalone verkauft |
| J+S- und Behördenexporte | **J+S Connector** – Post-MVP |

### 9.3 Bewusst später

Badges, Level, Challenges, Rewards · Funktionärsämter mit Factsheets und Vakanz-Anzeige ·
Meisterschaft · Eltern/Kinder · Exporte · Bulk-Import.

### 9.4 Nicht-Ziele

Die Plattform baut bewusst **nicht**:

- **Keine Sichtbarkeit ohne Struktur** – kein Standalone-Publishing-Produkt.
- **Kein Feature, das dem Vorstand netto Aufgaben aufbürdet** – jede Funktion weist ihre Zeitbilanz aus.
- **Keine generische KI** – jede unterstützende Textfunktion arbeitet mit der Vereins-DNA.
- **Keine Schuldnarrative** – Signal, kein Urteil, auch nicht in Richtung Vorstand.
- **Kein Versprechen schneller Mitgliederzahlen** – Wachstum ist Folge, nicht Ziel.
- **Kein Chat, kein öffentlicher Bereich, keine Buchhaltung, kein Schreibzugriff auf Verbandssysteme.**
- **Kein Überwachungswerkzeug** – kein Nutzungs-Tracking, keine Lesebestätigungen pro Person, keine
  Standortdaten, kein Export individueller Gesundheitsdaten, keine Sortierung nach «Wert» von Menschen.

---

## 10. Anti-Überwachung by Design

Die Plattform soll Überwachung **nicht können**, nicht bloss nicht tun. Das ist Architektur, nicht Richtlinie:

1. **Nur Teilnahme-Daten.** Signale entstehen ausschliesslich aus Daten, deren Erfassung Mitglieder kennen.
2. **Keine Werkzeuge für Missbrauch.** Kein Export, keine Schlechteste-Liste, keine Historie über die Saison hinaus, keine automatischen Konsequenzen.
3. **Strikte Rollen-Reichweite.** Durchgesetzt in Row Level Security, nicht im Frontend.
4. **Transparenz-Seite.** Jedes Mitglied sieht, welche Signale existieren und wer sie sieht – plus Opt-out.
5. **Sprache der Fürsorge.** Hinweise formulieren Anlässe für Kontakt, nie Vorwürfe.

Bei anonymen Beiträgen ist Anonymität eine Eigenschaft des Schemas, nicht einer Policy: Es existiert
keine Spalte, die die Autorschaft aufnehmen könnte.

---

## 11. Technische Leitentscheide

| Entscheid | Begründung |
|---|---|
| **Ionic React + Capacitor** | Eine Codebasis für iOS, Android und PWA |
| **100% Supabase** | Postgres, Edge Functions, pg_cron, Realtime, Storage – kein zusätzlicher Server, vollständig Open Source |
| **Punkte-Engine in Postgres** | `security definer`-Funktionen sind der einzige Schreibpfad in den Ledger: transaktional, atomar, manipulationssicher |
| **Google-frei** | Kein Firebase, kein FCM, keine Google Maps, kein ML Kit, kein Google-Login – und damit auch keine «Sign in with Apple»-Pflicht |
| **Push über ntfy, APNs, Web Push** | souverän, mit der In-App-Inbox als 100%-Fallback |
| **Hosting Region Zürich** | Start managed, Umzug auf Schweizer Self-Hosting jederzeit ohne Codeänderung möglich |
| **Souveräne Transkription** | On-Device für Privates, selbst betriebenes Whisper für den Rest |

**Der eigentliche Souveränitätsgewinn:** Es gibt einen Exit.

---

## 12. Erfolgsdefinition

Gemessen wird nicht, wie viele Mitglieder dazukommen, sondern ob der Verein tragfähiger wird:

| Kennzahl | Definition |
|---|---|
| **Verantwortungsverteilung** | Anteil der Mitglieder, die 80% der Einsätze tragen – der «dieselben 20 Leute»-Index, im Trend über Saisons |
| **Nachfolge-Vorlauf** | Ämter ohne designierte Nachfolge, Amtsdauer, Vakanz-Dauer |
| **Verbindungs-Quote** | Verhältnis von Verbindungs-Nachrichten zu Aufrufen; Wochen seit dem letzten Vereins-Puls |
| **Entlastungs-Index** | Freiwillige, private Quartalsfrage an Funktionär:innen: «Wie tragfähig fühlt sich dein Amt gerade an?» |
| **90-Tage-Aktivierung** | Anteil Neumitglieder mit mindestens drei Teilnahmen in den ersten 90 Tagen |
| **Silent-Churn-Erkennung** | Anteil der Austritte, die vorher als Signal erschienen sind |

Mitgliederwachstum bleibt sichtbar, ist aber **nicht** die Erfolgsdefinition.

---

## 13. Produkt- und Preismodell

| Stufe | Inhalt | Preis |
|---|---|---|
| **myclub Basis** | Kern gemäss §9.1 **inklusive Gamification und Frühwarnsystem** | micro CHF 0 (≤20 Mitglieder) · small 6.90 · medium 12.90 · large 24.90 pro Monat |
| **Add-on Engagement Pro** | Badges, Level, Challenges, Rewards, Ämter mit Factsheets, vertiefte Analytics, Puls-Umfragen | ~CHF 6.90/Monat |
| **Add-on Verband** | Verbands-Sync via API-Key | CHF 5.90/Monat |
| **myclub Billing** | eigenständiger Dienst, aus myclub aktivierbar | eigene Preisliste |

**Die Logik:** Das Basis-Erlebnis macht den Nutzen für **jedes Mitglied** ab dem ersten Termin
spürbar – das verkauft die App von innen. Bezahlt wird die Führungsperspektive und die Anschlüsse.

---

## 14. Umsetzung in vier Inkrementen

| Inkrement | Inhalt | Ziel |
|---|---|---|
| **M1 – Fundament** | Auth, Invite-first-Onboarding, Vereins- und Team-Workspace, Mitglieder, i18n, Theming | Verein in 3 Minuten gegründet, Mitglied in 60 Sekunden beigetreten |
| **M2 – Agenda-Loop** | Termine, Helfer-Schichten, Zu-/Absagen, QR-Check-in, Punkte-Ledger, Dashboard | Der Kern-Loop lebt: Termin besuchen → Punkte sehen |
| **M3 – Gemeinschaft** | Leaderboards, Aufgaben-Marktplatz, News, Push, Vereins-Puls, Stimme, Health | Wertschätzung und Fürsorge werden spürbar |
| **M4 – Anschlüsse** | Billing-Integration, Verbands-Add-on, Bulk-Import, Eltern/Kinder | Bestandsvereine migrieren vollständig |

---

## 15. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Punkte erzeugen Druck statt Freude | Opt-out für Ranglisten, keine Bestrafung, Kudos vor Punktzahl, Konfig-Option «nur Dank» |
| Die Summe der Funktionen überfordert den Vorstand | Zero-Config-Start, progressive Aktivierung im Tempo des Vereins (K7) |
| Das Frühwarnsystem wird als Überwachung erlebt | Anti-Überwachung als Architektur (§10), Transparenz-Seite, Opt-out, Symmetrie zu Vorstands-Signalen |
| Manipulierte Anwesenheiten | QR-Token mit Zeitfenster, serverseitige Validierung, Bestätigung durch Verantwortliche |
| Immer dieselben erledigen die Aufgaben | Verteilungs-Transparenz, Verantwortungsverteilung als Kennzahl, Beitrags-Matching statt Ausschreibung |
| Anonymer Kanal versandet | Status-Pflicht, Anmahnung unbeantworteter Anliegen, «Ihr habt gesagt – wir haben gemacht» |
| Google-Freiheit kostet Push-Komfort auf Android | ntfy/UnifiedPush plus In-App-Inbox als vollständiger Fallback |

---

## 16. Das Manifest in einem Absatz

*myclub existiert, damit Ehrenamt tragfähig bleibt: damit Menschen sich in ihrem Verein verbunden
fühlen, Verantwortung teilen können und nicht an ihrem Engagement zerbrechen. Wir bauen das Werkzeug,
mit dem Vorstände ihre Mitglieder regelmässig mitnehmen – was passiert, woran wir arbeiten, wo du
dabei sein kannst –, Verantwortung anbieten statt ausschreiben, jeden Beitrag sichtbar würdigen und
früh erkennen, wo jemand Unterstützung braucht: Mitglieder wie Vorstände. Dabei gilt: Verbindung vor
Aufruf, Verantwortung beginnt beim Vorstand, Struktur vor Sichtbarkeit, machbar statt perfekt, selbst
getan statt nur gesagt – und: Sinn ist der Motor, Punkte machen ihn nur sichtbar.*

> **Leitspruch: «Jeder Einsatz zählt – mach ihn sichtbar.»**
