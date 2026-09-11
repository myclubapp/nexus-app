-- ============================================================================
-- 0058_federation: den Verband verbinden (UC-035)
--
-- **BR-151 ist der ganze Anmeldevorgang:** Wer den Schlüssel des Vereins
-- besitzt, ist berechtigt. Es gibt kein Vereinsverzeichnis, keine
-- Kontaktadresse, die jemand prüft, und keinen Freigabeprozess. Das ist keine
-- Nachlässigkeit, sondern die einzige Zuordnung, die ohne einen zentralen
-- Katalog aller Schweizer Vereine auskommt.
--
-- **BR-153: Schlüssel liegen im Tresor.** In dieser Tabelle steht nur der
-- **Name** des Vault-Eintrags, nie der Schlüssel selbst. Auch eine Policy, die
-- zu viel erlaubt, gibt damit nichts preis – die Tabelle enthält ihn nicht.
--
-- **BR-152: kein globaler Vorabgleich.** Abgeglichen wird ausschliesslich für
-- verbundene Vereine. Ein Lauf über alle Vereine des Verbands wäre ein
-- Datenbestand, den niemand bestellt hat.
--
-- **BR-154: nur lesen.** Es gibt in dieser Migration keinen Weg, der etwas an
-- einen Verband zurückschreibt.
--
-- Der Abruf selbst gehört nicht hierher: Postgres stösst ihn über pg_net an,
-- die Edge Function `sync-federation` führt ihn aus – derselbe Weg wie beim
-- Website-Abgleich in `0023`.
-- ============================================================================

create table if not exists federation_connections (
  club_id             uuid not null references clubs(id) on delete cascade,
  -- Die Kennung des Verbands, nicht sein Anzeigename: Der steht in den
  -- Übersetzungen, weil er in vier Sprachen anders lautet.
  federation          text not null check (federation in
                        ('swissunihockey','swissvolley','swisshandball','swissturnverband')),
  -- Die Kennung des Vereins **beim Verband**. Bei den Verbänden ohne
  -- Schlüsselpflicht (A2) ist sie das Einzige, was die Verbindung ausmacht.
  federation_club_id  text not null check (length(trim(federation_club_id)) between 1 and 40),
  -- **Nur der Name des Vault-Eintrags** (BR-153). Leer, wo der Verband keinen
  -- Schlüssel verlangt.
  api_key_secret      text,
  status              text not null default 'pending'
                        check (status in ('pending','active','error')),
  last_sync_at        timestamptz,
  last_error          text,
  created_at          timestamptz not null default now(),
  primary key (club_id, federation)
);

alter table federation_connections enable row level security;

-- ---------------------------------------------------------------------------
-- Die Verbindung gehört dem Vorstand.
--
-- Mitglieder brauchen sie nicht: Was der Abgleich bringt, sehen sie als
-- Termine und News. Der Zustand der Leitung ist Verwaltung.
-- ---------------------------------------------------------------------------
drop policy if exists federation_connections_read on federation_connections;
create policy federation_connections_read on federation_connections
  for select using (is_club_admin(club_id));

-- Geschrieben wird ausschliesslich über die Funktionen unten.

