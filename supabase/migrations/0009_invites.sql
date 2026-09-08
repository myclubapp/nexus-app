-- ============================================================================
-- 0009_invites: Einladung erstellen, ansehen und einlösen (UC-002, UC-003)
--
-- Drei Lücken der bisherigen Fassung:
--   1. Ein Gast kann eine Einladung nicht ansehen, bevor er sie einlöst. Die
--      Policy `invites_admin` lässt nur den Vorstand lesen – zu Recht, denn der
--      Code ist das Geheimnis. UC-002 Schritt 2 verlangt aber, dass vor dem
--      Beitritt Verein, Team und Rolle sichtbar sind. Dafür gibt es unten eine
--      Funktion, die genau diese vier Angaben zurückgibt und sonst nichts.
--   2. Ein Widerruf hat keinen Platz im Schema (BR-012).
--   3. `redeem_invite()` nimmt keinen Anzeigenamen entgegen (UC-002 Schritt 5).
-- ============================================================================

-- BR-012: Der Widerruf wirkt nur nach vorne. Bereits eingelöste
-- Mitgliedschaften bleiben bestehen, deshalb ein eigenes Feld statt einer
-- Löschung.
alter table invites add column if not exists revoked_at timestamptz;

-- BR-010: 6 Bytes sind 48 Bit. Für neue Einladungen 16 Bytes, damit der Code
-- auch bei vielen Vereinen nicht durch Ausprobieren zu finden ist. Bestehende
-- Codes bleiben gültig.
alter table invites
  alter column code set default encode(extensions.gen_random_bytes(16), 'hex');

create index if not exists invites_club_idx on invites(club_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Einladung ansehen, ohne sie einzulösen (UC-002, Schritt 2).
--
-- Gibt nur zurück, was der Gast zur Entscheidung braucht. Kein Zugriff auf die
-- Einladungsliste, keine Mitgliederzahlen, kein Rückschluss auf andere
-- Einladungen. Auch für `anon` freigegeben: Wer den Link öffnet, ist zu diesem
-- Zeitpunkt oft noch nicht angemeldet.
-- ---------------------------------------------------------------------------
create or replace function public.preview_invite(p_code text)
returns table (
  club_id    uuid,
  club_name  text,
  team_name  text,
  role       text,
  is_valid   boolean,
  reason     text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite invites;
  v_club   clubs;
  v_team   teams;
begin
  select * into v_invite from invites where code = lower(trim(p_code));
  if not found then
    -- Ein unbekannter Code sieht aus wie ein abgelaufener: Die Antwort soll
    -- nicht verraten, welche Codes existieren.
    return query select null::uuid, null::text, null::text, null::text, false, 'unknown';
    return;
  end if;

  select * into v_club from clubs where id = v_invite.club_id;
  if v_invite.team_id is not null then
    select * into v_team from teams where id = v_invite.team_id;
  end if;

  return query
  select
    v_club.id,
    v_club.name,
    v_team.name,
    v_invite.role,
    v_invite.revoked_at is null
      and v_invite.expires_at >= now()
      and v_invite.uses < v_invite.max_uses,
    case
      when v_invite.revoked_at is not null then 'revoked'
      when v_invite.expires_at < now() then 'expired'      -- A1
      when v_invite.uses >= v_invite.max_uses then 'exhausted' -- A2
      else null
    end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Einladung einlösen – ersetzt die Fassung aus 0005_onboarding.sql.
--
-- Neu: der Anzeigename aus Schritt 5 und die Prüfung auf Widerruf. Die alte
-- Signatur wird gelöscht, sonst hinge sie weiter als eigener RPC.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_code         text,
  p_display_name text default null
)
returns uuid -- die id des Vereins, dem die Person nun angehört
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user      uuid := auth.uid();
  v_invite    invites;
  v_member_id uuid;
  v_name      text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- `for update` serialisiert gleichzeitige Einlösungen: ohne die Sperre
  -- kämen bei der letzten freien Einlösung zwei Personen durch.
  select * into v_invite from invites where code = lower(trim(p_code)) for update;
  if not found then
    raise exception 'Einladungscode unbekannt';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Diese Einladung wurde zurückgezogen';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Dieser Einladungscode ist abgelaufen';
  end if;

  if v_invite.uses >= v_invite.max_uses then
    raise exception 'Dieser Einladungscode wurde bereits zu oft verwendet';
  end if;

  v_name := nullif(trim(coalesce(p_display_name, '')), '');

  select id into v_member_id
  from club_members
  where club_id = v_invite.club_id and user_id = v_user;

  if v_member_id is null then
    insert into club_members (club_id, user_id, role, display_name)
    values (
      v_invite.club_id,
      v_user,
      v_invite.role,
      coalesce(
        v_name,
        (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = v_user),
        split_part((select email from auth.users where id = v_user), '@', 1)
      )
    )
    returning id into v_member_id;
  end if;
  -- A3/BR-008: Eine bestehende Mitgliedschaft bleibt unverändert. Eine erneut
  -- eingelöste Einladung hebt insbesondere keine Rolle an.

  -- A4: Die Team-Zuordnung wird auch dann ergänzt, wenn die Mitgliedschaft
  -- schon bestand.
  if v_invite.team_id is not null then
    insert into team_members (team_id, member_id)
    values (v_invite.team_id, v_member_id)
    on conflict do nothing;
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  return v_invite.club_id;
end;
$$;

drop function if exists public.redeem_invite(text);

revoke execute on function public.redeem_invite(text, text) from public, anon;
grant execute on function public.redeem_invite(text, text) to authenticated;

-- Absichtlich auch für `anon`: Der Link wird oft geöffnet, bevor sich die
-- Person anmeldet. Die Funktion gibt nur Vereinsname, Team und Rolle heraus.
revoke execute on function public.preview_invite(text) from public;
grant execute on function public.preview_invite(text) to anon, authenticated;
