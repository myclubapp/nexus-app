-- ============================================================================
-- 0063_member_contacts: Adresse und Notfallkontakt (Konzept §3.1, §4.1 Säule 6)
--
-- Das Konzept nennt bei den Stammdaten «Kontakte, Notfallkontakte» und bei
-- Säule 6 ein vollständiges Profil mit «Notfallkontakt, Adresse, Foto». Bis
-- hierher kannte die App E-Mail und Telefon. Adresse und Notfallkontakt
-- kommen an dieselbe Stelle wie diese – in `member_contacts`, hinter
-- derselben Policy (0013): Die Person selbst und der Vorstand lesen die
-- Zeile, alle anderen nicht.
--
-- **Wer den Notfallkontakt braucht, ist die Trainer:in** – am Spieltag, am
-- Lager, am Rand des Platzes. Deshalb gibt es dafür einen eigenen, engen
-- Weg: `emergency_contact()` gibt Name und Nummer der Notfallperson heraus,
-- für die Person selbst, den Vorstand und Trainer:innen eines gemeinsamen
-- Teams. Nichts sonst – keine Adresse, keine eigene Telefonnummer. Die
-- Adresse bleibt beim Vorstand (Rechnungen, Post) und bei der Person.
-- ============================================================================

alter table member_contacts add column if not exists address text
  check (address is null or length(address) <= 200);
alter table member_contacts add column if not exists emergency_name text
  check (emergency_name is null or length(emergency_name) <= 80);
alter table member_contacts add column if not exists emergency_phone text
  check (emergency_phone is null or length(emergency_phone) <= 40);

-- ---------------------------------------------------------------------------
-- Profil speichern – die Signatur aus 0013, um drei Felder ergänzt.
--
-- Für die neuen Felder gilt: `null` heisst «unverändert», ein leerer Text
-- heisst «löschen». Wer den Notfallkontakt austrägt, soll ihn austragen
-- können – bei E-Mail und Telefon (0013) bleibt der alte Wert stehen, und
-- das ändert diese Migration nicht.
-- ---------------------------------------------------------------------------
drop function if exists public.update_my_profile(uuid, text, text, text, boolean, boolean);

create or replace function public.update_my_profile(
  p_member_id       uuid,
  p_display_name    text    default null,
  p_email           text    default null,
  p_phone           text    default null,
  p_email_public    boolean default null,
  p_phone_public    boolean default null,
  p_address         text    default null,
  p_emergency_name  text    default null,
  p_emergency_phone text    default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
  v_name   text;
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

  update club_members
     set display_name = coalesce(v_name, display_name),
         privacy = privacy
           || case when p_email_public is null then '{}'::jsonb
                   else jsonb_build_object('email', p_email_public) end
           || case when p_phone_public is null then '{}'::jsonb
                   else jsonb_build_object('phone', p_phone_public) end
   where id = p_member_id;

  if p_email is not null or p_phone is not null
     or p_address is not null or p_emergency_name is not null or p_emergency_phone is not null then
    insert into member_contacts (member_id, email, phone, address, emergency_name, emergency_phone)
    values (
      p_member_id,
      nullif(trim(coalesce(p_email, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_address, '')), ''),
      nullif(trim(coalesce(p_emergency_name, '')), ''),
      nullif(trim(coalesce(p_emergency_phone, '')), '')
    )
    on conflict (member_id) do update
      set email = coalesce(nullif(trim(excluded.email), ''), member_contacts.email),
          phone = coalesce(nullif(trim(excluded.phone), ''), member_contacts.phone),
          address = case when p_address is null then member_contacts.address
                         else nullif(trim(p_address), '') end,
          emergency_name = case when p_emergency_name is null then member_contacts.emergency_name
                                else nullif(trim(p_emergency_name), '') end,
          emergency_phone = case when p_emergency_phone is null then member_contacts.emergency_phone
                                 else nullif(trim(p_emergency_phone), '') end;
  end if;
end;
$$;

revoke execute on function
  public.update_my_profile(uuid, text, text, text, boolean, boolean, text, text, text)
  from public, anon;
grant execute on function
  public.update_my_profile(uuid, text, text, text, boolean, boolean, text, text, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Der Notfallkontakt für die, die ihn brauchen.
--
-- Reichweite: die Person selbst, der Vorstand, Trainer:innen eines
-- gemeinsamen Teams. Sportchef:innen gelten als Trainer:innen (0059) – ihr
-- Bereich deckt das Team. Alle anderen bekommen keine Zeile, keinen Fehler.
-- ---------------------------------------------------------------------------
create or replace function public.emergency_contact(p_member_id uuid)
returns table (emergency_name text, emergency_phone text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member club_members;
  v_self   uuid;
begin
  select * into v_member from club_members where id = p_member_id;
  if not found then
    return;
  end if;

  v_self := current_member_id(v_member.club_id);

  if not (
    v_member.user_id = auth.uid()
    or is_club_admin(v_member.club_id)
    or (
      is_club_trainer(v_member.club_id)
      and exists (
        select 1 from team_members mine
        join team_members theirs on theirs.team_id = mine.team_id
        where mine.member_id = v_self and theirs.member_id = p_member_id
      )
    )
  ) then
    return;
  end if;

  return query
    select c.emergency_name, c.emergency_phone
      from member_contacts c
     where c.member_id = p_member_id;
end;
$$;

revoke execute on function public.emergency_contact(uuid) from public, anon;
grant  execute on function public.emergency_contact(uuid) to authenticated;