-- ---------------------------------------------------------------------------
-- Schritte 4 bis 6: verbinden.
--
-- Der Schlüssel geht **in den Tresor**, nicht in die Tabelle. Ein Verein, der
-- ihn ersetzt, bekommt einen neuen Eintrag und der alte verschwindet – ein
-- Tresor voller toter Schlüssel wäre eine Sammlung, die niemand pflegt.
--
-- Die Verbindung entsteht als `pending`: Ob der Schlüssel trägt, weiss erst
-- der Testaufruf (Schritt 5), und der läuft in der Edge Function. Erst sie
-- setzt `active` oder `error` (A1).
-- ---------------------------------------------------------------------------
create or replace function public.connect_federation(
  p_club_id            uuid,
  p_federation         text,
  p_federation_club_id text,
  p_api_key            text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name  text;
  v_key   text;
  v_old   text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand verbindet den Verband';
  end if;

  if coalesce(trim(p_federation_club_id), '') = '' then
    raise exception 'Ohne Vereinskennung beim Verband gibt es nichts abzugleichen';
  end if;

  v_key := nullif(trim(coalesce(p_api_key, '')), '');

  select api_key_secret into v_old
    from federation_connections
   where club_id = p_club_id and federation = p_federation;

  if v_key is not null then
    -- Ein Name je Verein und Verband; der Inhalt wird ersetzt, nicht ergänzt.
    v_name := 'federation_' || p_federation || '_' || replace(p_club_id::text, '-', '');

    if v_old is not null then
      delete from vault.secrets where name = v_old;
    end if;

    perform vault.create_secret(v_key, v_name,
      'API-Schlüssel ' || p_federation || ' für Verein ' || p_club_id);
  else
    v_name := v_old;
  end if;

  insert into federation_connections
    (club_id, federation, federation_club_id, api_key_secret, status, last_error)
  values
    (p_club_id, p_federation, trim(p_federation_club_id), v_name, 'pending', null)
  on conflict (club_id, federation) do update
    set federation_club_id = excluded.federation_club_id,
        api_key_secret     = excluded.api_key_secret,
        status             = 'pending',
        last_error         = null;
end;
$$;

-- ---------------------------------------------------------------------------
-- A4: trennen.
--
-- Der Schlüssel verschwindet, die Verbindung verschwindet – **die importierten
-- Termine bleiben**. Sie sind Vergangenheit des Vereins und gehören ihm, nicht
-- der Leitung, über die sie kamen (BR-181 sinngemäss).
-- ---------------------------------------------------------------------------
create or replace function public.disconnect_federation(
  p_club_id    uuid,
  p_federation text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text;
begin
  if not is_club_admin(p_club_id) then
    raise exception 'Nur der Vorstand trennt den Verband';
  end if;

  select api_key_secret into v_name
    from federation_connections
   where club_id = p_club_id and federation = p_federation;

  delete from federation_connections
   where club_id = p_club_id and federation = p_federation;

  if v_name is not null then
    delete from vault.secrets where name = v_name;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Was der Abgleich braucht – und nur er.
--
-- Die Funktion gibt den entschlüsselten Schlüssel zurück und ist deshalb
-- **ausschliesslich** für `service_role` ausführbar. Für ein angemeldetes
-- Konto gibt es keinen Weg zu dieser Zeile; das ist BR-153 als Berechtigung
-- und nicht als Vorsatz.
-- ---------------------------------------------------------------------------
create or replace function public.federation_credentials(p_club_id uuid default null)
returns table (
  club_id            uuid,
  federation         text,
  federation_club_id text,
  api_key            text
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select c.club_id, c.federation, c.federation_club_id,
         (select s.decrypted_secret from vault.decrypted_secrets s
           where s.name = c.api_key_secret)
    from federation_connections c
   where p_club_id is null or c.club_id = p_club_id;
$$;

-- ---------------------------------------------------------------------------
-- Schritt 6 und A3: das Ergebnis eines Laufs festhalten.
--
-- Ein einzelner Fehlschlag setzt die Verbindung **nicht** auf `error`: Eine
-- Verbandsschnittstelle, die einmal nicht antwortet, ist kein kaputter
-- Anschluss. Erst wenn seit dem letzten erfolgreichen Abgleich mehr als drei
-- Tage vergangen sind, wechselt der Zustand – und dann erfährt es der
-- Vorstand einmal, nicht täglich (BR-155).
-- ---------------------------------------------------------------------------
create or replace function public.report_federation_sync(
  p_club_id    uuid,
  p_federation text,
  p_ok         boolean,
  p_error      text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    federation_connections;
  v_person record;
begin
  select * into v_row from federation_connections
   where club_id = p_club_id and federation = p_federation
   for update;
  if not found then
    raise exception 'Diese Verbindung besteht nicht';
  end if;

  if p_ok then
    update federation_connections
       set status = 'active', last_sync_at = now(), last_error = null
     where club_id = p_club_id and federation = p_federation;
    return;
  end if;

  update federation_connections
     set last_error = left(coalesce(p_error, 'unbekannt'), 500),
         status = case
           when v_row.status = 'pending' then 'error'
           when v_row.last_sync_at is null
             or now() - v_row.last_sync_at > interval '3 days' then 'error'
           else v_row.status
         end
   where club_id = p_club_id and federation = p_federation;

  -- Einmal melden, nicht täglich: nur beim Wechsel in den Fehlerzustand.
  if v_row.status <> 'error'
     and (select status from federation_connections
           where club_id = p_club_id and federation = p_federation) = 'error' then
    for v_person in
      select m.user_id from club_members m
       where m.club_id = p_club_id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
    loop
      perform notify(
        v_person.user_id, 'system', 'Die Verbandsverbindung meldet einen Fehler',
        null, '/tabs/profile/federation', p_club_id
      );
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Der Anstoss: pg_cron -> pg_net -> Edge Function.
--
-- Wortgleich zum Aufbau in `0023`. Fehlen die Vault-Einträge, tut die Funktion
-- nichts und sagt warum – ein Auftrag, der jede Nacht mit einem Fehler
-- abbricht, wird nach zwei Wochen ignoriert.
--
-- Einmalige Einrichtung (Werte aus den Projekteinstellungen):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',        'service_role_key');
-- ---------------------------------------------------------------------------
create or replace function public.sync_federations()
returns bigint
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_project_url text;
  v_service_key text;
  v_request_id  bigint;
begin
  if not exists (select 1 from federation_connections where status <> 'error') then
    return null;
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'Verbands-Abgleich übersprungen: project_url oder service_role_key fehlt im Vault';
    return null;
  end if;

  select net.http_post(
           url     := v_project_url || '/functions/v1/sync-federation',
           headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || v_service_key),
           body    := jsonb_build_object('mode', 'all'),
           timeout_milliseconds := 60000
         ) into v_request_id;

  return v_request_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------
revoke execute on function public.connect_federation(uuid, text, text, text)
  from public, anon;
grant  execute on function public.connect_federation(uuid, text, text, text)
  to authenticated;

revoke execute on function public.disconnect_federation(uuid, text) from public, anon;
grant  execute on function public.disconnect_federation(uuid, text) to authenticated;

-- Die beiden Wege des Dienstes: Kein angemeldetes Konto kommt an einen
-- Schlüssel, und keines schreibt den Zustand einer Leitung.
revoke execute on function public.federation_credentials(uuid)
  from public, anon, authenticated;
grant  execute on function public.federation_credentials(uuid) to service_role;

revoke execute on function public.report_federation_sync(uuid, text, boolean, text)
  from public, anon, authenticated;
grant  execute on function public.report_federation_sync(uuid, text, boolean, text)
  to service_role;

revoke execute on function public.sync_federations() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auftrag: einmal täglich, früh. Ein Spielplan ändert sich nicht stündlich.
-- ---------------------------------------------------------------------------
select cron.unschedule('federation-sync')
 where exists (select 1 from cron.job where jobname = 'federation-sync');
select cron.schedule('federation-sync', '25 4 * * *',
  $cron$select public.sync_federations();$cron$);
