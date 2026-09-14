# Implementation Plan: UC-043 — Mitgliederdaten strukturieren und exportieren

|                   |                    |
| ----------------- | ------------------ |
| **Primary Actor** | Vorstand           |
| **Goal**          | Die Mitgliederliste des Vereins oder eines Teams als Datei herausgeben – mit Stammdaten, die vollständig genug sind, dass die Datei extern weiterverwendet werden kann |
| **Plan created**  | 2026-09-14         |
| **Status**        | Implemented – `0081` und `0082` sind eingespielt und gegen die laufende Datenbank geprüft |

## Overview

Die bestehende myclub-App kann Mitglieder exportieren: als Verein
(`club-member-list`) und je Team (`team-member-list`), mit wählbaren Feldern
(E-Mail, Telefon, Geburtsdatum, Adresse, Teams, Funktionen). nexus kann das
heute nicht – FR-130 steht auf `Deferred`, und der MVP-Schnitt nennt den
Mitglieder-Export ausdrücklich als Post-MVP (`MVP_Scope_myclub.md` Zeile 52).
**Der Projektinhaber hat ihn am 2026-09-14 bestellt; damit ist FR-130 gezogen,
nicht stillschweigend erweitert.**

Der Export allein genügt nicht. Was nexus über ein Mitglied weiss, ist
schmaler als das, was die alte App wusste: Der Anzeigename ist **ein** String,
die Adresse **ein** Fliesstext (`member_contacts.address`, 0063), ein
Geburtsdatum gibt es nicht. Eine Datei aus diesen Feldern liesse sich weder
nach Nachnamen sortieren noch für Post oder Rechnungen brauchen. Die
strukturierten Stammdaten sind deshalb Teil dieses Use Case, nicht ein
Nachfolgeprojekt.

Zwei Dinge sind ausdrücklich **nicht** hier:

- **Bilder** (Vereinslogo, Teambild, Profilbild) – eigener Use Case UC-044.
  Der Projektinhaber hat sie am 2026-09-14 zusammen mit dem Export gewünscht
  und im selben Satz für den Export als nicht relevant bezeichnet.
- **J+S-Felder** (AHV-Nummer, Geschlecht, Nationalität, Lizenznummer). Sie
  stehen in der alten App im Profil und dienen allein FR-131, das `Deferred`
  bleibt. Personendaten ohne Verwendung zu erheben, widerspricht §11.4a der
  Vision. Wer FR-131 zieht, zieht sie mit.

## Related Use Cases

- **UC-007** – Mitglieder und Teams verwalten: liefert die Liste, die hier herausgeht, und trägt den Einstieg.
- **UC-008** – Profil und Datenschutz-Optionen pflegen: dort entstehen die Stammdaten; `update_my_profile()` wächst um die strukturierten Felder.
- **UC-040** – Bisherige App übernehmen: liefert Vor- und Nachname bereits getrennt an und kann sie künftig getrennt ablegen.
- **UC-041** – Funktionärsamt mit Factsheet: liefert die Spalte «Ämter».
- **UC-042** – Saisonziel: sein CSV-Export ist das Vorbild für Aufbau, Trennzeichen und Weg aus der App.
- **C-032** – Trainer-Team-Scope: bestimmt, wer welchen Ausschnitt exportieren darf.

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Title | User Story (summary) | Status  | Notes |
| ------ | ----- | -------------------- | ------- | ----- |
| FR-130 | Mitglieder-Export | Als Vorstand möchte ich Mitgliederdaten mit wählbaren Feldern exportieren, damit ich sie extern weiterverwenden kann. | Implemented | `export_members()` + `ManageSection` in `MemberPage` (Verein) und `TeamDetailModal` (Team). Aus `Deferred` gezogen. |
| FR-163 | Strukturierte Stammdaten | Als Mitglied möchte ich Vorname, Nachname, Geburtsdatum und meine Adresse in einzelnen Feldern pflegen, damit Verein und Export sie richtig verwenden. | Implemented | `club_members.first_name`/`last_name`, `member_contacts.birth_date`/`street`/`house_number`/`postal_code`/`city`/`country`. |
| FR-018 | Eigenes Profil pflegen | (bestehend) | Implemented | Wächst um die Felder aus FR-163; `ProfileEditModal` bekommt einen Adressblock. |
| FR-013 | Mitgliederliste | (bestehend) | Implemented | Trägt den Einstieg zum Vereinsexport. |
| FR-019 | Datenschutz-Optionen | (bestehend) | Implemented | Entscheidet, was die Trainer:in im Team-Export sieht (BR-206). |

