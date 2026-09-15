-- ============================================================================
-- Ämter und Verantwortlichkeiten aus dem Organigramm
-- Quelle: docs/Kadetten_Unihockey_Organigramm.drawio.svg (Stand 2026-09-15)
-- Verein: Kadetten Unihockey Schaffhausen (su-452800)
--
-- Von Hand geschrieben – anders als `import_kadetten.sql`, das
-- `build_factsheets.py` aus den Factsheet-Dokumenten erzeugt. Beide Skripte
-- ergänzen sich: die Factsheets liefern die **Funktionärsämter** mit Aufwand,
-- Punktelabel und PDF, das Organigramm liefert die **sieben Ressorts des
-- Vorstands** und ordnet jedem seine Verantwortlichkeiten zu.
--
-- Reihenfolge: erst `import_kadetten.sql`, dann dieses Skript. Es fasst je
-- Amt nur die Pflichten an, die es selbst nennt (`pg_temp.add_duties` und
-- `drop_duties`): Was aus einem Factsheet stammt, bleibt stehen, und ein
-- erneuter Lauf trägt nichts doppelt ein. Damit überlebt der Bestand sowohl
-- einen zweiten Lauf dieses Skripts als auch einen neuen Lauf von
-- `build_factsheets.py`.
--
-- Eine bewusste Abweichung vom Diagramm steht in Abschnitt D: Website, App
-- und Vereins-IT führt das Organigramm unter Marketing/Sponsoring, hier
-- gehören sie zum CDO.
--
-- Was das Organigramm **nicht** hergibt, bleibt leer: `hours_per_season` und
-- `points_label` der vier neuen Ressorts. Eine erfundene Zahl wäre schlechter
-- als eine fehlende (vgl. `0091`, Begründung zu `season_points`) – der
-- Vorstand trägt sie in der Ämter-Verwaltung nach.
--
-- Einspielen:
--   supabase db query --linked -f docs/marktplatz/97_Funktionäre/import_organigramm.sql --experimental
-- ============================================================================

-- Pflichten setzen: anfügen, was unter diesem Titel noch nicht steht, und die
-- Liste anschliessend in die übergebene Reihenfolge bringen. Pflichten, die
-- hier nicht genannt sind (etwa der Werbetext aus einem Factsheet), behalten
-- ihre bisherige Reihenfolge und stehen **vorn**.
--
-- Das `order by` ist nicht Kosmetik: `jsonb_agg` ohne eines liefert eine
-- beliebige Reihenfolge, und die Pflichtenliste ist das, was der Vorstand im
-- Amt liest – «Vorstandssitzungen einberufen und leiten» gehört nicht an
-- sechste Stelle.
--
-- Als `pg_temp`-Funktion und nicht als Datenbankfunktion: Sie lebt nur für
-- diese Sitzung, hängt nie unter `/rest/v1/rpc/` und braucht darum auch kein
-- `revoke` (CLAUDE.md, `0007`).
create or replace function pg_temp.add_duties(p_role uuid, p_titles text[])
returns void
language sql
as $fn$
  with wanted as (
    select lower(u.t) as key, u.ord from unnest(p_titles) with ordinality as u(t, ord)
  ),
  merged as (
    select d.val, d.ord as pos, w.ord as rang
      from functionary_roles r
      cross join lateral jsonb_array_elements(r.duties) with ordinality as d(val, ord)
      left join wanted w on w.key = lower(d.val->>'title')
     where r.id = p_role
    union all
    select jsonb_build_object('title', u.t, 'detail', null), null::bigint, u.ord
      from unnest(p_titles) with ordinality as u(t, ord)
     where not exists (
       select 1
         from functionary_roles r
         cross join lateral jsonb_array_elements(r.duties) d
        where r.id = p_role and lower(d->>'title') = lower(u.t))
  )
  update functionary_roles r
     set duties = coalesce(
           (select jsonb_agg(m.val order by m.rang nulls first, m.pos) from merged m),
           '[]'::jsonb)
   where r.id = p_role;
$fn$;

