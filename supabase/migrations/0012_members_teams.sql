-- ============================================================================
-- 0012_members_teams: Mitglieder, Rollen und Teams verwalten (UC-007)
--
-- Die Tabellen bestehen seit 0001, und die Policy `members_admin_write` lässt
-- den Vorstand schreiben. Was fehlt, ist die Untergrenze aus BR-026: Ein
-- Verein hat zu **jedem Zeitpunkt** mindestens eine Person mit Vorstandsrechten.
--
-- Diese Regel gehört als Trigger an die Tabelle und nicht in eine Funktion,
-- die das UI aufruft: Sie muss auch dann greifen, wenn jemand direkt über
-- /rest/v1/club_members schreibt (C-011, BR-027).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Wie viele Personen tragen im Verein noch Vorstandsrechte?
-- ---------------------------------------------------------------------------
create or replace function public.count_club_admins(p_club_id uuid, p_except uuid default null)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
  from club_members
  where club_id = p_club_id
    and role in ('admin','superadmin')
    and status <> 'left'
    and (p_except is null or id <> p_except);
$$;

-- ---------------------------------------------------------------------------
-- BR-026: Der letzte Vorstand lässt sich weder herabstufen noch austragen.
-- ---------------------------------------------------------------------------
create or replace function public.guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_admin boolean;
  v_is_admin  boolean;
begin
  v_was_admin := old.role in ('admin','superadmin') and old.status <> 'left';
  v_is_admin  := new.role in ('admin','superadmin') and new.status <> 'left';

  -- Nur der Übergang «war Vorstand, ist es nicht mehr» ist heikel.
  if v_was_admin and not v_is_admin then
    if count_club_admins(old.club_id, old.id) = 0 then
      raise exception
        'Ein Verein braucht mindestens eine Person mit Vorstandsrechten.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists club_members_guard_last_admin on club_members;
create trigger club_members_guard_last_admin
  before update on club_members
  for each row
  execute function public.guard_last_admin();

-- Dasselbe beim Löschen: Eine Mitgliedschaft wird zwar nie über das UI
-- gelöscht, aber ein direkter Aufruf soll den Verein nicht enthaupten können.
create or replace function public.guard_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.role in ('admin','superadmin') and old.status <> 'left'
     and count_club_admins(old.club_id, old.id) = 0 then
    raise exception
      'Ein Verein braucht mindestens eine Person mit Vorstandsrechten.';
  end if;
  return old;
end;
$$;

drop trigger if exists club_members_guard_last_admin_delete on club_members;
create trigger club_members_guard_last_admin_delete
  before delete on club_members
  for each row
  execute function public.guard_last_admin_delete();

-- ---------------------------------------------------------------------------
-- Team-Zuordnung eines Mitglieds in einem Schritt setzen (Schritt 6).
--
-- Als Funktion und nicht als zwei Aufrufe aus dem Client: Sonst steht ein
-- Mitglied zwischen dem Entfernen und dem Hinzufügen kurz in keinem Team, und
-- ein Abbruch dazwischen hinterlässt genau diesen Zustand.
-- ---------------------------------------------------------------------------
create or replace function public.set_member_teams(
  p_member_id uuid,
  p_team_ids  uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id from club_members where id = p_member_id;
  if v_club_id is null then
    raise exception 'Mitglied nicht gefunden';
  end if;

  if not is_club_admin(v_club_id) then
    raise exception 'Nur der Vorstand ändert Team-Zuordnungen';
  end if;

  -- Ein Team aus einem fremden Verein wäre ein Bruch der Mandantentrennung.
  if exists (
    select 1 from unnest(coalesce(p_team_ids, '{}'::uuid[])) as t(id)
    where not exists (
      select 1 from teams where teams.id = t.id and teams.club_id = v_club_id
    )
  ) then
    raise exception 'Team gehört nicht zu diesem Verein';
  end if;

  delete from team_members
   where member_id = p_member_id
     and team_id <> all (coalesce(p_team_ids, '{}'::uuid[]));

  -- BR-025: Ein Mitglied kann mehreren Teams gleichzeitig angehören.
  insert into team_members (team_id, member_id)
  select t.id, p_member_id from unnest(coalesce(p_team_ids, '{}'::uuid[])) as t(id)
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013).
-- ---------------------------------------------------------------------------
revoke execute on function public.count_club_admins(uuid, uuid) from public, anon;
grant  execute on function public.count_club_admins(uuid, uuid) to authenticated;

revoke execute on function public.set_member_teams(uuid, uuid[]) from public, anon;
grant  execute on function public.set_member_teams(uuid, uuid[]) to authenticated;

-- Die Trigger-Funktionen ruft nur Postgres selbst auf.
revoke execute on function public.guard_last_admin()        from public, anon, authenticated;
revoke execute on function public.guard_last_admin_delete() from public, anon, authenticated;