### Business Rules

| ID     | Rule | Status  | Notes |
| ------ | ---- | ------- | ----- |
| BR-205 | **Der Export trägt die Reichweite seiner Aufrufer:in.** Den ganzen Verein exportiert nur der Vorstand; ein Team exportiert, wer für dieses Team planen darf. | Implemented | `export_members()` prüft `is_club_board()` bzw. `can_plan_for_team()` – nicht das UI. |
| BR-206 | **Was die Trainer:in exportiert, ist die Kaderliste, nicht die Kartei.** Ohne Adresse, ohne Geburtsdatum; E-Mail und Telefon nur, wo die Person sie freigegeben hat. | Implemented | Fortschreibung von `emergency_contact()` (0063): «Die Adresse bleibt beim Vorstand». Der Vorstand exportiert vollständig. |
| BR-207 | **Die Adresse steht in Feldern, nicht in einem Fliesstext.** Strasse, Hausnummer, Postleitzahl, Ort, Land – die Postleitzahl als Text. | Implemented | Die alte App führte `postalcode` als Zahl; führende Nullen und nicht-schweizerische Codes überleben das nicht. |
| BR-208 | **Ein Anzeigename bleibt.** Vor- und Nachname sind die Struktur darunter; sind beide gesetzt, schreiben sie `display_name` fort. Ein Mitglied ohne getrennte Namen behält seinen Anzeigenamen. | Implemented | `display_name` bleibt `not null` und die einzige Quelle für jede Anzeige (`initials()`, `firstName()`). |
| BR-209 | **Der Export ist eine Momentaufnahme, kein Abonnement.** Keine Datei auf dem Server, keine Kopie im Verein, kein Protokoll darüber, wer wen exportiert hat. | Implemented | Die Zeilen entstehen im Aufruf und gehen direkt ins Teilen-Blatt bzw. in den Download. |

### Constraints

| ID | Constraint | Auswirkung |
| -- | ---------- | ---------- |
| C-009 | Kein Sportvokabular im Kern | Spaltenköpfe kommen aus i18n, nicht aus der Datenbank. |
| C-032 | Geltungsbereich nach Team | BR-205; `can_plan_for_team()` ist die Vorlage. |
| — | PWA-Precache 2 MiB | **Keine neue Bibliothek.** Der Export ist CSV aus einer reinen Funktion, wie in UC-042; `xlsx` (die alte App) wären ~430 kB im Hauptchunk. |

---

## Ablauf

### Hauptablauf (Vorstand, ganzer Verein)

1. Der Vorstand öffnet die Mitgliederliste und filtert sie wie gewohnt.
2. Am Ende der Seite steht unter «Verwalten» der Weg «Mitglieder exportieren».
3. Ein Blatt fragt, welche Felder mitgehen sollen (Voreinstellung wie in der
   alten App: E-Mail, Telefon, Geburtsdatum, Adresse, Ämter – Teams aus).
4. «Exportieren» holt die Zeilen über `export_members()`, baut die CSV und
   gibt sie heraus: nativ ins Teilen-Blatt, im Browser als Datei.
5. Ein Toast bestätigt.

### A1 — Trainer:in, ein Team

1. Die Trainer:in öffnet ihr Team in der Teamliste.
2. Unter «Verwalten» steht «Team exportieren».
3. Dieselbe Feldauswahl, aber Adresse und Geburtsdatum fehlen (BR-206).
4. Weiter wie im Hauptablauf.

### A2 — Der Filter steht auf einem Team

Filtert der Vorstand die Mitgliederliste auf ein Team, exportiert der Weg
dieses Team. Die Datei heisst dann nach dem Team.

