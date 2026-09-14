-- ============================================================================
-- 0081_member_profile_fields: Strukturierte Stammdaten (UC-043, FR-163)
--
-- Was nexus über ein Mitglied weiss, war bis hierher schmaler als das, was die
-- bestehende myclub-App wusste: Der Name ist **ein** String (`display_name`),
-- die Adresse **ein** Fliesstext (`member_contacts.address`, 0063), ein
-- Geburtsdatum gibt es nicht. Für die Anzeige reicht das. Für einen Export,
-- der extern weiterverwendet wird (FR-130), reicht es nicht: Eine Liste, die
-- sich nicht nach Nachnamen sortieren und nicht an eine Adresse schicken
-- lässt, ist keine Mitgliederliste.
--
-- **BR-207: Die Adresse steht in Feldern, nicht in einem Fliesstext.**
-- Strasse, Hausnummer, Postleitzahl, Ort, Land. Die Postleitzahl als `text` –
-- die alte App führte `postalcode` als Zahl, und daran sterben führende
-- Nullen (D-01067 Dresden) und alles, was nicht rein numerisch ist.
--
-- **BR-208: Ein Anzeigename bleibt.** `display_name` bleibt `not null` und
-- die einzige Quelle jeder Anzeige – `initials()`, `firstName()`, jede Zeile,
-- jede Rangliste. Vor- und Nachname sind die Struktur darunter, nicht ihr
-- Ersatz. Wer nur einen Anzeigenamen hat, behält ihn.
--
-- Ausdrücklich **nicht** hier: AHV-Nummer, Geschlecht, Nationalität,
-- Lizenznummer. Sie stehen im Profil der alten App und dienen allein dem
-- J+S-Export (FR-131, `Deferred`). Personendaten ohne Verwendung zu erheben,
-- widerspricht Vision §11.4a. Wer FR-131 zieht, zieht sie mit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Der Name, getrennt.
--
-- Nullable, beide: Der Bestand hat sie nicht, der Altbestand-Import (0071)
-- kennt sie zwar getrennt, hat sie aber bisher nur zusammengefügt abgelegt.
-- ---------------------------------------------------------------------------
alter table club_members add column if not exists first_name text
  check (first_name is null or length(trim(first_name)) between 1 and 80);
alter table club_members add column if not exists last_name text
  check (last_name is null or length(trim(last_name)) between 1 and 80);

-- ---------------------------------------------------------------------------
-- Adresse und Geburtsdatum – an dieselbe Stelle wie E-Mail und Telefon, hinter
-- dieselbe Policy (0013): Die Person selbst und der Vorstand lesen die Zeile.
-- ---------------------------------------------------------------------------
alter table member_contacts add column if not exists birth_date date
  check (birth_date is null
         or (birth_date > date '1900-01-01' and birth_date <= current_date));
-- 200 wie der bisherige Freitext (0063): Was sich nicht zerlegen liess, landet
-- vollständig hier. Eine kürzere Grenze schnitte beim Umbau Text ab.
alter table member_contacts add column if not exists street text
  check (street is null or length(trim(street)) between 1 and 200);
alter table member_contacts add column if not exists house_number text
  check (house_number is null or length(trim(house_number)) between 1 and 20);
alter table member_contacts add column if not exists postal_code text
  check (postal_code is null or length(trim(postal_code)) between 1 and 12);
alter table member_contacts add column if not exists city text
  check (city is null or length(trim(city)) between 1 and 80);
