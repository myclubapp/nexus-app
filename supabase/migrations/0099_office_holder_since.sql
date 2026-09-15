-- ---------------------------------------------------------------------------
-- 0099: «seit» am Sitz kommt wieder durch `save_office()` (UC-041 A8, BR-185)
--
-- `0070` hat `functionary_holders.since` beim Anlegen geschrieben und beim
-- Ändern mit `coalesce(…, since)` festgehalten. `0095` hat die Funktion für
-- `is_board` neu aufgebaut und die Spalte dabei verloren: Seither entsteht
-- jeder neue Sitz ohne Datum.
--
-- Das fällt erst jetzt auf, weil das Formular nie ein Datum geschickt hat.
-- Die eingelesene Ämterbeschreibung schickt eines – «- Anna Beispiel (seit
-- 2024-06-01)» –, und ohne diese Migration ginge es still verloren: Das
-- Blatt zeigte die Besetzung bei jedem Einlesen erneut als Änderung.
--
-- Es hängt mehr daran als die Anzeige: `sync_office_holder()` (BR-185)
-- ordnet die Inhaber:innen nach `since`, um den Verteiler zu bestimmen.
--
-- Nur der Rumpf der Funktion ändert sich; Signatur und Rechte bleiben, wie
-- `0095` sie gesetzt hat (`create or replace` behält die Rechte, die
-- Wiederholung unten ist die Vorlage aus `0007_function_grants.sql`).
-- ---------------------------------------------------------------------------

create or replace function public.save_office(
  p_club_id           uuid,
  p_title             text,
  p_id                uuid    default null,
  p_why               text    default null,
  p_duties            jsonb   default '[]'::jsonb,
  p_hours_per_season  text    default null,
  p_points_label      text    default null,
  p_max_holders       int     default 1,
  p_contact_member_id uuid    default null,
  p_contact_name      text    default null,
  p_holders           jsonb   default '[]'::jsonb,
  p_is_board          boolean default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_holder jsonb;
  v_keep   uuid[] := '{}';
  v_hid    uuid;
  v_member uuid;
  v_name   text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand pflegt die Ämter';
  end if;

  if length(trim(coalesce(p_title, ''))) not between 2 and 80 then
    raise exception 'Ein Amt braucht seine Bezeichnung';
  end if;
  if jsonb_typeof(coalesce(p_duties, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_holders, '[]'::jsonb)) <> 'array' then
    raise exception 'Pflichten und Belegung sind Listen';
  end if;
  if coalesce(p_max_holders, 1) not between 1 and 50 then
    raise exception 'Ein Amt hat zwischen 1 und 50 Sitzen';
  end if;
  if p_contact_member_id is not null and not exists (
       select 1 from club_members m
        where m.id = p_contact_member_id and m.club_id = p_club_id) then
    raise exception 'Die Ansprechperson ist nicht Mitglied dieses Vereins';
  end if;

  if p_id is null then
    insert into functionary_roles (
      club_id, title, why, duties, hours_per_season, points_label,
      max_holders, contact_member_id, contact_name, is_board
    )
    values (
      p_club_id, trim(p_title), nullif(trim(p_why), ''), coalesce(p_duties, '[]'::jsonb),
      nullif(trim(p_hours_per_season), ''), nullif(trim(p_points_label), ''),
      coalesce(p_max_holders, 1), p_contact_member_id, nullif(trim(p_contact_name), ''),
      coalesce(p_is_board, false)
    )
    returning id into v_id;
  else
    update functionary_roles
       set title             = trim(p_title),
           why               = nullif(trim(p_why), ''),
           duties            = coalesce(p_duties, '[]'::jsonb),
           hours_per_season  = nullif(trim(p_hours_per_season), ''),
           points_label      = nullif(trim(p_points_label), ''),
           max_holders       = coalesce(p_max_holders, 1),
           contact_member_id = p_contact_member_id,
           contact_name      = nullif(trim(p_contact_name), ''),
           is_board          = coalesce(p_is_board, is_board)
     where id = p_id and club_id = p_club_id
     returning id into v_id;
    if v_id is null then
      raise exception 'Dieses Amt gibt es nicht';
    end if;
  end if;

  for v_holder in select * from jsonb_array_elements(coalesce(p_holders, '[]'::jsonb)) loop
    v_name   := trim(coalesce(v_holder->>'display_name', ''));
    v_member := nullif(v_holder->>'member_id', '')::uuid;
    if v_member is not null then
      if not exists (select 1 from club_members m
                      where m.id = v_member and m.club_id = p_club_id) then
        raise exception 'Diese Person ist nicht Mitglied dieses Vereins';
      end if;
      -- Der Name folgt dem Mitglied und nicht der Eingabe: Wer verknüpft ist,
      -- heisst im Organigramm so wie im Verzeichnis.
      select display_name into v_name from club_members where id = v_member;
    end if;
    if v_name = '' then
      raise exception 'Ein Sitz braucht seinen Namen';
    end if;

    v_hid := nullif(v_holder->>'id', '')::uuid;
    if v_hid is null then
      insert into functionary_holders (role_id, member_id, display_name, interim, since)
      values (v_id, v_member, v_name, coalesce((v_holder->>'interim')::boolean, false),
              nullif(v_holder->>'since', '')::date)
      returning id into v_hid;
    else
      update functionary_holders
         set member_id    = v_member,
             display_name = v_name,
             interim      = coalesce((v_holder->>'interim')::boolean, false),
             -- Kein Wert heisst «unverändert», nicht «kein Datum»: Das
             -- Formular schickt das gespeicherte Datum mit, die eingelesene
             -- Datei ihres.
             since        = coalesce(nullif(v_holder->>'since', '')::date, since)
       where id = v_hid and role_id = v_id;
    end if;
    v_keep := v_keep || v_hid;
  end loop;

  -- Was nicht mehr in der Liste steht, ist aufgelöst.
  delete from functionary_holders
   where role_id = v_id and not (id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb, boolean
) from public, anon;
grant execute on function public.save_office(
  uuid, text, uuid, text, jsonb, text, text, int, uuid, text, jsonb, boolean
) to authenticated;