### E1 — Keine Zeilen

Ein leerer Ausschnitt erzeugt keine Datei, sondern einen Hinweis.

---

## Tasks

| # | Task | Datei | Status |
| - | ---- | ----- | ------ |
| 1 | Migration: strukturierte Stammdaten, Bestand übernehmen, `update_my_profile()` erweitern | `supabase/migrations/0081_member_profile_fields.sql` | erledigt |
| 2 | Migration: `export_members()` mit Reichweite und Datenschutz | `supabase/migrations/0082_member_export.sql` | erledigt |
| 3 | Reine Logik: Spalten, Zeilen, CSV | `app/src/lib/memberExport.ts`, `app/src/lib/csv.ts` | erledigt |
| 4 | Hook: `useMemberExport()` | `app/src/hooks/useMembers.ts` | erledigt |
| 5 | Blatt: Feldauswahl | `app/src/components/MemberExportModal.tsx` | erledigt |
| 6 | Einstieg Verein | `app/src/pages/club/MemberPage.tsx` | erledigt |
| 7 | Einstieg Team | `app/src/components/TeamDetailModal.tsx` | erledigt |
| 8 | Adressblock im Profilformular, `DateField max` | `app/src/components/ProfileEditModal.tsx`, `DateField.tsx` | erledigt |
| 9 | Anzeige der Adresse im Mitglied-Detail (`addressLines()`) | `app/src/pages/club/MemberPage.tsx`, `app/src/lib/member.ts` | erledigt |
| 10 | i18n in vier Sprachen | `app/src/i18n/locales/*.json` | erledigt – 1615 Schlüssel |
| 11 | Vitest | `memberExport.test.ts`, `member.test.ts`, `MemberExportModal.test.tsx`, `ProfileEditModal.test.tsx` | erledigt – 1081 Tests grün |
| 12 | Verhaltensprüfung gegen die laufende Datenbank | Probe | erledigt – 13 Prüfungen, siehe unten |
| 13 | `ai-code-review` und Befunde beheben | — | erledigt |
| 14 | Manueller Testplan | `docs/test-plans/uc-043-mitglieder-export.md` | erledigt |
| 15 | Statusabgleich in `requirements.md`, `use_cases/README.md`, `entity_model.md`, `MVP_Scope_myclub.md` | — | erledigt |

---

## Der Review und was er gefunden hat

Der Durchgang (Schritt 4 der Arbeitsweise) hat **vierzehn** Befunde gebracht,
davon vier schwere. Alle sind behoben; die vier wichtigsten stehen hier, weil
sie Regeln betreffen und nicht nur Code:

1. **Der Export gab der Sportchef:in die ganze Kartei.** `export_members()`
   entschied den Umfang mit `is_club_board()` – und das schliesst `sportchef`
   ein. Die Policy `member_contacts_own` (0013) und `emergency_contact()`
   (0063) tun das ausdrücklich **nicht**: Die Sportchef:in darf für ihren
   Bereich planen, nicht die Kartei lesen. Über den Export hätte sie Adressen
   und Geburtsdaten bekommen, die ihr das Mitglied-Detail verweigert. Die
   Regel stand damit zweimal verschieden im Repository. Jetzt entscheidet
   `is_club_admin()` den Umfang und `can_plan_for_team()` die Reichweite –
   zwei Fragen, zwei Prüfungen.
2. **Ausgeblendete Kästchen schalteten das Feld nicht ab.** Das Blatt versteckte
   Adresse und Geburtsdatum vor der Trainer:in, schickte die Voreinstellung
   aber ungefiltert in den CSV-Bauer: fünf leere Spalten. `effectiveExportOptions()`
   ist der Riegel dahinter, und `memberExport.test.ts` hält ihn fest.
3. **Der Team-Export war gebaut und unerreichbar.** Der einzige Weg zur
   Teamliste stand hinter `isAdmin` – die Trainer:in, für die A1 geschrieben
   ist, kam nie dorthin. Der Eintrag «Teams» steht jetzt vor dem
   Vorstandsblock, und der Export-Weg im Team-Blatt erscheint nur, wo
   `canPlanFor(team.id)` gilt. (Fundmuster «gebaut und unerreichbar» aus der
   Arbeitsweise – zum wiederholten Mal.)
