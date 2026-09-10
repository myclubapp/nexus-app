# Manual Test Plan: UC-033 — Beitrags-Profil erfassen

**Use Case:** [UC-033](../use_cases/UC-033-beitrags-profil-erfassen.md)
**Geltungsbereich:** Profil, Matching, Zeitbudget, Ämter, jährliche Frage, Freiwilligkeit
**Anforderungen:** FR-058, FR-059
**Regeln:** BR-142 bis BR-145
**Erstellt:** 2026-09-10

## Vorbereitung

- **A** — Mitglied mit Interesse «Verpflegung», Budget monatlich, im Team «Aktive».
- **B** — Mitglied **ohne** Profil.
- **C** — Mitglied mit Interesse «Organisation», Budget einmalig, ohne Team.
- **D** — Mitglied mit Interesse «Verpflegung», Budget einmalig, bereits eine
  Aufgabe übernommen.
- **V** — Vorstand, schreibt aus. **TR** — Trainer:in.
- Migration `0051_contribution_profile.sql` ist eingespielt.
- Ein vakantes Amt «Aktuariat» besteht (UC-031).

---

## TC-001: Anfragen statt abfragen (BR-142, FR-058)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **B** den Marktplatz öffnen | Der Abschnitt «Beitrags-Profil» lädt ein – als Zeile, nicht als Sperre | | |
| 2 | Die Einladung antippen | Das Blatt öffnet sich | | |
| 3 | Die Reihenfolge im Blatt prüfen | **Zuerst** «Was wäre für dich ein sinnvoller Beitrag?», **danach** die Kategorien | | |
| 4 | Die Kategorienliste öffnen | Genau die acht Kategorien des Marktplatzes – keine zweite Liste | | |
| 5 | Die Auswahl in einer anderen Sprache öffnen | «Abbrechen»/«OK» übersetzt | | |
| 6 | Einen Satz schreiben, «Verpflegung» wählen, «Monatlich» tippen | Unter dem Segment steht «1 Beitrag im Zeitraum» | | |
| 7 | «Saisonal» tippen | Die Zahl wechselt auf 3 – sie kommt aus dem Code, nicht aus dem Text | | |
| 8 | Speichern | Toast «Gespeichert. Die Vorschläge richten sich ab jetzt danach.» | | |
| 9 | Das Blatt erneut öffnen | Die Angaben stehen da, darunter «Zuletzt gepflegt am …» (A2) | | |

---

## TC-002: Das Profil ist freiwillig (BR-143)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **B** das Blatt öffnen und ohne Eingabe speichern | Geht durch – «später ausfüllen» ist ein Weg, kein Abbruch (A1) | | |
| 2 | Den Hinweis im Blatt lesen | «Alles freiwillig … niemand erfährt, wer keines führt» | | |
| 3 | Als **B** den Marktplatz nutzen | Alle offenen Aufgaben sichtbar, Übernehmen möglich – nichts fehlt | | |
| 4 | Als **V** nach einer Liste suchen, wer kein Profil hat | Es gibt keine | | |
| 5 | Als **V** `member_contribution_profiles` direkt abfragen | Kein Zugriff – die Policy gibt nur die eigene Zeile heraus | | |
| 6 | Als **TR** dasselbe versuchen | Ebenfalls nicht | | |
| 7 | Eine Aufgabe der Kategorie «Verpflegung» ausschreiben | **B** ohne Profil bekommt die Meldung wie bisher | | |
| 8 | Prüfen, ob ein fehlendes Profil ein Signal auslöst | Nein (BR-145) | | |

---

