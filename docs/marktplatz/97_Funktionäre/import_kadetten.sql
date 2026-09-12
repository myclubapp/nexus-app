-- Erzeugt von build_factsheets.py – nicht von Hand ändern.
-- Ämter mit Factsheet für einen Verein (Migration 0070). Idempotent:
-- ein zweiter Lauf aktualisiert die Ämter und ersetzt die Belegung,
-- die noch keinem Mitglied zugeordnet ist.
do $import$
declare
  v_club uuid := 'bf4ebf3f-41c8-4e10-b8d5-a2daed8ae5cb';
  v_role uuid;
begin
  update functionary_roles set title = 'Kassier:in'
   where club_id = v_club and lower(title) = lower('Kassier')
     and not exists (select 1 from functionary_roles r
                      where r.club_id = v_club and lower(r.title) = lower('Kassier:in'));

  -- Apotheke_Factsheet.pdf → Apotheke_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Apothekenverantwortliche:r', '[{"title": "Zu Beginn der Saison den Apothekenkoffer kontrollieren und fehlende Materialien nachkaufen.", "detail": null}, {"title": "Einmal pro Monat überprüfen, ob etwas verbraucht wurde, und bei Bedarf nachkaufen.", "detail": null}, {"title": "Nach Turniertagen oder Spielen kurz kontrollieren, ob noch alles vollständig ist, und gegebenenfalls auffüllen.", "detail": null}]'::jsonb, '3h',
          '2', 1, 'Katja Fäh',
          v_club::text || '/' || 'Apotheke_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- Damentrainer_Factsheet.pdf → Damentrainer_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Damentrainer:in', '[{"title": "Trainingsbetrieb sicherstellen", "detail": "Planung, Organisation und Durchführung der Trainings."}, {"title": "Mannschaft sportlich führen", "detail": "Entwicklung von Spielkonzept, Taktik und Aufstellungen sowie Betreuung während Spielen."}, {"title": "Spieler fördern und motivieren", "detail": "Unterstützung der individuellen und mannschaftlichen Entwicklung sowie Förderung des Teamgeists."}, {"title": "Kommunikation und Organisation gewährleisten", "detail": "Koordination mit Spielern, Verein und weiteren Verantwortlichen sowie Sicherstellung eines reibungslosen Spielbetriebs."}, {"title": "Vereinswerte vertreten", "detail": "Vorbildliches Auftreten und Einhaltung der Vereins- und Verbandsrichtlinien in Training, Spiel und Öffentlichkeit."}]'::jsonb, '60+',
          '4 + Lohn', 1, 'Sandro Ehrbar',
          v_club::text || '/' || 'Damentrainer_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Jonathan Kissling', true);

  -- Eventorganisatoren_Factsheet.pdf → Eventorganisatoren_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Eventorganisator:in', '[{"title": "Hast du Lust, einen Vereinsanlass zu organisieren? Wir suchen motivierte Leute, die mit anpacken um unser Vereinsleben zu beleben", "detail": null}]'::jsonb, '4h+',
          '1-4', 1, 'Elias Haas',
          v_club::text || '/' || 'Eventorganisatoren_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- GOSU_Factsheet.pdf → GOSU_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Verantwortlicher Kommunikation und Abstimmung GOSU', '[{"title": "Abstimmung der benötigten Hallenkapazitäten zwischen dem Hallenverantwortlichen der GOSU und den Kadetten Unihockey Schaffhausen.", "detail": null}, {"title": "Sicherstellen, dass die zugewiesenen Halleneinheiten optimal ausgenutzt werden können. Optimaler Einsatz von Trainerressourcen und Förderung von Nachwuchsleitern.", "detail": null}, {"title": "Kontakt mit der Halle, ob keine Beschwerden von anderen Vereinen / Abwart geäussert werden.", "detail": null}]'::jsonb, '12',
          '4', 1, 'Matthias Regli',
          v_club::text || '/' || 'GOSU_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Andreas Kohler', false);

  -- H1Trainer_Factsheet.pdf → H1Trainer_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Trainer:in Herren 1', '[{"title": "Trainingsbetrieb sicherstellen", "detail": "Planung, Organisation und Durchführung der Trainings."}, {"title": "Mannschaft sportlich führen", "detail": "Entwicklung von Spielkonzept, Taktik und Aufstellungen sowie Betreuung während Spielen."}, {"title": "Spieler fördern und motivieren", "detail": "Unterstützung der individuellen und mannschaftlichen Entwicklung sowie Förderung des Teamgeists."}, {"title": "Kommunikation und Organisation gewährleisten", "detail": "Koordination mit Spielern, Verein und weiteren Verantwortlichen sowie Sicherstellung eines reibungslosen Spielbetriebs."}, {"title": "Vereinswerte vertreten", "detail": "Vorbildliches Auftreten und Einhaltung der Vereins- und Verbandsrichtlinien in Training, Spiel und Öffentlichkeit."}]'::jsonb, '60+',
          '4 + Lohn', 1, 'Sandro Ehrbar',
          v_club::text || '/' || 'H1Trainer_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- H2Trainer_Factsheet.pdf → H2Trainer_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Trainer:in Herren 2', '[{"title": "Trainingsbetrieb sicherstellen", "detail": "Planung, Organisation und Durchführung der Trainings."}, {"title": "Mannschaft sportlich führen", "detail": "Entwicklung von Spielkonzept, Taktik und Aufstellungen sowie Betreuung während Spielen."}, {"title": "Spieler fördern und motivieren", "detail": "Unterstützung der individuellen und mannschaftlichen Entwicklung sowie Förderung des Teamgeists."}, {"title": "Kommunikation und Organisation gewährleisten", "detail": "Koordination mit Spielern, Verein und weiteren Verantwortlichen sowie Sicherstellung eines reibungslosen Spielbetriebs."}, {"title": "Vereinswerte vertreten", "detail": "Vorbildliches Auftreten und Einhaltung der Vereins- und Verbandsrichtlinien in Training, Spiel und Öffentlichkeit."}]'::jsonb, '60h',
          '4 + Lohn', 1, 'Sandro Ehrbar',
          v_club::text || '/' || 'H2Trainer_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Andreas Schuler', false);

  -- Halle_BBC_Factsheet.pdf → Halle_BBC_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Hallenverantwortliche:r BBC', '[{"title": "Den Hallenplan jede Woche (montags) kontrollieren und bei belegter Halle kurz mit dem Trainer Kontakt aufnehmen.", "detail": null}, {"title": "Garderobeneinteilung für Turniertage und Einzelspiele in der Halle erstellen und an David Graubner senden.", "detail": null}, {"title": "Kommunikation bezüglich anstehender Events sicherstellen (insbesondere Hallenverfügbarkeit).", "detail": null}, {"title": "Sobald die Turnierdaten veröffentlicht sind, die Turniervergabe planen und mit David Graubner sowie Heinz Looser absprechen", "detail": null}]'::jsonb, '12h',
          '4', 1, 'Katja Fäh',
          v_club::text || '/' || 'Halle_BBC_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Lukas Jenny', false);

  -- Jubiläum_Festwirtschaft_Factsheet.pdf → Jubilaeum_Festwirtschaft_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'OK Jubiläum: Festwirtschaft', '[{"title": "Koordination der Festwirtschaft am Jubiläum", "detail": null}, {"title": "Mitarbeit im OK = 3-4 Sitzungen", "detail": null}, {"title": "Wer Wie Wo Was alles noch offen.", "detail": null}]'::jsonb, 'TBD',
          '4', 1, 'Elias Haas',
          v_club::text || '/' || 'Jubilaeum_Festwirtschaft_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- Jubiläum_Rahmenprogramm_Factsheet.pdf → Jubilaeum_Rahmenprogramm_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'OK Jubiläum: Rahmenprogramm', '[{"title": "Du organisiertst das Rahmenprogramm am Jubiläum", "detail": null}, {"title": "Für Ideen sind wir offen: DJ, Street Floorball, Spiele etc", "detail": null}, {"title": "Mitarbeit im OK = 3-4 Sitzungen", "detail": null}, {"title": "Wer Wie Wo Was alles noch offen.", "detail": null}]'::jsonb, 'TBD',
          '4', 1, 'Elias Haas',
          v_club::text || '/' || 'Jubilaeum_Rahmenprogramm_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- Juniorentrainer_Factsheet.pdf → Juniorentrainer_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Juniorentrainer:in', '[{"title": "Training leiten und vorbereiten", "detail": null}, {"title": "Meisterschaftsteilnahme ermöglichen", "detail": null}, {"title": "Idealerweise immer zwei bis drei Trainer pro Team", "detail": null}]'::jsonb, '60+',
          '4 + Lohn', 10, 'Matthias Regli',
          v_club::text || '/' || 'Juniorentrainer_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Angela Hablützel', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Edi Hablützel', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Esther Schuster', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Pascal Häberli', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Andreas Kohler', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Markus Günther', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Fabian Meier', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Felix Leuzinger', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Raffael Rüegger', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Hannes Stoll', false);

  -- Kassier_Factsheet.pdf → Kassier_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Kassier:in', '[{"title": "Verwaltung Mitgliederliste im Google Drive", "detail": null}, {"title": "Mitgliederbeiträge einfordern und Eingänge überwachen", "detail": null}, {"title": "Unterstützungsgelder einfordern (Windler Stiftung, Kopfgeld Stadt Schaffhausen, Juniorenförderungsbeiträge Stadt Schaffhausen, etc.)", "detail": null}, {"title": "laufende Rechnungen begleichen", "detail": null}, {"title": "Liquiditätsüberwachung", "detail": null}, {"title": "Buchhaltungsführung inkl. Rechnungsabschluss per 31. Mai", "detail": null}, {"title": "Erstellung Budget für Folgejahr", "detail": null}, {"title": "Revisionsunterlagen erstellen und Revisionsdurchführung mit Revisor", "detail": null}]'::jsonb, '10h+',
          '7', 1, 'Kevin Gysel',
          v_club::text || '/' || 'Kassier_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Kevin Gysel', false);

  -- Kopie von Eventorganisatoren_Factsheet.pdf → Kopie_von_Eventorganisatoren_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Streetfloorball-Verantwortliche:r', '[{"title": "Organisation einer geeigneten Location mit Stadt SH", "detail": null}, {"title": "Koordination Auf-/Abbau", "detail": null}, {"title": "Werbung machen in den Teams und Social Media", "detail": null}, {"title": "Umliegende Vereine auf angebot Aufmerksam machen", "detail": null}, {"title": "Zeitraum: Offen - kannst du bestimmen 🙂", "detail": null}, {"title": "Gelegentliche Kontrolle auf Beschädigung oder Diebstahl vom Material", "detail": null}]'::jsonb, '4h+',
          '4', 1, 'Elias Haas',
          v_club::text || '/' || 'Kopie_von_Eventorganisatoren_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- Pressechef_Factsheet.pdf → Pressechef_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Pressechef:in', '[{"title": "Sicherstellung der Spielberichterstattung", "detail": "Spielberichte einfordern oder bei Bedarf selbst erstellen (auf Basis Resultat, Liveticker, Matchdaten)."}, {"title": "Redaktion & Qualitätssicherung", "detail": "Texte korrigieren, kürzen und in eine einheitliche, veröffentlichbare Form bringen."}, {"title": "Publikation & Medienversand", "detail": "Berichte auf Webseite/unihockey.app publizieren und fristgerecht an Medien weiterleiten."}, {"title": "Vereinskommunikation & Inhalte koordinieren", "detail": "Berichte für Kadetten-Info sowie Quartals- und Jahresrückblicke bei Teams und Vorstand einfordern; nur bei Bedarf selbst erstellen."}, {"title": "Medien proaktiv informieren", "detail": "Zukünftige Spieltermine und Events aktiv an die Medien kommunizieren."}]'::jsonb, '12h',
          '4', 1, 'Jonathan Kissling',
          v_club::text || '/' || 'Pressechef_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Christph Schnetzler', false);

  -- Revisor_Factsheet.pdf → Revisor_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Revisor:in', '[{"title": "Sichtung und Prüfung der Vereinsbuchhaltung nach Abschluss per 31. Mai", "detail": null}, {"title": "Erstellung Revisionsbericht zu Handen GV", "detail": null}]'::jsonb, '2h',
          '1', 1, 'Kevin Gysel',
          v_club::text || '/' || 'Revisor_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Lukas Götz', false);

  -- Schiri_Factsheet.pdf → Schiri_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Schiedsrichter:in', '[{"title": "Leitung von Spielen", "detail": "Offizielle Leitung der zugeteilten Unihockeyspiele gemäss den aktuellen Reglementen und Weisungen von swiss unihockey."}, {"title": "Regelkenntnis und Weiterbildung", "detail": "Laufende Aktualisierung der Regelkenntnisse sowie Teilnahme an obligatorischen Aus- und Weiterbildungen des Verbandes."}, {"title": "Zuverlässige Einsatzwahrnehmung", "detail": "Rechtzeitige Annahme und Wahrnehmung der Aufgebote sowie selbstständige Organisation von Ersatz bei Verhinderung gemäss Verbandsvorgaben."}, {"title": "Vorbildliches Auftreten", "detail": "Fairer, respektvoller und neutraler Umgang mit Spielern, Trainern, Funktionären und Zuschauern sowie repräsentatives Auftreten für den Verein."}, {"title": "Unterstützung des Vereins", "detail": "Aktive Zusammenarbeit mit dem Schiedsrichterobmann und Einhaltung der Vorgaben von Kadetten UH Schaffhausen sowie des Verbandes."}]'::jsonb, '60h+',
          '3 + Lohn + Spesen', 6, 'Sandro Ehrbar',
          v_club::text || '/' || 'Schiri_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Andrin Vollenweider', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Johann Warren', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Patrick Koch', false);

  -- Schiriobmann_Factsheet.pdf → Schiriobmann_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Schiedsrichterobmann/-frau', '[{"title": "Schiedsrichterwesen koordinieren", "detail": "Planung, Organisation und Sicherstellung der Erfüllung aller Schiedsrichterpflichten des Vereins."}, {"title": "Rekrutierung und Betreuung", "detail": "Gewinnung, Einführung und Unterstützung von Schiedsrichterinnen und Schiedsrichtern sowie Ansprechperson für deren Anliegen."}, {"title": "Aus- und Weiterbildung fördern", "detail": "Sicherstellung der Teilnahme an Aus- und Weiterbildungen sowie Information über Reglemente und Verbandsvorgaben."}, {"title": "Kommunikation mit Verband und Verein", "detail": "Pflege des Austauschs mit dem Verband, dem Vorstand und den Vereinsmitgliedern in schiedsrichterrelevanten Belangen."}, {"title": "Administration und Kontrolle", "detail": "Verwaltung der Schiedsrichterdaten, Überwachung von Einsätzen und Fristen sowie Sicherstellung der Einhaltung der Verbandsvorschriften."}]'::jsonb, '8h',
          '2', 1, 'Sandro Ehrbar',
          v_club::text || '/' || 'Schiriobmann_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Andreas Schuler', false);

  -- Social_Media_Factsheet.pdf → Social_Media_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Social-Media-Verantwortliche:r', '[{"title": "Redaktionsplan / Jahresplanung für Instagram Posts", "detail": null}, {"title": "Spielvorschau und Resultatposts", "detail": null}, {"title": "Collabs mit anderen SoMe Accounts", "detail": null}, {"title": "Fotograf für Heimspiele organisieren", "detail": null}]'::jsonb, '4h -16h',
          '1-4', 3, 'Raphael Nigg',
          v_club::text || '/' || 'Social_Media_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Florin Geller', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Sina Zimmernan', false);
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Manuel', false);

  -- Spielsekretär_Factsheet.pdf → Spielsekretaer_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Spielsekretär:in', '[{"title": "Es wird eine Gruppe „Spielsekretär:innen“ erstellt; die Einteilung der Spiele organisiert ihr selbstständig.", "detail": null}, {"title": "Verantwortlich dafür, dass alles korrekt aufgebaut ist (z. B. Banden, Kiosk).", "detail": null}, {"title": "Während des Spiels Ansprechperson für alle Helfer sein.", "detail": null}, {"title": "Bei Einzelspielen den Liveticker sowie das Mikrofon bedienen.", "detail": null}]'::jsonb, 'ca. 12 Spiele a 4 Stunden (Jeder 3 Spiele)',
          '4', 4, 'Katja Fäh',
          v_club::text || '/' || 'Spielsekretaer_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;

  -- Webmaster_Factsheet.pdf → Webmaster_Factsheet.pdf
  insert into functionary_roles (club_id, title, duties, hours_per_season, points_label,
                                 max_holders, contact_name, factsheet_path)
  values (v_club, 'Webmaster', '[{"title": "Verantwortung für den Inhalt der Website (Spielberichte hochladen, Seiteninhalte pflegen, etc)", "detail": null}, {"title": "Verantwortung für die Wartung der Website (Sicherheitsupdates, Plugins, Swissunihockey API für Resultate etc.)", "detail": null}, {"title": "Einbringen von neuen Ideen und Technische Umsetzung - falls von Vorstand oder Trainer gewünscht - immer Absprache mit dem Vorstand", "detail": null}, {"title": "Verantwortung für die Mailadresse *webmaster@kadetten-unihckey.ch* - (Mails beantworten / weiterleiten)", "detail": null}]'::jsonb, '12h+',
          '4', 1, 'Elias Haas',
          v_club::text || '/' || 'Webmaster_Factsheet.pdf')
  on conflict (club_id, lower(title)) do update
     set duties = excluded.duties, hours_per_season = excluded.hours_per_season,
         points_label = excluded.points_label, max_holders = excluded.max_holders,
         contact_name = excluded.contact_name, factsheet_path = excluded.factsheet_path
  returning id into v_role;
  delete from functionary_holders where role_id = v_role and member_id is null;
  insert into functionary_holders (role_id, display_name, interim)
  values (v_role, 'Loris Schüppach', false);
end
$import$;