4. **Der Umbau der Adresse hätte Text abgeschnitten.** `address` durfte 200
   Zeichen tragen, `street` nur 120 – ein nicht zerlegbarer Fliesstext wäre
   um 80 Zeichen kürzer geworden, und danach fiel die Spalte. `street` fasst
   jetzt 200, und ein `do`-Block **zählt vor dem Fallenlassen**, ob eine Zeile
   mit gefüllter `address` ohne `street` zurückblieb; wenn ja, bricht die
   Migration ab.

Die übrigen zehn: Client und Server waren sich über «Vorstand» uneinig (folgt
aus 1); `display_name` wurde schon von **einem** Namen überschrieben, während
der Server beide verlangt; `country` konnte nur als roher Postgres-Fehler
auffallen (jetzt `validateProfileFields()`); `memberExport.done` ohne
Plural-Form; `string_agg` der Ämter ohne `order by`; die BOM- und
Download-Regel stand nach meiner eigenen Änderung wieder zweimal (jetzt
`deliverCsv()` in `lib/csv.ts`, von beiden Exporten benutzt); `placeholder="CH"`
als Literal; `update_my_profile()` legte für einen blossen Vornamen eine leere
Kontaktzeile an; `key={line}` über die Adresszeilen konnte kollidieren.

Zwei Fehler habe ich selbst danach gefunden: Das Team-Blatt hätte sich nach
dem Hochladen eines Bildes geschlossen (`onDone('silent')`), und die Vorschau
hätte das alte Bild gezeigt, weil `team` ein Abzug aus dem Seitenzustand ist.

---

## Die Verhaltensprüfung gegen die laufende Datenbank

`0081` und `0082` sind am 14.09.2026 eingespielt (`supabase db push
--include-all`, nachdem `0084` einer Parallelsitzung schon stand), die Typen
danach neu erzeugt und der Übergangsblock in `app/src/lib/database.types.ts`
gelöscht.

Geprüft wurde in drei Durchgängen unter `role authenticated` mit gesetzten
`request.jwt.claims`, jeder in einem `do`-Block, der am Ende mit einer
Ausnahme zurückrollt. Gemessen werden **Zeilen und Werte**, nicht abgefangene
Ausnahmen. Verein: der übernommene Kadetten-Bestand mit 177 Mitgliedern.

| Prüfung | Ergebnis |
| ------- | -------- |
| Vorstand, ganzer Verein | 177 Zeilen |
| Vorstand sieht Adresse und Geburtsdatum | «Musterstrasse» / 1990-04-05 |
| Vorstand, ein Team | 2 Zeilen |
| Trainer:in, ganzer Verein (BR-205) | **0 Zeilen** |
| Trainer:in, eigenes Team | 2 Zeilen, Adresse `NULL`, Geburtsdatum `NULL`, E-Mail `NULL` (BR-206, `privacy` leer) |
| Trainer:in, fremdes Team (BR-205) | **0 Zeilen** |

Vorher belegt, noch ohne Push: die Adress-Zerlegung aus `0081` über sechs
Schreibweisen («Strasse 12, 8000 Ort», dieselbe über zwei Zeilen, «CH-8000»,
eine deutsche Postleitzahl mit führender Null, «Postfach, 3000 Bern», ein
Fliesstext ohne alles) – alle zerfallen richtig, die führende Null überlebt.
Und: `member_contacts` trug 178 Zeilen und **keine einzige** gefüllte
`address`, das Fallenlassen der Spalte war auf diesem Projekt folgenlos.

Ein Befund kam dabei heraus, der nicht im Code lag, sondern in der Probe: Der
erste Anlauf stufte die eigene Rolle mitten im Durchgang herunter – und wurde
vom neuen Trigger aus `0085` abgewiesen. Der Riegel hat also gehalten, bevor
er dafür geprüft war.
