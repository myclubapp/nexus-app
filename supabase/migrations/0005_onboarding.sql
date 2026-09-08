-- ============================================================================
-- 0005_onboarding: Verein gründen, Einladung einlösen, Punkteregel-Vorlagen
-- MVP-Scope §6: Die Vereinsart steuert nur die Vorlagen, nichts ist endgültig.
-- Sieben Säulen gemäss «Konzept Gamification»:
--   1 Trainingsengagement · 2 Wettkampf · 3 Freiwilliges Engagement
--   4 Vereinsleben · 5 Wachstum & Treue · 6 Verlässlichkeit · 7 Marktplatz
-- ============================================================================

create or replace function public.seed_point_rules(p_club_id uuid, p_club_kind text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Für jede Vereinsart eigene Begriffe, aber immer dieselben Säulen.
  if p_club_kind = 'music' then
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Probe besucht',            10, '{"max_per_week": 3}'),
      (p_club_id, 2, 'match_attend',    'Auftritt oder Konzert',    25, '{}'),
      (p_club_id, 4, 'event_attend',    'Vereinsanlass besucht',    15, '{}');
  elsif p_club_kind = 'neighborhood' then
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Treffen besucht',          10, '{"max_per_week": 3}'),
      (p_club_id, 4, 'event_attend',    'Anlass besucht',           15, '{}');
  else
    insert into point_rules (club_id, pillar, code, label, points, meta) values
      (p_club_id, 1, 'training_attend', 'Training besucht',         10, '{"max_per_week": 4}'),
      (p_club_id, 2, 'match_attend',    'Spiel bestritten',         25, '{}'),
      (p_club_id, 4, 'event_attend',    'Vereinsanlass besucht',    15, '{}');
  end if;

  -- Diese Säulen gelten für jede Vereinsart gleich.
  insert into point_rules (club_id, pillar, code, label, points, meta) values
    (p_club_id, 3, 'shift_done',      'Helfereinsatz geleistet',    50, '{}'),
    (p_club_id, 4, 'assembly_attend', 'Versammlung besucht',        30, '{}'),
    (p_club_id, 5, 'loyalty_year',    'Ein weiteres Vereinsjahr',  100, '{}'),
    (p_club_id, 6, 'invoice_on_time', 'Rechnung pünktlich bezahlt', 40, '{}'),
    (p_club_id, 7, 'task_done',       'Aufgabe erledigt',           20, '{}');
end;
$$;

-- ---------------------------------------------------------------------------
-- Verein gründen. Die Gründerin wird Admin; ohne diesen Schritt hätte der
-- neue Verein niemanden, der ihn verwalten darf.
-- ---------------------------------------------------------------------------
create or replace function public.create_club(p_name text, p_club_kind text default 'other')
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_club_id uuid;
  v_slug    text;
  v_suffix  int := 0;
  v_name    text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  v_name := trim(p_name);
  if length(v_name) < 2 then
    raise exception 'Der Vereinsname ist zu kurz';
  end if;

  v_slug := slugify(v_name);
  while exists (select 1 from clubs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := slugify(v_name) || '-' || v_suffix;
  end loop;

  insert into clubs (name, slug, club_kind)
  values (v_name, v_slug, p_club_kind)
  returning id into v_club_id;

  insert into club_members (club_id, user_id, role, display_name)
  values (
    v_club_id,
    v_user,
    'admin',
    coalesce(
      (select nullif(raw_user_meta_data->>'full_name', '') from auth.users where id = v_user),
      split_part((select email from auth.users where id = v_user), '@', 1)
    )
  );

  perform seed_point_rules(v_club_id, p_club_kind);

  return v_club_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Einladung einlösen. Der Code ist die Berechtigung – wer ihn hat, ist
-- eingeladen (Invite-first-Onboarding, MVP-Scope §2.1).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user      uuid := auth.uid();
  v_invite    invites;
  v_member_id uuid;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_invite from invites where code = lower(trim(p_code)) for update;
  if not found then
    raise exception 'Einladungscode unbekannt';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'Dieser Einladungscode ist abgelaufen';
  end if;

  if v_invite.uses >= v_invite.max_uses then
    raise exception 'Dieser Einladungscode wurde bereits zu oft verwendet';
  end if;

  select id into v_member_id
  from club_members
  where club_id = v_invite.club_id and user_id = v_user;

  if v_member_id is null then
    insert into club_members (club_id, user_id, role, display_name)
    values (
      v_invite.club_id,
      v_user,
      v_invite.role,
      split_part((select email from auth.users where id = v_user), '@', 1)
    )
    returning id into v_member_id;
  end if;

  if v_invite.team_id is not null then
    insert into team_members (team_id, member_id)
    values (v_invite.team_id, v_member_id)
    on conflict do nothing;
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  return v_member_id;
end;
$$;