-- Zwei Buchstaben nach ISO 3166-1, gross. Kein Default: Ein Land, das niemand
-- eingetragen hat, ist unbekannt und nicht «CH» – der Export soll nicht raten.
alter table member_contacts add column if not exists country text
  check (country is null or country ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------------
-- Den Bestand übernehmen.
--
-- `address` war Fliesstext, meist in der Schweizer Form «Strasse 12, 8000 Ort»
-- oder über zwei Zeilen. Was sich zerlegen lässt, wird zerlegt; was nicht,
-- landet vollständig in `street`. So geht kein Zeichen verloren, und die
-- Spalte kann danach fallen – zwei Orte für dieselbe Adresse wären genau die
-- Sorte Doppelung, die auseinanderläuft.
--
-- Nur dort, wo noch nichts Strukturiertes steht: Die Migration darf einen
-- gepflegten Datensatz nicht überschreiben, falls sie zweimal läuft.
-- ---------------------------------------------------------------------------
do $migrate$
declare
  v_row     record;
  v_rest    text;
  v_last    text;
  v_plz     text;
  v_city    text;
  v_street  text;
  v_house   text;
  v_parts   text[];
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'member_contacts'
       and column_name = 'address'
  ) then
    return;
  end if;

  for v_row in
    execute 'select member_id, address from member_contacts
              where address is not null and trim(address) <> ''''
                and street is null and postal_code is null and city is null'
  loop
    -- Zeilenumbrüche und Kommata trennen gleichwertig.
    v_parts := array_remove(
                 array(select trim(x) from unnest(regexp_split_to_array(v_row.address, '[,\n\r]+')) as x),
                 '');
    v_plz := null; v_city := null; v_street := null; v_house := null;

    if array_length(v_parts, 1) >= 2 then
      v_last := v_parts[array_length(v_parts, 1)];
      v_rest := array_to_string(v_parts[1:array_length(v_parts, 1) - 1], ' ');
    else
      v_last := null;
      v_rest := coalesce(v_parts[1], trim(v_row.address));
    end if;

    -- «8000 Zürich», «CH-8000 Zürich», «01067 Dresden»
    if v_last is not null and v_last ~ '^(?:[A-Z]{1,3}-)?[0-9]{4,6}\s+\S' then
      v_plz  := (regexp_match(v_last, '^(?:[A-Z]{1,3}-)?([0-9]{4,6})\s+(.+)$'))[1];
      v_city := trim((regexp_match(v_last, '^(?:[A-Z]{1,3}-)?([0-9]{4,6})\s+(.+)$'))[2]);
    else
      -- Kein erkennbarer Ort: alles bleibt zusammen in der Strasse.
      v_rest := trim(coalesce(v_rest, '') || ' ' || coalesce(v_last, ''));
    end if;

    -- «Musterstrasse 12», «Musterstrasse 12a», «Musterstrasse 12/3»
    if v_rest ~ '\s[0-9]+\s*[A-Za-z]?(?:[/-][0-9A-Za-z]+)?$' then
      v_street := trim((regexp_match(v_rest, '^(.*?)\s+([0-9]+\s*[A-Za-z]?(?:[/-][0-9A-Za-z]+)?)$'))[1]);
      v_house  := trim((regexp_match(v_rest, '^(.*?)\s+([0-9]+\s*[A-Za-z]?(?:[/-][0-9A-Za-z]+)?)$'))[2]);
    else
      v_street := nullif(trim(v_rest), '');
    end if;

    update member_contacts
       set street      = left(coalesce(v_street, ''), 200),
           house_number = nullif(left(coalesce(v_house, ''), 20), ''),
           postal_code = nullif(left(coalesce(v_plz, ''), 12), ''),
           city        = nullif(left(coalesce(v_city, ''), 80), '')
     where member_id = v_row.member_id
       and coalesce(v_street, '') <> '';
  end loop;
end;
$migrate$;

-- Nachweis vor dem Fallenlassen: Bleibt eine Zeile mit gefülltem `address`
-- ohne Strasse zurück, bricht die Migration ab, statt den Text still zu
-- verlieren. Eine Prüfung, die nur zählt statt Ausnahmen abzufangen.
do $verify$
declare
  v_lost int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'member_contacts'
       and column_name = 'address'
  ) then
    return;
  end if;

  execute 'select count(*) from member_contacts
            where address is not null and trim(address) <> '''' and street is null'
     into v_lost;

  if v_lost > 0 then
    raise exception
      'Umbau der Adresse: % Zeile(n) liessen sich nicht übernehmen – Spalte bleibt stehen', v_lost;
  end if;
end;
$verify$;

alter table member_contacts drop column if exists address;

-- ---------------------------------------------------------------------------
-- Profil speichern – die Signatur aus 0063, ohne `p_address`, mit den acht
-- neuen Feldern.
--
-- Für alle gilt weiter die Regel aus 0063: `null` heisst «unverändert», ein
-- leerer Text heisst «löschen». Wer seine Adresse austrägt, soll sie
-- austragen können.
--
-- BR-208: `display_name` folgt Vor- und Nachname nur dann, wenn die
-- Aufrufende keinen eigenen Anzeigenamen mitgibt. Das Formular schickt immer
-- einen – die Ableitung ist der Weg für alles, was ohne Formular schreibt.
-- ---------------------------------------------------------------------------
drop function if exists public.update_my_profile(uuid, text, text, text, boolean, boolean);
drop function if exists public.update_my_profile(uuid, text, text, text, boolean, boolean, text, text, text);