-- Das Gegenstück: Pflichten entfernen, die an diesem Amt nichts mehr zu
-- suchen haben. Nötig, weil `add_duties` nur anfügt – ohne ein Entfernen
-- bliebe eine einmal verschobene Pflicht an beiden Ämtern stehen, und das
-- Skript liefe auf zwei verschiedene Ergebnisse, je nachdem, wann man es
-- zuletzt gestartet hat.
create or replace function pg_temp.drop_duties(p_role uuid, p_titles text[])
returns void
language sql
as $fn$
  update functionary_roles r
     set duties = coalesce((
           select jsonb_agg(d.val order by d.ord)
             from jsonb_array_elements(r.duties) with ordinality as d(val, ord)
            where lower(d.val->>'title') <> all (select lower(t) from unnest(p_titles) t)
         ), '[]'::jsonb)
   where r.id = p_role;
$fn$;

do $organigramm$
declare
  v_club uuid := 'bf4ebf3f-41c8-4e10-b8d5-a2daed8ae5cb';
  v_role uuid;

  -- Die Ressortleitungen. Das Organigramm nennt sie mit Vornamen; die
  -- Zuordnung zum Mitglied ist über die Ansprechpersonen der Factsheets
  -- belegt: Katja Fäh zeichnet für Apotheke, Halle BBC und Spielsekretär
  -- (die drei Funktionäre der TK), Elias Haas für Events, Streetfloorball
  -- und Webmaster (Vereinsleben), Matthias Regli für Juniorentrainer und
  -- GOSU (Junioren), Sandro Ehrbar für Schiedsrichter und Trainer (Sport).
  v_katja   uuid := 'd6ae333a-881a-4a4c-b818-d05dd41ad0a6';  -- Katja Fäh
  v_elias   uuid := 'ae086692-5613-4282-ac2a-927935a97c6a';  -- Elias Haas
  v_matthias uuid := 'c47eedaf-0289-4406-8c77-2f89c912d3cb'; -- Matthias Regli
  v_ehrbar  uuid := 'd85cf6c5-69f8-48a9-934c-91c99d66d5ee';  -- Sandro Ehrbar
  v_scalco  uuid := 'faaf062c-6d91-4a71-a90c-537e2279aa37';  -- Sandro Scalco
