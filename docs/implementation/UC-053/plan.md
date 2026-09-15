# Implementation Plan: UC-053 — Profil einrichten

|                   |                                                                     |
| ----------------- | ------------------------------------------------------------------- |
| **Primary Actor** | Mitglied                                                            |
| **Goal**          | Nach dem Beitritt einmal durch Bild, Name, Erreichbarkeit und Meldungen führen – überspringbar, jeder Schritt sofort wirksam |
| **Plan created**  | 2026-09-15                                                           |
| **Status**        | **Partial** – Migration `0105` geschrieben und gegen die laufende Datenbank geprüft (Teil der 40/40 aus UC-052, zurückgerollt). Nicht eingespielt; bis dahin hält sich der Assistent zurück (`isSetupAvailable()`) |

## Overview

Sandros Befund vom 15.09.2026: «dazu fehlt eigentlich neben dem club onboarding
flow auch ein profile onboarding flow, wo das profilbild, name etc sowie push
meldungen aktiviert werden können. die email sind ja standardmässig
eingestellt.»

Er hat recht, und das Ergebnis steht in der Mitgliederliste: `request_join()`
setzt den Anzeigenamen beim Beitritt auf den Teil vor dem @ (`0010`). Wer
danach nichts tut – und das ist der Normalfall –, heisst dort für immer
`sandro`. Bild: keines. Gerät: keines.

**UC-051 war das Gegenstück für den Verein.** Dort führt ein Assistent den
Vorstand durch Verband, Teams, Beispielinhalte und Mitglieder. Für die Person
gab es nichts Entsprechendes: Bild, Name und Meldungen liegen hinter drei
verschiedenen Blättern, von denen keines sie darauf anspricht.

**Der vierte Schritt ist der Grund, warum es diese Seite gibt.** Push verlangt
eine Erlaubnis, und eine Erlaubnisfrage, die unvermittelt auf dem Dashboard
aufgeht, wird weggetippt – einmal abgelehnt, ist sie im Browser nur über die
Systemeinstellungen zurückzuholen. Hier steht sie am Ende eines Gesprächs, das
die Person selbst begonnen hat, mit einem Satz, der sagt, wofür sie gut ist.

## Related Use Cases

- **UC-051** Verein einrichten – dieselbe Schrittführung (`Wizard`), das andere Gegenüber; `/tabs/profile/setup` gehört ihm, der Profil-Assistent liegt auf `/tabs/profile/onboarding`
- **UC-008** Profil pflegen – dieselben Felder über `ProfileEditForm`; der Assistent ersetzt sie nicht, er stellt sie einmal zur richtigen Zeit
- **UC-045** Bilder – `ImagePicker` und `set_member_avatar()`
- **UC-028** / **UC-052** – die Meldungen und ihr Versand

---

## Requirements & Business Rules Traceability

### Functional Requirements

| ID     | Titel                          | Status vorher | Ziel        | Notizen                                                        |
| ------ | ------------------------------ | ------------- | ----------- | -------------------------------------------------------------- |
| FR-200 | Profil einrichten (Assistent)  | neu           | Partial     | `ProfileSetupPage`, `lib/profileSetup.ts`, `0105` – gebaut, nicht eingespielt |
| FR-163 | Strukturierte Stammdaten       | Implemented   | Implemented | Unverändert – der Assistent schreibt über `update_my_profile()` |
| FR-166 | Profilbild                     | Implemented   | Implemented | Unverändert – derselbe `ImagePicker` wie im Profil-Blatt        |
| FR-144 | Leere Zustände mit Angebot     | Implemented   | Implemented | Die Dashboard-Zeile ist eines                                   |

### Business Rules

| ID     | Regel | Wo sie steht |
| ------ | ----- | ------------ |
| BR-270 | Der Assistent ist ein Angebot: übersprungen **ist** eine Antwort | `finish_profile_setup()` beim Beenden **und** beim Überspringen; `shouldStartSetup()` |
| BR-214 | An der eigenen Zeile ändert ein Mitglied nur die Rangliste | `profile_setup_at` steht **nicht** in der Erlaubnisliste von `0085` – die Funktion bringt ihre Prüfung mit |
| BR-028 | Die Entscheide gehören der Person | `finish_profile_setup()` weist eine fremde Mitgliedschaft ab |
| BR-031 / BR-208 | Ein Mitglied trägt immer einen Anzeigenamen; ohne eigenen tragen ihn Vor- und Nachname | `isNameStepComplete()`, und dahinter `update_my_profile()` |