create or replace function public.update_my_profile(
  p_member_id       uuid,
  p_display_name    text    default null,
  p_email           text    default null,
  p_phone           text    default null,
  p_email_public    boolean default null,
  p_phone_public    boolean default null,
  p_emergency_name  text    default null,
  p_emergency_phone text    default null,
  p_first_name      text    default null,
  p_last_name       text    default null,
  p_birth_date      date    default null,
  p_street          text    default null,
  p_house_number    text    default null,
  p_postal_code     text    default null,
  p_city            text    default null,
  p_country         text    default null,
  -- Ein Geburtsdatum löscht man nicht mit einem leeren Text, sondern mit
  -- diesem Schalter: `date` kennt kein «leer».
  p_clear_birth_date boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
  v_name   text;
  v_first  text;
  v_last   text;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    raise exception 'Mitglied nicht gefunden';
  end if;

  -- BR-028: Die Entscheide gehören der Person, nicht dem Verein.
  if v_member.user_id is distinct from auth.uid() then
    raise exception 'Nur die Person selbst pflegt ihr Profil';
  end if;

  -- BR-031: Ein Mitglied trägt immer einen Anzeigenamen.
  v_name := nullif(trim(coalesce(p_display_name, '')), '');
  if p_display_name is not null and v_name is null then
    raise exception 'Der Anzeigename darf nicht leer sein';
  end if;

  v_first := case when p_first_name is null then v_member.first_name
                  else nullif(trim(p_first_name), '') end;
  v_last  := case when p_last_name is null then v_member.last_name
                  else nullif(trim(p_last_name), '') end;

  -- BR-208: Ohne eigenen Anzeigenamen tragen Vor- und Nachname ihn.
  if v_name is null and v_first is not null and v_last is not null then
    v_name := trim(v_first || ' ' || v_last);
  end if;

  update club_members
     set display_name = coalesce(v_name, display_name),
         first_name   = v_first,
         last_name    = v_last,
         privacy = privacy
           || case when p_email_public is null then '{}'::jsonb
                   else jsonb_build_object('email', p_email_public) end
           || case when p_phone_public is null then '{}'::jsonb
                   else jsonb_build_object('phone', p_phone_public) end
   where id = p_member_id;

  -- Vor- und Nachname stehen in `club_members` und gehören **nicht** in diese
  -- Bedingung: Wer nur seinen Vornamen nachträgt, bekäme sonst eine
  -- Kontaktzeile aus lauter `null`.
  if p_email is not null or p_phone is not null
     or p_emergency_name is not null or p_emergency_phone is not null
     or p_birth_date is not null or p_clear_birth_date
     or p_street is not null or p_house_number is not null
     or p_postal_code is not null or p_city is not null or p_country is not null then
    insert into member_contacts (
      member_id, email, phone, emergency_name, emergency_phone,
      birth_date, street, house_number, postal_code, city, country
    )
    values (
      p_member_id,
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_emergency_name, '')), ''),
      nullif(trim(coalesce(p_emergency_phone, '')), ''),
      case when p_clear_birth_date then null else p_birth_date end,
      nullif(trim(coalesce(p_street, '')), ''),
      nullif(trim(coalesce(p_house_number, '')), ''),
      nullif(trim(coalesce(p_postal_code, '')), ''),
      nullif(trim(coalesce(p_city, '')), ''),
      nullif(upper(trim(coalesce(p_country, ''))), '')
    )
    on conflict (member_id) do update
      set email = coalesce(nullif(trim(excluded.email), ''), member_contacts.email),
          phone = coalesce(nullif(trim(excluded.phone), ''), member_contacts.phone),
          emergency_name = case when p_emergency_name is null then member_contacts.emergency_name
                                else nullif(trim(p_emergency_name), '') end,
          emergency_phone = case when p_emergency_phone is null then member_contacts.emergency_phone
                                 else nullif(trim(p_emergency_phone), '') end,
          birth_date = case when p_clear_birth_date then null
                            when p_birth_date is null then member_contacts.birth_date
                            else p_birth_date end,
          street = case when p_street is null then member_contacts.street
                        else nullif(trim(p_street), '') end,
          house_number = case when p_house_number is null then member_contacts.house_number
                              else nullif(trim(p_house_number), '') end,
          postal_code = case when p_postal_code is null then member_contacts.postal_code
                             else nullif(trim(p_postal_code), '') end,
          city = case when p_city is null then member_contacts.city
                      else nullif(trim(p_city), '') end,
          country = case when p_country is null then member_contacts.country
                         else nullif(upper(trim(p_country)), '') end;
  end if;
