-- ============================================================================
-- 0013_profile_privacy: Profil und Datenschutz-Optionen (UC-008)
--
-- Der Kern ist BR-030: Als verborgen markierte Kontaktangaben werden anderen
-- Mitgliedern **nicht ausgeliefert**, nicht nur ausgeblendet. Ein Flag, das
-- der Client auswertet, erfüllt das nicht – die Angabe stünde in der Antwort
-- und wäre über die REST-API auslesbar.
--
-- Deshalb liegen die Kontaktangaben in einer eigenen Tabelle, die nur die
-- Person selbst und der Vorstand lesen dürfen. Für alle anderen gibt es die
-- Sicht `club_directory`, die je Feld maskiert.
-- ============================================================================

-- Sichtbarkeitsentscheide je Mitgliedschaft (BR-028) – Form aus dem
-- Entitätsmodell: { "email": false, "phone": false }.
alter table club_members
  add column if not exists privacy jsonb not null default '{}'::jsonb;

-- Gehört fachlich zu UC-025, aber in diese Tabelle; die Spalte steht im
-- Entitätsmodell und wird dort gebraucht.
alter table club_members
  add column if not exists health_opt_out boolean not null default false;

-- ---------------------------------------------------------------------------
-- Kontaktangaben.
--
-- Eigene Tabelle statt Spalten auf `club_members`: Die Policy `members_read`
-- lässt jedes Vereinsmitglied alle Spalten lesen. Eine Telefonnummer dort
-- wäre für alle sichtbar, egal was ein Flag sagt.
-- ---------------------------------------------------------------------------
create table if not exists member_contacts (
  member_id uuid primary key references club_members(id) on delete cascade,
  email     text,
  phone     text
);

alter table member_contacts enable row level security;

-- Lesen darf die Person selbst und der Vorstand. Alle anderen gehen über die
-- maskierende Sicht.
drop policy if exists member_contacts_own on member_contacts;
create policy member_contacts_own on member_contacts
  for all
  using (
    exists (
      select 1 from club_members m
      where m.id = member_id
        and (m.user_id = auth.uid() or is_club_admin(m.club_id))
    )
  )
  with check (
    exists (
      select 1 from club_members m
      where m.id = member_id
        and (m.user_id = auth.uid() or is_club_admin(m.club_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Das Vereinsverzeichnis mit maskierten Kontaktangaben.
--
-- Bewusst **keine** `security_invoker`-Sicht: Sie muss `member_contacts` lesen
-- können, um überhaupt maskieren zu können. Die Zugangsprüfung macht sie
-- deshalb selbst über `is_club_member()`, und sie gibt ein Feld nur heraus,
-- wenn die Person es freigegeben hat oder es ihr eigenes ist (BR-030).
-- ---------------------------------------------------------------------------
create or replace view public.club_directory
with (security_invoker = false)
as
select
  m.id            as member_id,
  m.club_id,
  m.display_name,
  m.avatar_url,
  m.role,
  m.status,
  m.member_since,
  case
    when m.user_id = auth.uid() or coalesce((m.privacy->>'email')::boolean, false)
    then c.email
  end as email,
  case
    when m.user_id = auth.uid() or coalesce((m.privacy->>'phone')::boolean, false)
    then c.phone
  end as phone
from club_members m
left join member_contacts c on c.member_id = m.id
where is_club_member(m.club_id);

revoke all on public.club_directory from public, anon;
grant select on public.club_directory to authenticated;

-- ---------------------------------------------------------------------------
-- Eigene Kontaktangaben und Sichtbarkeit setzen (Schritt 4).
--
-- Als Funktion, weil beides zusammengehört: Wer eine Nummer einträgt und
-- gleichzeitig verbirgt, soll nicht kurz eine sichtbare Nummer hinterlassen.
-- ---------------------------------------------------------------------------
create or replace function public.update_my_profile(
  p_member_id    uuid,
  p_display_name text default null,
  p_email        text default null,
  p_phone        text default null,
  p_email_public boolean default null,
  p_phone_public boolean default null
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

  if p_email is not null or p_phone is not null then
    insert into member_contacts (member_id, email, phone)
    values (p_member_id, nullif(trim(p_email), ''), nullif(trim(p_phone), ''))
    on conflict (member_id) do update
      set email = coalesce(nullif(trim(excluded.email), ''), member_contacts.email),
          phone = coalesce(nullif(trim(excluded.phone), ''), member_contacts.phone);
  end if;
end;
$$;

revoke execute on function
  public.update_my_profile(uuid, text, text, text, boolean, boolean)
  from public, anon;
grant execute on function
  public.update_my_profile(uuid, text, text, text, boolean, boolean)
  to authenticated;
