-- ============================================================================
-- 0086_media_default_null: Ein Bild wegnehmen heisst, keines mitzugeben
--
-- `set_member_avatar()` und `set_team_photo()` aus `0083` nehmen `null` als
-- «kein Bild» entgegen – aber ohne Vorgabewert. Der Typgenerator von Supabase
-- leitet daraus `p_url: string` ab, nicht `string | null`: Für ihn ist ein
-- Parameter ohne Vorgabe ein Pflichtparameter mit einem Nicht-Null-Typ. Die
-- App müsste also entweder an der Typprüfung vorbeicasten oder behaupten, ein
-- Bild liesse sich nicht entfernen.
--
-- Beides wäre eine Notlüge über eine Schnittstelle, die es gar nicht braucht:
-- `default null` sagt dasselbe ehrlicher. **Kein Pfad mitgeben heisst, das
-- Bild wegzunehmen** – und `export_members()` macht es seit `0082` genauso
-- («kein Team» heisst «der ganze Verein»).
--
-- Die Rümpfe sind unverändert; `create or replace` behält Rechte und
-- Abhängigkeiten, weil sich die Signatur nicht ändert – ein Vorgabewert ist
-- nicht Teil der Signatur.
-- ============================================================================

create or replace function public.set_member_avatar(
  p_member_id uuid,
  p_url       text default null
)
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

  -- Wie in `0083`: ein Pfad, keine Adresse – und damit eine Prüfung, die
  -- zumacht. Verein, Art und Mitglied stehen fest, ein Schrägstrich mehr ist
  -- nicht erlaubt, und einen fremden Ort gibt es nicht zu erlauben.
  if v_url is not null and v_url !~ (
       '^' || v_member.club_id::text || '/members/' || p_member_id::text
       || '/[^/]+$') then
    raise exception 'Dieser Pfad gehört nicht zum Vereinsspeicher';
  end if;

  update club_members set avatar_url = v_url where id = p_member_id;
end;
$$;

create or replace function public.set_team_photo(
  p_team_id uuid,
  p_url     text default null
)
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

  if v_url is not null and v_url !~ (
       '^' || v_team.club_id::text || '/teams/' || p_team_id::text
       || '/[^/]+$') then
    raise exception 'Dieser Pfad gehört nicht zum Vereinsspeicher';
  end if;

  update teams set photo_url = v_url where id = p_team_id;
end;
$$;

revoke execute on function public.set_member_avatar(uuid, text) from public, anon;
grant  execute on function public.set_member_avatar(uuid, text) to authenticated;
revoke execute on function public.set_team_photo(uuid, text) from public, anon;
grant  execute on function public.set_team_photo(uuid, text) to authenticated;
