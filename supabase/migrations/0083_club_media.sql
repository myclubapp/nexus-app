-- ============================================================================
-- 0083_club_media: Bilder des Vereins (UC-045, FR-166 bis FR-168)
--
-- Bis hierher kannte die App genau einen Weg zu einem Bild: eine Adresse, die
-- jemand von Hand einträgt (`clubs.settings.logoUrl`). `club_members.avatar_url`
-- steht seit `0001` in der Tabelle und wird von **nichts** geschrieben – der
-- Kommentar in `MemberAvatar` sagt es seit Monaten: «ein Upload wartet auf den
-- Vereinsspeicher». Der Speicher steht seit `0070`. Das hier ist der Upload.
--
-- Drei Bilder, **zwei** Speicher, drei Pfadformen:
--
--   club-logo   (öffentlich)  <club_id>/logo/<uuid>.<ext>
--                             Vereinslogo → clubs.settings.logoUrl
--   club-photos (privat)      <club_id>/teams/<team_id>/<uuid>.<ext>
--                             Teambild    → teams.photo_url
--   club-photos (privat)      <club_id>/members/<member_id>/<uuid>.<ext>
--                             Profilbild  → club_members.avatar_url
--
-- **Die Trennung ist der Kern dieser Migration** (BR-216, Entscheid des
-- Projektinhabers vom 14.09.2026: «Profilbilder nur innerhalb des Klubs
-- sichtbar»).
--
-- Ein **Logo** ist öffentlich, und zwar notwendigerweise: Es steht auf der
-- Einladungsseite und im White-Label-Anstrich, also **vor** der Anmeldung.
-- Eine signierte Adresse gibt es dort nicht – es ist niemand da, für den
-- signiert werden könnte. Ein Logo ist ohnehin das Zeichen, mit dem ein
-- Verein nach aussen auftritt.
--
-- Ein **Gesicht** ist es nicht. Ein Mannschaftsfoto und erst recht ein
-- Profilbild gehen den Verein an und sonst niemanden – und `club_members`
-- kennt `is_minor`. In einem öffentlichen Bucket liefert Storage die Bytes
-- unter `/object/public/…` ganz **ohne** RLS aus; wer die Adresse hat, sieht
-- das Bild, für immer und ohne Mitgliedschaft. Deshalb liegen beide in einem
-- privaten Bucket, und die App holt für jedes eine signierte, ablaufende
-- Adresse (`useSignedMediaUrl()`). Dieselbe Linie wie beim Pflichtenheft
-- (`factsheets`, 0070) – nur dass dort ein Dokument über eine Person liegt
-- und hier ein Bild von ihr.
--
-- **In `teams.photo_url` und `club_members.avatar_url` steht der Pfad, nicht
-- die Adresse.** Eine signierte Adresse läuft ohnehin ab und taugte nicht als
-- gespeicherter Wert; und so lässt sich serverseitig lückenlos prüfen, wohin
-- ein Wert zeigt (siehe `set_member_avatar()` unten). `settings.logoUrl`
-- bleibt eine Adresse – ein Verein, dessen Logo schon auf seiner Website
-- liegt, trägt dort weiterhin einfach den Link ein, und geprüft wird dabei
-- nur die Vorstandsrolle.
--
-- Was der private Bucket **nicht** leistet: Er verhindert nicht, dass ein
-- Vereinsmitglied den Ordner seines Vereins auflistet und so alle Pfade
-- kennt. Innerhalb des Vereins ist genau das erlaubt; nach aussen kommt ohne
-- gültige Signatur nichts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Das Teambild. Logo und Profilbild haben ihre Spalte schon.
-- ---------------------------------------------------------------------------
-- Der **Pfad** im Bucket, nicht die Adresse (siehe oben). Der Name bleibt
-- `photo_url`, weil `club_members.avatar_url` seit `0001` genauso heisst und
-- zwei Namen für dasselbe verwirrender wären als einer, der zu weit greift.
alter table teams add column if not exists photo_url text
  check (photo_url is null or length(photo_url) between 1 and 500);

-- ---------------------------------------------------------------------------
-- Die beiden Buckets.
--
-- 5 MiB je Datei: Ein auf 1024 Pixel verkleinertes JPEG liegt bei ein paar
-- hundert Kilobyte; die Grenze fängt das ab, was ungerechnet vom Gerät kommt.
-- SVG ist **nicht** erlaubt – eine SVG-Datei kann Skript enthalten.
--
-- `on conflict do update`, damit ein zweiter Lauf eine von Hand geänderte
-- Sichtbarkeit wieder auf den hier festgehaltenen Stand bringt: Ob ein Bucket
-- öffentlich ist, ist die ganze Entscheidung und darf nicht davon abhängen,
-- wer zuletzt im Dashboard war.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-logo', 'club-logo', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-photos', 'club-photos', false, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Zwei Helfer wie `path_club_id()` (0070): Kein Cast, der auf einem fremden
-- Pfad mit einem Fehler statt mit «nein» antwortet.
-- ---------------------------------------------------------------------------
-- `path_club_id()` aus `0070` ist seither der Sonderfall «Segment 1» davon
-- (unten umgestellt): Dieselbe Regex zweimal wäre dieselbe Regel zweimal.
create or replace function public.path_uuid(p_name text, p_segment int)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
           when split_part(p_name, '/', p_segment) ~
                '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
           then split_part(p_name, '/', p_segment)::uuid
         end;