## TC-003: Aus der Ausschreibung wird ein Angebot (FR-059, BR-142)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** eine Aufgabe «Verpflegung» ausschreiben | Vorbereitung | | |
| 2 | Als **A** die Inbox prüfen | Meldung – das Angebot passt zum Profil | | |
| 3 | Als **C** («Organisation») die Inbox prüfen | **Keine** Meldung: Wer gesagt hat, was ihn interessiert, wird nicht mit allem behelligt | | |
| 4 | Als **B** (ohne Profil) prüfen | Meldung wie bisher (BR-143) | | |
| 5 | Als **V** prüfen | Keine Meldung – wer ausschreibt, übernimmt nicht sich selbst | | |
| 6 | Als **A** den Marktplatz öffnen | Der Abschnitt «Für dich» steht **über** der offenen Liste | | |
| 7 | Den Fussnotentext lesen | «Angeboten, nicht ausgeschrieben» | | |
| 8 | Eine Team-Aufgabe für «Aktive» ausschreiben | Nur **A** (im Team) bekommt sie, **C** nicht | | |
| 9 | Eine Aufgabe als Entwurf anlegen | Sie erscheint in keinem «Für dich» | | |
| 10 | Eine Aufgabe als Beispielinhalt markieren und ausschreiben | Keine Zustellung (BR-161) | | |
| 11 | Eine bereits volle Aufgabe prüfen | Sie wird nicht mehr angeboten | | |

---

## TC-004: Das Zeitbudget wird respektiert (BR-144, A4)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **D** (einmalig, eine Aufgabe übernommen) den Marktplatz öffnen | «Für diesen Zeitraum hast du genug getan.» statt einer leeren Liste | | |
| 2 | Den Zusatz lesen | Er sagt, dass die offene Liste unten weiter offen steht | | |
| 3 | Eine passende Aufgabe ausschreiben | **D** bekommt **keine** Meldung | | |
| 4 | Als **D** die offene Liste prüfen | Übernehmen ist trotzdem möglich – das Budget bremst den Vorschlag, nicht die Person | | |
| 5 | Als **A** (monatlich) eine Aufgabe übernehmen | Danach erscheinen keine persönlichen Vorschläge mehr | | |
| 6 | Im nächsten Monat prüfen | Die Vorschläge kommen wieder | | |
| 7 | Als **B** ohne Profil prüfen | Der Satz «genug getan» erscheint **nie** – kein Budget ist nicht null | | |
| 8 | Als **D** das Profil auf «Saisonal» ändern | Das Budget rechnet neu, bis zu drei Beiträge | | |

---

## TC-005: Ämter werden angeboten (FR-059, Ziel)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **C** («Organisation») den Marktplatz öffnen | Abschnitt «Ämter, die zu dir passen» mit «Aktuariat» | | |
| 2 | Den Fussnotentext lesen | «Kein Druck – nur die Information» | | |
| 3 | Als **A** («Verpflegung») prüfen | Kein Ämter-Abschnitt – ein Amt ist kein Kochen | | |
| 4 | Das Amt besetzen (UC-031) und neu laden | Es verschwindet aus dem Abschnitt | | |
| 5 | Als **B** ohne Profil prüfen | Kein Abschnitt | | |

---

## TC-006: Kein Treffer ist keine Fehlanzeige (A3)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **A** bei leerem Marktplatz die Seite öffnen | «Derzeit passt nichts zu deinem Profil.» | | |
| 2 | Den Zusatz lesen | «Wir melden uns, sobald etwas dazukommt. Suchen musst du nicht.» | | |
| 3 | Eine passende Aufgabe ausschreiben | **A** bekommt die Meldung und findet sie unter «Für dich» | | |
| 4 | Die Netzverbindung trennen und die Seite neu laden | Der Abschnitt zeigt einen Fehler mit «Nochmals versuchen» – nicht «nichts passt» | | |

---

## TC-007: Nicht Teil der Führungssicht (BR-145)

