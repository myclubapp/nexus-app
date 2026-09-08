-- ============================================================================
-- 0001_core: Vereine, Mitglieder, Teams, Einladungen
-- Entspricht «Technische Architektur» §5.2 mit dem MVP-Schnitt aus §13
-- (club_kind statt sport_type, kein globaler Verbands-Presync).
-- ============================================================================

-- Supabase legt Extensions im Schema `extensions` ab, nicht in `public`.
-- Migrationen laufen ohne dieses Schema im search_path, deshalb werden
-- pgcrypto-Funktionen unten schemaqualifiziert aufgerufen.
create extension if not exists pgcrypto with schema extensions;

create table clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text unique not null,
  -- Vereinsart-offen ab Tag 1 (MVP-Scope §6): Sport ist eine Option, keine Annahme.
  club_kind    text not null default 'other'
                 check (club_kind in ('sport','music','culture','youth','neighborhood','other')),
  season_start date,
  -- Theme (White-Label ohne Rebuild), Begriffs-Labels und Feature-Flags.
  settings     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create table teams (
  id      uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name    text not null
);
create index teams_club_idx on teams(club_id);

create table club_members (
  id                 uuid primary key default gen_random_uuid(),
  club_id            uuid not null references clubs(id) on delete cascade,
  user_id            uuid references auth.users(id) on delete cascade,
  role               text not null default 'member'
                       check (role in ('member','trainer','admin','superadmin')),
  member_since       date not null default current_date,
  display_name       text not null,
  avatar_url         text,
  leaderboard_opt_in boolean not null default true,
  is_minor           boolean not null default false,
  status             text not null default 'active'
                       check (status in ('active','passive','honorary','left')),
  unique (club_id, user_id)
);
create index club_members_club_idx on club_members(club_id);
create index club_members_user_idx on club_members(user_id);

create table team_members (
  team_id   uuid not null references teams(id) on delete cascade,
  member_id uuid not null references club_members(id) on delete cascade,
  role      text not null default 'player' check (role in ('player','trainer','staff')),
  primary key (team_id, member_id)
);

-- Invite-first-Onboarding: Link oder QR mit Rolle, Team und Ablaufdatum.
create table invites (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  team_id    uuid references teams(id) on delete set null,
  code       text unique not null default encode(extensions.gen_random_bytes(6), 'hex'),
  role       text not null default 'member' check (role in ('member','trainer','admin')),
  expires_at timestamptz not null default now() + interval '30 days',
  max_uses   int not null default 50,
  uses       int not null default 0,
  created_by uuid references club_members(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Beitritt ohne Einladung: Anfrage, die der Vorstand freigibt (myclub-Muster).
create table join_requests (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  team_id    uuid references teams(id) on delete set null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  decided_by uuid references club_members(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Hilfsfunktionen für RLS.
-- Sie laufen als security definer, damit die Policies auf club_members nicht
-- wieder club_members abfragen – das ergäbe eine Rekursion.
-- ---------------------------------------------------------------------------
create or replace function public.is_club_member(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from club_members
    where club_id = p_club_id
      and user_id = auth.uid()
      and status <> 'left'
  );
$$;

create or replace function public.is_club_admin(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from club_members
    where club_id = p_club_id
      and user_id = auth.uid()
      and role in ('admin','superadmin')
      and status <> 'left'
  );
$$;

create or replace function public.current_member_id(p_club_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id from club_members
  where club_id = p_club_id and user_id = auth.uid() and status <> 'left'
  limit 1;
$$;

-- Eindeutiger, lesbarer Slug aus dem Vereinsnamen.
create or replace function public.slugify(p_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from
    regexp_replace(
      lower(translate(p_value, 'äöüÄÖÜàáâãéèêëìíîïòóôõùúûñçÀÁÂÃÉÈÊËÌÍÎÏÒÓÔÕÙÚÛÑÇ',
                                'aouAOUaaaaeeeeiiiiooooouuuncAAAAEEEEIIIIOOOOOUUUNC')),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;