---

## Entscheide

| Frage | Entscheid | Warum |
| --- | --- | --- |
| Wann geht der Assistent auf | **Einmal nach dem Beitritt, überspringbar** (Sandros Wahl) | Eine Hürde vor dem Dashboard wäre das Gegenteil des Zero-Config-Starts (BR-002). |
| Wo wird «schon gefragt» festgehalten | **An der Mitgliedschaft**, nicht im Gerät | Im Gerät gälte es je Browser; wer das Telefon wechselt, verlöre die Antwort. Und das Profil hängt ohnehin an der Mitgliedschaft – im zweiten Verein wird neu gefragt. |
| Eine Spalte oder zwei (fertig vs. übersprungen) | **Eine** | Für die App sind beide dasselbe: nicht noch einmal ungefragt. Der Weg zurück hängt nicht daran, sondern am Zustand des Profils. |
| Wann verschwindet die Dashboard-Zeile | Sobald **ein Bild oder ein gewählter Name** da ist | Eine hohe Schwelle machte aus dem Angebot eine Mahnung. Wer kein Bild will, tippt einen Namen und ist sie los. |
| Mitglieder ohne Konto in der Nachmigration | **Bleiben offen** | Sie hat noch niemand gefragt – beim ersten Anmelden sollen sie den Assistenten sehen, gerade wegen des Push-Schritts. Am Bestand geprüft: 176 von 177. |
| Route | `/tabs/profile/onboarding` | `/tabs/profile/setup` ist seit UC-051 der **Vereins**-Assistent. Zwei Assistenten auf einer Adresse wären ein stiller Fehler; ein Test hält den Unterschied fest. |

---

## Umsetzung

| Datei | Was |
| --- | --- |
| `supabase/migrations/0105_profile_setup.sql` | `club_members.profile_setup_at`, Nachmigration des Bestands, `finish_profile_setup()` |
| `app/src/lib/profileSetup.ts` | Route, Schritte, `isPlaceholderName()`, `isProfileStarted()`, `shouldStartSetup()`, `shouldOfferSetupCard()`, `isNameStepComplete()` |
| `app/src/pages/ProfileSetupPage.tsx` | Die vier Schritte |
| `app/src/components/ProfileSetupCard.tsx` | Die Zeile auf dem Dashboard |
| `app/src/hooks/useProfile.ts` | `useFinishProfileSetup()` |
| `app/src/pages/DashboardPage.tsx` | Der einmalige Start und die Zeile |
| `app/src/pages/ProfilePage.tsx` | Der Weg zurück, dauerhaft |
| `app/src/pages/TabsPage.tsx` | Route |
| `app/src/i18n/locales/*.json` | `profileSetup.*` in vier Sprachen |

---

## Prüfung

- **Migration gegen die laufende Datenbank** (Teil der 40/40 aus UC-052): Spalte da, Nachmigration greift für Konten (offen: 0) und lässt Mitglieder ohne Konto in Ruhe (176), `finish_profile_setup()` hält fest, verschiebt beim zweiten Mal nichts und weist eine fremde Mitgliedschaft ab.
- **BR-214 strukturell statt am Verhalten:** Im Projekt gibt es nur noch **ein** Konto, und das ist der Vorstand seines Vereins – `members_admin_write` erlaubt ihm die ganze Zeile. Geprüft ist deshalb, dass die Erlaubnisliste aus `0085` weiterhin nur `leaderboard_opt_in` nennt und die neue Spalte nicht ausnimmt. Am Verhalten nachzuholen, sobald ein zweites Konto existiert (Testplan TC-009).
- **Vitest:** `profileSetup.test.ts`, 17 Prüfungen – darunter, dass die Route nicht die des Vereins-Assistenten ist.

---

## Offen

1. **`supabase db push`** – gehört Sandro.
2. **Gerätetest** – `docs/test-plans/uc-053-profil-einrichten.md`.
3. **BR-214 am Verhalten**, sobald ein zweites, nicht-vorständiges Konto existiert.