**Priority:** High

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Als **V** die Vereins-Gesundheit öffnen | Keine Interessen, keine Stärken, kein Zeitbudget | | |
| 2 | Als **TR** die Team-Ansicht öffnen | Ebenfalls nichts davon | | |
| 3 | Als **V** die Mitgliederverwaltung öffnen | Das Profil erscheint an keiner Zeile | | |
| 4 | Prüfen, ob ein Profil ein Signal auslöst | Nein | | |
| 5 | Prüfen, ob ein **fehlendes** Profil ein Signal auslöst | Nein | | |
| 6 | `health_signals` auf Profilspalten prüfen | Keine | | |

---

## TC-008: Die jährliche Frage (Schritt 1, A1)

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | `select ask_contribution_profiles();` aufrufen | Wer noch nie gefragt wurde, bekommt «Womit trägst du gern bei?» | | |
| 2 | Den Aufruf wiederholen | Niemand bekommt sie ein zweites Mal | | |
| 3 | Als **B** «später ausfüllen» wählen und den Aufruf wiederholen | Keine erneute Frage | | |
| 4 | `asked_at` eines Mitglieds um 400 Tage zurückdatieren und aufrufen | Es wird wieder gefragt | | |
| 5 | Die Meldung antippen | Sie führt in den Marktplatz, wo die Einladung steht | | |
| 6 | `select * from cron.job where jobname = 'contribution-ask';` | Der Auftrag ist eingerichtet | | |

---

## TC-009: Vier Sprachen

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Das Blatt auf Französisch, Italienisch und Englisch öffnen | Alle Texte übersetzt, keine Schlüssel sichtbar | | |
| 2 | Die Zeitbudget-Zeile prüfen | Ein- und Mehrzahl stimmen je Sprache | | |
| 3 | Die Kategorienamen prüfen | Sie stimmen mit denen des Marktplatzes überein | | |
| 4 | Den Freiwilligkeits-Hinweis prüfen | Vollständig und nicht abgeschnitten | | |

---

## TC-010: iOS-Erscheinung und Bedienung

**Priority:** Medium

| Step | Action | Expected Result | Pass/Fail | Notes |
| ---- | ------ | --------------- | --------- | ----- |
| 1 | Den Marktplatz im iOS-Modus öffnen | Gruppierte Listen, grosser Titel klappt beim Scrollen zusammen | | |
| 2 | Das Profil-Blatt öffnen | Es fährt als Karte über die Seite | | |
| 3 | Das Blatt nach unten wischen | Es schliesst; nichts wurde gespeichert | | |
| 4 | Die drei Zeitbudgets mit dem Daumen bedienen | Alle ohne Zielen erreichbar (44 px) | | |
| 5 | Auf einem schmalen Gerät (320 px) prüfen | Die drei Stufen brechen nicht um | | |
| 6 | Den «Ändern»-Knopf in der Abschnittsüberschrift prüfen | Er steht rechts in der Überschrift, nicht als vierte Zeile | | |
| 7 | Während des Ladens hinsehen | Ein Skelett, kein Spinner | | |

---

## Offen

- **Wer ein Profil führt, bekommt weniger Meldungen als wer keines führt.** Das
  ist der Zweck (K3b: angeboten statt ausgeschrieben) und sieht wie eine
  Benachteiligung aus. Zu bestätigen mit den Stakeholdern.
- **Die Zahlen hinter «ausgeschöpft»** (1 einmalig, 1 monatlich, 3 saisonal)
  sind eine Annahme; die Spezifikation beziffert A4 nicht.
- **Das Sprachmemo aus Schritt 3** fehlt weiterhin (BR-125, offen seit UC-029);
  umgesetzt ist der Satz als Text.
- **Ämter tragen keine Kategorie.** Angeboten werden sie denen, die
  «Organisation» oder «Finanzen» genannt haben – eine Zuordnung, die niemand
  pflegen muss, aber auch keine feine.
- **Eine Vakanz-Ausschreibung im Marktplatz** ist Ausbaustufe 2
  (`MVP_Scope` §2); umgesetzt ist nur der persönliche Vorschlag.
