-- ============================================================================
-- 0101_public_join_requests: die offene Anfrage ist eine Vereinseinstellung
-- (UC-004, UC-051, FR-196, BR-258, BR-259)
--
-- Bisher genügte der **Kurzname**, um bei jedem Verein anzuklopfen: `0010`
-- gibt `find_club_by_slug()` jedem angemeldeten Konto, und `request_join()`
-- fragt niemanden, ob der Verein das will. Der Kurzname steht aber in jedem
-- Einladungslink und in jeder Adresszeile – er ist kein Geheimnis, und damit
-- war die Tür jedes Vereins angelehnt, ohne dass ihn jemand gefragt hätte.
--
-- **BR-258: Ohne Freigabe keine Anfrage.** Der Weg in einen Verein ist die
-- Einladung (BR-006); die offene Anfrage ist der **zweite** Weg, und ihn
-- öffnet der Vorstand in den Vereinseinstellungen. Voreingestellt ist er zu –
-- auch für die Vereine, die es heute schon gibt. Das ist die einzige Richtung,
-- die keinen Verein ungefragt öffnet: Eine Voreinstellung «offen» wäre ein
-- Entscheid, den niemand getroffen hat.
--
-- Die Einstellung steht in `clubs.settings->'join'->>'public'` und nicht in
-- einer eigenen Spalte: Sie gehört zu den Vereinseinstellungen wie Farben,
-- Module und Rangliste, und geschrieben wird sie über die bestehende Policy
-- `clubs_update` (`is_club_admin()`). Es braucht dafür keine neue Funktion.
--
-- **Der Befund bleibt ehrlich:** Wer einen gültigen Kurznamen eingibt, erfährt
-- weiterhin, dass es diesen Verein gibt – das wusste er schon, sonst hätte er
-- den Kurznamen nicht. Neu erfährt er zusätzlich, **ob** der Verein Anfragen
-- annimmt, und bekommt sonst den Hinweis auf die Einladung. Ein «nicht
-- gefunden» wäre an dieser Stelle eine Unwahrheit, die die Person den Fehler
-- im Kurznamen suchen liesse.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Nimmt dieser Verein offene Anfragen an?
--
-- Eine Funktion und nicht ein Ausdruck an drei Stellen: Die Regel «fehlt der
-- Eintrag, ist es aus» steht genau einmal. Sie ist dieselbe wie bei den
-- Modulen (`module_enabled()` in `0052`) – nur `true` heisst `true`.
--
-- Intern: Sie wird ausschliesslich aus den `security definer`-Funktionen unten
-- gerufen und bleibt deshalb ohne Ausführungsrecht für Clients (NFR-013).
-- ---------------------------------------------------------------------------
create or replace function public.club_accepts_join_requests(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((settings->'join'->>'public')::boolean, false)
    from clubs where id = p_club_id;
$$;

-- ---------------------------------------------------------------------------
-- Verein über seinen Kurznamen finden (UC-004, Schritt 1 der anfragenden
-- Seite) – jetzt mit der Auskunft, ob eine Anfrage überhaupt einen Weg hat.
--
-- Die Rückgabe bekommt eine Spalte; deshalb erst `drop`. Ein
-- `create or replace` kann die Signatur einer `returns table`-Funktion nicht
-- ändern.
--
-- Ein Vereinsverzeichnis entsteht dadurch nicht (C-028): Die Funktion
-- antwortet weiterhin nur auf einen **exakten** Kurznamen und nennt nur den
-- Namen des Vereins.
-- ---------------------------------------------------------------------------
drop function if exists public.find_club_by_slug(text);

create function public.find_club_by_slug(p_slug text)
returns table (club_id uuid, club_name text, accepts_requests boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id, name, coalesce((settings->'join'->>'public')::boolean, false)
    from clubs where slug = lower(trim(p_slug));
$$;

-- ---------------------------------------------------------------------------
-- Anfrage stellen – und zwar nur dort, wo der Verein sie annimmt.
--
-- Fortgeschrieben aus `0010`. Neu ist **eine** Bedingung; alles andere bleibt,
-- wie es war, damit der Ablauf aus UC-004 unverändert gilt.
--
-- Die Prüfung steht hier und nicht im Formular: Ein ausgeblendeter Knopf ist
-- keine Regel (C-011), und diese Funktion hängt als Endpunkt unter
-- `/rest/v1/rpc/request_join`.
-- ---------------------------------------------------------------------------
create or replace function public.request_join(
  p_club_id uuid,
  p_team_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user    uuid := auth.uid();
  v_club    clubs;
  v_id      uuid;
  v_admin   record;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

  select * into v_club from clubs where id = p_club_id;
  if not found then
    raise exception 'Verein nicht gefunden';
  end if;

  -- BR-258: Der Verein bestimmt, ob es diesen Weg zu ihm gibt.
  if not club_accepts_join_requests(p_club_id) then
    raise exception 'Dieser Verein nimmt keine Beitritts-Anfragen entgegen';
  end if;

  if exists (select 1 from club_members
              where club_id = p_club_id and user_id = v_user and status <> 'left') then
    raise exception 'Du gehörst diesem Verein bereits an';
  end if;

  -- Eine erneute Anfrage überschreibt eine erledigte; eine offene bleibt, wie
  -- sie ist. Die Eindeutigkeit je Verein und Konto lässt nichts anderes zu.
  insert into join_requests (club_id, team_id, user_id, status)
  values (p_club_id, p_team_id, v_user, 'pending')
  on conflict (club_id, user_id) do update
     set status     = 'pending',
         team_id    = excluded.team_id,
         decided_by = null,
         decided_at = null,
         created_at = now()
   where join_requests.status <> 'pending'
  returning id into v_id;

  if v_id is null then
    -- Es bestand bereits eine offene Anfrage; das ist kein Fehler.
    select id into v_id from join_requests
     where club_id = p_club_id and user_id = v_user;
    return v_id;
  end if;

  -- Schritt 1: Der Vorstand erfährt von der Anfrage.
  for v_admin in
    select user_id from club_members
     where club_id = p_club_id and role in ('admin','superadmin') and status <> 'left'
       and user_id is not null
  loop
    perform notify(
      v_admin.user_id, 'join_request',
      'Neue Beitritts-Anfrage',
      'Für ' || v_club.name || ' liegt eine Anfrage vor.',
      '/tabs/profile/requests', p_club_id
    );
  end loop;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte (NFR-013).
--
-- `club_accepts_join_requests()` ist eine interne Routine: Sie wird aus den
-- Funktionen oben gerufen, die als Eigentümer laufen. Ein eigener Endpunkt
-- wäre eine Abfrage, mit der sich Kurznamen durchprobieren liessen.
-- ---------------------------------------------------------------------------
revoke execute on function public.club_accepts_join_requests(uuid)
  from public, anon, authenticated;

revoke execute on function public.find_club_by_slug(text) from public, anon;
grant  execute on function public.find_club_by_slug(text) to authenticated;

-- `create or replace` behält die Rechte aus `0010`. Sie stehen hier trotzdem:
-- Wer die Datei liest, soll sehen, wer diese Funktion aufrufen darf, statt es
-- aus einer zwei Jahre alten Migration erschliessen zu müssen. `revoke … from
-- anon` allein genügt nicht – `anon` zieht sein Recht aus PUBLIC.
revoke execute on function public.request_join(uuid, uuid) from public, anon;
grant  execute on function public.request_join(uuid, uuid) to authenticated;