begin
  -- ==========================================================================
  -- A. Die vier fehlenden Vorstandsressorts.
  --
  -- Das Organigramm führt sieben Ressorts. Drei davon standen schon als Amt
  -- da: Präsident/in, Kassier:in, Eventorganisator:in. Die übrigen vier
  -- fehlten – damit fehlte auch ihr Verteiler für die Vorstandssitzung
  -- (`is_board`, Migration 0095).
  -- ==========================================================================

  -- --- Technische Kommission – Katja ---------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Chef:in Technische Kommission',
          'Ohne die Technische Kommission steht der Spielbetrieb still: keine Halle, '
          || 'kein Material, keine Helfer:innen am Heimturnier.',
          '[]'::jsonb, 1, true, v_katja, 'Katja Fäh')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_member_id = excluded.contact_member_id,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Hallenkasten führen',
    'Helferwesen organisieren und kontrollieren',
    'Heimturnier organisieren',
    'Einkauf und Kiosk',
    'Material verwalten (Materialwart)',
    'Protokoll der Technischen Kommission führen',
    'Überzieher verwalten',
    'Matchtrikots und Lager verwalten',
    'Turniervergabe abstimmen',
    'Cup-Anmeldung'
  ]);
  if not exists (select 1 from functionary_holders where role_id = v_role) then
    insert into functionary_holders (role_id, member_id, display_name)
    values (v_role, v_katja, 'Katja Fäh');
  end if;

  -- --- Sportchef:in – im Organigramm vakant --------------------------------
  -- Kein Inhaber: Das Organigramm weist das Ressort ausdrücklich als «Vakant»
  -- aus. Die Ansprechperson führt trotzdem jemand, damit sich Interessierte
  -- melden können – Sandro Ehrbar zeichnet für alle Factsheets dieses
  -- Ressorts (Schiedsrichter, Schiedsrichterobmann, Trainer H1/H2, Damen).
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Sportchef:in',
          'Ohne Sportchef:in entscheidet niemand über Transfers, Lizenzen und die '
          || 'sportliche Ausrichtung – und die Teams melden sich selbst zur Meisterschaft an.',
          '[]'::jsonb, 1, true, v_ehrbar, 'Sandro Ehrbar')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_member_id = excluded.contact_member_id,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Transfers',
    'Sportliche Strategie',
    'Probetrainings',
    'Lizenzkontrolle',
    'Trainings',
    'swissunihockey-App',
    'Team an- und abmelden: Schweizer Cup',
    'Team an- und abmelden: Meisterschaftsbetrieb'
  ]);

  -- --- Marketing und Sponsoring – Sandro ------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Chef:in Marketing und Sponsoring',
          'Ohne dieses Ressort bezahlt der Jahresbeitrag allein den ganzen Verein: '
          || 'keine Banden, keine Trikots, keine Partner.',
          '[]'::jsonb, 1, true, v_scalco, 'Sandro Scalco')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_member_id = excluded.contact_member_id,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Matchtrikots beschaffen',
    'Banden-Sponsoring',
    'Banner-Sponsoring',
    'Ausrüstung',
    'Mitglieder-Benefits',
    'WebShop',
    'Best-Player-Sponsoring',
    'Sponsoren-Apéro'
  ]);
  -- Website, App und Vereins-IT stehen im Organigramm unter Marketing,
  -- gehören hier aber zum CDO (Entscheid Sandro, 2026-09-15, Abschnitt D).
  -- Das ist eine bewusste Abweichung vom Diagramm – nicht zurückkorrigieren,
  -- ohne Abschnitt D mitzunehmen.
  perform pg_temp.drop_duties(v_role, array[
    'Website',
    'App-Administration',
    'Vereins-IT'
  ]);
  if not exists (select 1 from functionary_holders where role_id = v_role) then
    insert into functionary_holders (role_id, member_id, display_name)
    values (v_role, v_scalco, 'Sandro Scalco');
  end if;

  -- --- Junioren – Mät -------------------------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Juniorenobmann/-frau',
          'Ohne Juniorenobmann/-frau hat der Nachwuchs keine Stimme im Vorstand – '
          || 'und niemand hält die Sektionen, den FerienPass und die Trainer:innen zusammen.',
          '[]'::jsonb, 1, true, v_matthias, 'Matthias Regli')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_member_id = excluded.contact_member_id,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Sektion Chläggi',
    'Sektion Stadt Schaffhausen',
    'BESJ',
    'Probetrainings',
    'Trainer:innen betreuen',
    'TV-Meisterschaft'
  ]);
  if not exists (select 1 from functionary_holders where role_id = v_role) then
    insert into functionary_holders (role_id, member_id, display_name)
    values (v_role, v_matthias, 'Matthias Regli');
  end if;

  -- ==========================================================================
  -- B. Die drei fehlenden Funktionärsämter.
  --
  -- Das Organigramm führt je Ressort eine Reihe «Funktionäre». Bis auf drei
  -- standen alle schon als Amt da. Ohne Inhaber:in – wer sie hält, sagt das
  -- Organigramm nicht; sie erscheinen damit als offene Sitze im Marktplatz
  -- (BR-183).
  -- ==========================================================================

  -- --- Kadettenkommission (Präsidium) ---------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Vertretung Kadettenkommission',
          'Ohne Vertretung in der Kadettenkommission entscheidet der Dachverein über '
          || 'Halle, Termine und Beiträge, ohne dass Unihockey am Tisch sitzt.',
          '[]'::jsonb, 1, false, null, 'Jonathan Kissling')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Den Verein in der Kadettenkommission vertreten',
    'Beschlüsse in den Vorstand zurücktragen'
  ]);

  -- --- Stiftungsrat (Präsidium) ---------------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'Vertretung Stiftungsrat',
          'Ohne Sitz im Stiftungsrat verliert der Verein den Zugang zu den Mitteln, '
          || 'aus denen Nachwuchs und Infrastruktur finanziert werden.',
          '[]'::jsonb, 1, false, null, 'Jonathan Kissling')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'Den Verein im Stiftungsrat vertreten',
    'Beschlüsse in den Vorstand zurücktragen'
  ]);

  -- --- J+S-Coach (Junioren) --------------------------------------------------
  insert into functionary_roles (club_id, title, why, duties, max_holders,
                                 is_board, contact_member_id, contact_name)
  values (v_club, 'J+S-Coach',
          'Ohne J+S-Coach gibt es keine Jugend+Sport-Beiträge: Der Verein bezahlt '
          || 'jedes Lager und jeden Kurs aus der eigenen Kasse.',
          '[]'::jsonb, 1, false, v_matthias, 'Matthias Regli')
  on conflict (club_id, lower(title)) do update
     set why = excluded.why, is_board = excluded.is_board,
         contact_member_id = excluded.contact_member_id,
         contact_name = excluded.contact_name
  returning id into v_role;
  perform pg_temp.add_duties(v_role, array[
    'J+S-Angebote anmelden und abrechnen',
    'Aus- und Weiterbildung der Leiter:innen im Auge behalten',
    'Anwesenheitskontrollen führen'
  ]);

  -- ==========================================================================
  -- C. Verantwortlichkeiten an den drei bestehenden Vorstandsämtern.
  --
  -- Das Präsidium stand ganz ohne Pflichten da; Vereinsleben trug nur den
  -- Werbetext aus dem Factsheet. Das Ressort Finanzen ist bereits vollständig
  -- (acht Pflichten aus dem Kassier-Factsheet, deckungsgleich mit der Spalte
  -- «Finanzen» des Organigramms) und wird darum nicht angefasst.
  -- ==========================================================================

  select id into v_role from functionary_roles
   where club_id = v_club and lower(title) = lower('Präsident/in');
  if v_role is not null then
    perform pg_temp.add_duties(v_role, array[
      'Vorstandssitzungen einberufen und leiten',
      'Strategie des Vereins führen',
      'Neue Mitglieder aufnehmen',
      'Kommunikation des Vereins verantworten',
      'Generalversammlung vorbereiten und durchführen',
      'Rekurse behandeln',
      'Kontakt zu Behörden und Sportamt halten',
      'Protokollführung sicherstellen'
    ]);
  end if;

  select id into v_role from functionary_roles
   where club_id = v_club and lower(title) = lower('Eventorganisator:in');
  if v_role is not null then
    perform pg_temp.add_duties(v_role, array[
      'Season Opening',
      'Grümpelturnier',
      'Dreikönigsturnier',
      'Street Floorball',
      'Events für Junioren',
      'Schulturnier',
      'Badge-System (Vereins-Gamification)'
    ]);
    if not exists (select 1 from functionary_holders where role_id = v_role) then
      insert into functionary_holders (role_id, member_id, display_name)
      values (v_role, v_elias, 'Elias Haas');
    end if;
  end if;

  -- ==========================================================================
  -- D. Die Abgrenzung zwischen CDO und Marketing.
  --
  -- «CDO» steht in keiner Spalte des Organigramms; das Amt gab es in nexus
  -- schon vorher. Sein Inhalt überschnitt sich mit Marketing/Sponsoring, weil
  -- das Diagramm Website, App und Vereins-IT dort führt. Entscheid Sandro,
  -- 2026-09-15: **Das Digitale gehört zum CDO**, Marketing bleibt bei Geld,
  -- Partnern und Ausrüstung. Beide Ämter führt heute dieselbe Person – die
  -- Trennung ist darum keine Zuständigkeitsfrage, sondern hält die zwei
  -- Aufgabenpakete auseinander, wenn sie einmal zwei Personen tragen.
  --
  -- Der WebShop bleibt bewusst bei Marketing: Sortiment, Preise und Werbung
  -- entscheidet dort jemand, die Technik dahinter deckt ohnehin «Vereins-IT».
  -- ==========================================================================
  select id into v_role from functionary_roles
   where club_id = v_club and lower(title) = lower('CDO');
  if v_role is not null then
    perform pg_temp.add_duties(v_role, array[
      'Website',
      'App-Administration',
      'Vereins-IT'
    ]);
    -- Nur setzen, solange nichts dasteht: Ein von Hand geschriebenes «Warum»
    -- wiegt schwerer als dieser Vorschlag.
    update functionary_roles
       set why = coalesce(why,
             'Ohne CDO betreibt niemand Website, App und Vereins-IT – und der '
             || 'Verein merkt den Ausfall erst, wenn niemand mehr an die Daten kommt.')
     where id = v_role;
  end if;
end;
$organigramm$;