end;
$$;

revoke execute on function public.update_my_profile(
  uuid, text, text, text, boolean, boolean, text, text,
  text, text, date, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.update_my_profile(
  uuid, text, text, text, boolean, boolean, text, text,
  text, text, date, text, text, text, text, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Der Altbestand legt Vor- und Nachname jetzt getrennt ab (UC-040).
--
-- Rumpf wie `0071`, mit zwei zusätzlichen Zuweisungen: Die Quelle liefert
-- `first_name` und `last_name` ohnehin getrennt und hat sie bisher nur
-- zusammengefügt. Wie dort gilt: Wer hier ein Konto hat, pflegt sein Profil
-- hier – die Quelle überschreibt nur Mitglieder ohne Konto.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_legacy_members(p_club_id uuid, p_rows jsonb)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    jsonb;
  v_legacy text;
  v_email  text;
  v_first  text;
  v_last   text;
  v_name   text;
  v_role   text;
  v_roles  text[];
  v_id     uuid;
  v_count  int := 0;
begin
  if not exists (select 1 from legacy_sources where club_id = p_club_id) then
    return 0;
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_legacy := nullif(trim(coalesce(v_row->>'legacy_user_id', '')), '');
    if v_legacy is null then continue; end if;

    v_email := nullif(lower(trim(coalesce(v_row->>'email', ''))), '');
    v_first := nullif(trim(coalesce(v_row->>'first_name', '')), '');
    v_last  := nullif(trim(coalesce(v_row->>'last_name', '')), '');
    v_name  := nullif(trim(concat_ws(' ', v_first, v_last)), '');
    v_name  := coalesce(v_name, split_part(coalesce(v_email, 'Mitglied'), '@', 1));
    v_roles := coalesce(array(select jsonb_array_elements_text(
                 case when jsonb_typeof(v_row->'roles') = 'array' then v_row->'roles' else '[]'::jsonb end)),
                 '{}');
    v_role  := case
                 when 'Vorstand' = any (v_roles) then 'admin'
                 when 'Trainer/in' = any (v_roles) or 'Trainer' = any (v_roles) then 'trainer'
                 else 'member'
               end;

    select id into v_id from club_members
     where club_id = p_club_id and legacy_user_id = v_legacy;

    if v_id is null and v_email is not null then
      select m.id into v_id
        from club_members m join auth.users u on u.id = m.user_id
       where m.club_id = p_club_id and m.legacy_user_id is null
         and lower(u.email) = v_email
       limit 1;
    end if;

    if v_id is null and v_email is not null then
      select m.id into v_id
        from club_members m join member_contacts c on c.member_id = m.id
       where m.club_id = p_club_id and m.legacy_user_id is null
         and lower(c.email) = v_email
       limit 1;
    end if;

    if v_id is null then
      insert into club_members (club_id, user_id, role, display_name,
                                first_name, last_name, legacy_user_id)
      values (p_club_id, null, v_role, left(v_name, 120),
              left(v_first, 80), left(v_last, 80), v_legacy)
      returning id into v_id;
    else
      update club_members
         set legacy_user_id = v_legacy,
             display_name = case when user_id is null then left(v_name, 120) else display_name end,
             -- Auch bei einem Konto: Getrennte Namen sind Struktur, kein
             -- Anzeigetext – und die Person hat sie hier noch nie gepflegt.
             first_name = coalesce(first_name, left(v_first, 80)),
             last_name  = coalesce(last_name, left(v_last, 80))
       where id = v_id;
    end if;

    if v_email is not null then
      insert into member_contacts (member_id, email) values (v_id, v_email)
      on conflict (member_id) do update
        set email = coalesce(member_contacts.email, excluded.email);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.upsert_legacy_members(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.upsert_legacy_members(uuid, jsonb) to service_role;