$$;

/**
 * Darf die angemeldete Person an diesen Pfad schreiben?
 *
 * Die Regel steht **einmal**, nicht dreimal in drei Policies: Sie entscheidet
 * für alle drei Pfadformen und antwortet auf alles andere mit «nein».
 *
 *   logo    → der Vorstand mit Verwaltungsrecht (Vereinsidentität, UC-034)
 *   teams   → wer für dieses Team planen darf (C-032, `can_plan_for_team`)
 *   members → die Person selbst, oder der Vorstand
 */
create or replace function public.can_write_club_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  uuid := path_uuid(p_name, 1);
  v_kind  text := split_part(p_name, '/', 2);
  v_third uuid := path_uuid(p_name, 3);
begin
  if v_club is null then
    return false;
  end if;

  if v_kind = 'logo' then
    return is_club_admin(v_club);
  end if;

  if v_kind = 'teams' then
    return v_third is not null
       and exists (select 1 from teams where id = v_third and club_id = v_club)
       and can_plan_for_team(v_club, v_third);
  end if;

  if v_kind = 'members' then
    return v_third is not null
       and exists (select 1 from club_members where id = v_third and club_id = v_club)
       and (v_third = current_member_id(v_club) or is_club_board(v_club));
  end if;

  return false;
end;
$$;

revoke execute on function public.path_uuid(text, int) from public, anon;
grant  execute on function public.path_uuid(text, int) to authenticated;
revoke execute on function public.can_write_club_media(text) from public, anon;
grant  execute on function public.can_write_club_media(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Die Policies.
--
-- **Jede Bucket-Policy pinnt zusätzlich die Art des Bildes.** Sonst liesse
-- sich ein Profilbild in den öffentlichen Logo-Bucket legen und wäre wieder
-- für jeden sichtbar – die Trennung stünde im Kopfkommentar und nirgends
-- sonst.
--
-- Schreiben, Ersetzen und Löschen prüfen dieselbe Funktion: Eine Policy, die
-- nur das Einfügen abgrenzt, grenzt beim Überschreiben nichts ab.
--
-- Beim **privaten** Bucket ist `select` die Tür: Ohne sie gibt es weder
-- einen Download noch eine signierte Adresse. `is_club_member()` ist damit
-- die Antwort auf «nur innerhalb des Vereins sichtbar».
-- ---------------------------------------------------------------------------

-- Das Logo: öffentlich lesbar (die Bytes liefert Storage ohne RLS), Auflisten
-- und Schreiben beim Vorstand.
drop policy if exists club_logo_read on storage.objects;
create policy club_logo_read on storage.objects
  for select to authenticated
  using (bucket_id = 'club-logo' and is_club_member(path_uuid(name, 1)));

drop policy if exists club_logo_insert on storage.objects;
create policy club_logo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) = 'logo'
    and can_write_club_media(name)
  );

drop policy if exists club_logo_update on storage.objects;
create policy club_logo_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) = 'logo'
    and can_write_club_media(name)
  )
  with check (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) = 'logo'
    and can_write_club_media(name)
  );

drop policy if exists club_logo_delete on storage.objects;
create policy club_logo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) = 'logo'
    and can_write_club_media(name)
  );

-- Team- und Profilbilder: **privat**. Lesen – und damit auch das Signieren
-- einer ablaufenden Adresse – nur für Mitglieder desselben Vereins.
drop policy if exists club_photos_read on storage.objects;
create policy club_photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'club-photos' and is_club_member(path_uuid(name, 1)));

drop policy if exists club_photos_insert on storage.objects;
create policy club_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-photos'
    and split_part(name, '/', 2) in ('teams', 'members')
    and can_write_club_media(name)
  );

drop policy if exists club_photos_update on storage.objects;
create policy club_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-photos'
    and split_part(name, '/', 2) in ('teams', 'members')
    and can_write_club_media(name)
  )
  with check (
    bucket_id = 'club-photos'
    and split_part(name, '/', 2) in ('teams', 'members')
    and can_write_club_media(name)
  );

