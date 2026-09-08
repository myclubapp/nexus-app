# Use Cases Overview

Übersicht der Akteure und ihrer Anwendungsfälle. Jeder Anwendungsfall ist in
[`use_cases/`](use_cases/) einzeln spezifiziert; die Zuordnung zu den Anforderungen steht im
[Index](use_cases/README.md).

Die Diagramme sind nach Fachbereichen getrennt, damit sie lesbar bleiben. Die IDs sind über das
gesamte Projekt hinweg eindeutig.

---

## Akteure

```mermaid
flowchart LR
    member([👤 Mitglied])
    guest([🚪 Gast])
    trainer([🏃 Trainer:in])
    board([🏛️ Vorstand])
    treasurer([💰 Kassier:in])
    system([🖥️ System])

    subgraph "Rollenverhältnis"
        R1[Jede Trainer:in\nist auch Mitglied]
        R2[Jeder Vorstand\nist auch Mitglied]
        R3[Kassier:in ist ein\nVorstandsmitglied]
        R4[Gast wird durch Beitritt\nzum Mitglied]
    end

    trainer --> R1
    board --> R2
    treasurer --> R3
    guest --> R4
    member --> R1
    system --> R4
```

---

## 1. Auth & Onboarding

```mermaid
flowchart LR
    guest([🚪 Gast])
    member([👤 Mitglied])
    board([🏛️ Vorstand])
    system2([🖥️ System])

    subgraph "myclub nexus – Auth & Onboarding"
        UC001[UC-001\nVerein gründen]
        UC002[UC-002\nPer Einladung beitreten]
        UC003[UC-003\nEinladung erstellen]
        UC004[UC-004\nBeitritts-Anfrage entscheiden]
        UC005[UC-005\nAnmelden]
        UC006[UC-006\nKonto löschen]
        UC037[UC-037\nBeispielinhalte verwalten]
    end

    board --> UC037
    system2 --> UC037
    board --> UC001
    board --> UC003
    board --> UC004
    guest --> UC002
    guest --> UC005
    member --> UC005
    member --> UC006
```

---

## 2. Mitglieder & Teams

```mermaid
flowchart LR
    member([👤 Mitglied])
    board([🏛️ Vorstand])

    subgraph "myclub nexus – Mitglieder & Teams"
        UC007[UC-007\nMitglieder, Rollen und\nTeams verwalten]
        UC008[UC-008\nProfil und Datenschutz-\nOptionen pflegen]
    end

    board --> UC007
    member --> UC008
```

---

## 3. Agenda

```mermaid
flowchart LR
    member([👤 Mitglied])
    trainer([🏃 Trainer:in])
    board([🏛️ Vorstand])

    subgraph "myclub nexus – Agenda"
        UC009[UC-009\nTermin erstellen]
        UC010[UC-010\nAuf einen Termin\nzu- oder absagen]
        UC011[UC-011\nHelfer-Event mit\nSchichten ausschreiben]
        UC012[UC-012\nHelfer-Schicht übernehmen]
        UC013[UC-013\nHelfer-Schicht bestätigen]
        UC014[UC-014\nQR-Check-in am Termin]
        UC015[UC-015\nUnentschlossene erinnern]
    end

    trainer --> UC009
    trainer --> UC014
    trainer --> UC015
    board --> UC011
    board --> UC013
    member --> UC010
    member --> UC012
    member --> UC014
```

---

## 4. Gamification

```mermaid
flowchart LR
    member([👤 Mitglied])
    board([🏛️ Vorstand])

    subgraph "myclub nexus – Gamification"
        UC016[UC-016\nPunkteregeln konfigurieren]
        UC017[UC-017\nAufgabe im Marktplatz\nausschreiben]
        UC018[UC-018\nAufgabe übernehmen\nund einreichen]
        UC019[UC-019\nAufgabe bestätigen\nund Kudos geben]
        UC020[UC-020\nPunktestand und\nNächste Punkte einsehen]
        UC021[UC-021\nPunkte manuell buchen\noder korrigieren]
        UC022[UC-022\nLeaderboard einsehen]
        UC033[UC-033\nBeitrags-Profil erfassen]
    end

    board --> UC016
    board --> UC017
    board --> UC019
    board --> UC021
    board --> UC022
    member --> UC018
    member --> UC020
    member --> UC022
    member --> UC033
```

---

## 5. Vereins-Gesundheit

```mermaid
flowchart LR
    member([👤 Mitglied])
    trainer([🏃 Trainer:in])
    board([🏛️ Vorstand])
    system([🖥️ System])

    subgraph "myclub nexus – Vereins-Gesundheit"
        UC023[UC-023\nFürsorge-Hinweis\ntriagieren]
        UC024[UC-024\nEigene Wertdimensionen\neinsehen]
        UC025[UC-025\nTransparenz-Seite und\nHealth-Opt-out]
    end

    system --> UC023
    trainer --> UC023
    board --> UC023
    member --> UC024
    trainer --> UC024
    member --> UC025
```

---

## 6. News, Puls & Benachrichtigungen

```mermaid
flowchart LR
    member([👤 Mitglied])
    board([🏛️ Vorstand])
    system([🖥️ System])

    subgraph "myclub nexus – Kommunikation"
        UC026[UC-026\nVereins-News publizieren]
        UC027[UC-027\nVereins-Puls freigeben]
        UC028[UC-028\nBenachrichtigungen\neinstellen]
    end

    board --> UC026
    board --> UC027
    system --> UC027
    member --> UC028
```

---

## 7. «Stimme» & Dialog

```mermaid
flowchart LR
    member([👤 Mitglied])
    trainer([🏃 Trainer:in])
    board([🏛️ Vorstand])

    subgraph "myclub nexus – Stimme & Dialog"
        UC029[UC-029\nSprachmemo aufnehmen\nund adressieren]
        UC030[UC-030\nAnliegen beantworten]
        UC031[UC-031\nSitzungs-Input einreichen\nund zuordnen]
        UC032[UC-032\nKontext-Check-in\nbeantworten]
    end

    member --> UC029
    trainer --> UC029
    board --> UC030
    trainer --> UC030
    member --> UC031
    board --> UC031
    member --> UC032
```

---

## 8. Konfiguration & Anschlüsse

```mermaid
flowchart LR
    member([👤 Mitglied])
    board([🏛️ Vorstand])
    treasurer([💰 Kassier:in])
    external([📧 Externer Dienst])

    subgraph "myclub nexus – Konfiguration & Anschlüsse"
        UC034[UC-034\nVereinsidentität, Begriffe\nund Module konfigurieren]
        UC035[UC-035\nVerband verbinden]
        UC036[UC-036\nRechnungen einsehen und\nPunkte bei Zahlung]
    end

    board --> UC034
    board --> UC035
    treasurer --> UC036
    member --> UC036
    external --> UC035
    external --> UC036
```

---

## Nicht im Diagramm

Die im Anforderungskatalog mit dem Status `Deferred` geführten Anforderungen (FR-122 bis FR-133:
Badges, Level, Challenges, Rewards, Funktionärsämter, Meisterschaft, Eltern und Kinder, Exporte,
Bulk-Import, Kalender-Publishing) sind bewusst nach dem MVP eingeplant und haben deshalb noch
keinen Anwendungsfall.