drop policy if exists club_photos_delete on storage.objects;
create policy club_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-photos'
    and split_part(name, '/', 2) in ('teams', 'members')
    and can_write_club_media(name)
  );

-- Der Bucket `club-media` aus einer früheren Fassung dieser Migration hat nie
-- ein Deployment gesehen; seine Policies werden hier nur zur Sicherheit
-- abgeräumt, falls jemand sie lokal angelegt hat.
drop policy if exists club_media_read on storage.objects;
drop policy if exists club_media_insert on storage.objects;
drop policy if exists club_media_update on storage.objects;
drop policy if exists club_media_delete on storage.objects;

-- ---------------------------------------------------------------------------
-- Das Profilbild an die eigene Zeile schreiben.
--
-- `club_members` gibt Clients kein `update` auf beliebige Spalten (0006); der
-- Anzeigename läuft über `update_my_profile()`, die Rolle über den Vorstand.
-- Das Bild bekommt denselben engen Weg: eine Funktion, die genau eine Spalte
-- setzt, und zwar nur an der eigenen Zeile oder – für den Vorstand – an einer
-- Zeile seines Vereins.
--
-- Geprüft wird die **Herkunft**: Nur ein Pfad im eigenen Bucket-Ordner kommt
-- hinein. Sonst wäre die Spalte eine offene Stelle für eine beliebige fremde
-- Adresse, die jedes Mitglied in jeder Liste zu sehen bekäme.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_avatar(p_member_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
  v_url    text := nullif(trim(coalesce(p_url, '')), '');
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    raise exception 'Mitglied nicht gefunden';
  end if;

  if not (v_member.user_id = auth.uid() or is_club_board(v_member.club_id)) then
    raise exception 'Nur die Person selbst oder der Vorstand ändert das Profilbild';
  end if;

  -- **Ein Pfad, keine Adresse** – und deshalb eine Prüfung, die zumacht.
  -- Zwischenstufen dieser Migration prüften eine ganze URL: erst mit
  -- `position(… in …)` (fand den Teilstring irgendwo), dann verankert mit
  -- `^https://[^/]+/…`. Auch das verankerte Muster liess einen Angriff durch,
  -- gegen die laufende Datenbank belegt: `https://boese.example/storage/v1/
  -- object/public/club-media/<club>/members/<member>/x.png` passt auf
  -- `[^/]+` als Host. Und den eigenen Host kennt Postgres nicht.
  --
  -- Also steht in der Spalte der **Pfad im Bucket**, und die öffentliche
  -- Adresse baut der Client daraus (`getPublicUrl`). Damit ist die Prüfung
  -- vollständig: Verein, Art und Mitglied stehen fest, ein Schrägstrich mehr
  -- ist nicht erlaubt, und einen fremden Ort gibt es nicht mehr zu erlauben.
  if v_url is not null and v_url !~ (
       '^' || v_member.club_id::text || '/members/' || p_member_id::text
       || '/[^/]+$') then
    raise exception 'Dieser Pfad gehört nicht zum Vereinsspeicher';
  end if;

  update club_members set avatar_url = v_url where id = p_member_id;
end;
$$;

revoke execute on function public.set_member_avatar(uuid, text) from public, anon;
grant  execute on function public.set_member_avatar(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Das Teambild an das Team schreiben – dieselbe Herkunftsprüfung, dieselbe
-- Reichweite wie beim Planen (C-032). `teams` hat für den Client kein
-- allgemeines `update`; `update_team()` gehört dem Vorstand.
-- ---------------------------------------------------------------------------
create or replace function public.set_team_photo(p_team_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team teams;
  v_url  text := nullif(trim(coalesce(p_url, '')), '');
begin
  select * into v_team from teams where id = p_team_id;
  if not found then
    raise exception 'Team nicht gefunden';
  end if;

  if not can_plan_for_team(v_team.club_id, p_team_id) then
    raise exception 'Nur wer für dieses Team plant, ändert sein Bild';
  end if;

  -- Ein Pfad wie bei `set_member_avatar()` – aus demselben Grund.
  if v_url is not null and v_url !~ (
       '^' || v_team.club_id::text || '/teams/' || p_team_id::text
       || '/[^/]+$') then
    raise exception 'Dieser Pfad gehört nicht zum Vereinsspeicher';
  end if;

  update teams set photo_url = v_url where id = p_team_id;
end;
$$;

revoke execute on function public.set_team_photo(uuid, text) from public, anon;
grant  execute on function public.set_team_photo(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- `path_club_id()` (0070) ist jetzt der Sonderfall «erstes Segment» – damit
-- die UUID-Regel im Repository genau einmal steht. Signatur und Verhalten
-- bleiben, die Policies aus `0070` merken nichts davon.
-- ---------------------------------------------------------------------------
create or replace function public.path_club_id(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
  select path_uuid(p_name, 1);
$$;
