-- ============================================================================
-- 0104_push_transport: Der Versand (UC-052, FR-199)
--
-- Seit `0045` trägt jede Meldung den Vermerk `push_wanted`, und seit `0045`
-- holt ihn niemand ab. `push_tokens` steht seit `0004` und blieb leer, weil
-- es nichts zu empfangen gab. Diese Migration schliesst FR-079 – den einzigen
-- offenen Punkt, der in jedem Plan seit UC-015 wiederkehrt.
--
-- **Der Aufbau ist der des Mailkanals** (`0084`), absichtlich Zeile für Zeile:
-- ein Abholer für `service_role`, eine Quittung, ein Fehlerweg mit Versuchen
-- und Sperre, ein `pg_cron`-Lauf, der die Edge Function über `pg_net` anstösst
-- und sie nicht bemüht, wenn nichts fällig ist. Wer den Mailkanal versteht,
-- versteht diesen hier; wer einen dritten Kanal baut, kopiert dieselbe Form.
--
-- **Ein Unterschied zum Mailkanal, und er trägt alles:** Eine Mail geht an
-- eine Person, ein Push geht an ein **Gerät**. Eine Meldung wird deshalb
-- einmal geführt und mehrfach zugestellt – der Abholer gibt je Gerät eine
-- Zeile heraus, die Quittung zählt aber die Meldung. Zugestellt heisst: **auf
-- mindestens einem Gerät angekommen**. Eine Meldung, die auf dem Telefon
-- ankommt und auf dem alten Tablet scheitert, ist zugestellt.
--
-- **BR-117 bleibt unangetastet.** Die Zeile in `notifications` entsteht immer
-- und unabhängig von jedem Kanal; die Inbox ist der vollständige Rückfall.
-- Wer kein Gerät angemeldet hat, verliert nichts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Die Geräte.
--
-- `environment` betrifft allein APNs und ist der teuerste Stolperstein des
-- Apple-Wegs: Ein Token aus einem Xcode-Build gilt nur an
-- `api.sandbox.push.apple.com`, eines aus TestFlight oder dem Store nur an
-- `api.push.apple.com`. Dasselbe Token am falschen Tor beantwortet Apple mit
-- `BadDeviceToken` – ununterscheidbar von einem wirklich ungültigen Token.
--
-- Die App kann die Frage nicht beantworten: Ein WebView weiss nicht, mit
-- welchem Profil er signiert wurde. Deshalb steht hier `null` für «noch nicht
-- bekannt», und der Versand beantwortet sie **selbst** – er versucht die
-- Produktion, und wenn Apple `BadDeviceToken` sagt, die Sandbox; was
-- funktioniert hat, schreibt er zurück (`set_push_environment`). Der Preis
-- ist eine überflüssige Anfrage je Gerät, einmal.
-- ---------------------------------------------------------------------------
alter table push_tokens
  add column if not exists environment text
    check (environment in ('sandbox', 'production')),
  -- Wann sich dieses Gerät zuletzt angemeldet hat. Die Anmeldung erneuert die
  -- Zeile (`on conflict (token)`), und ohne diese Spalte sähe eine erneuerte
  -- Zeile aus wie eine ein Jahr alte.
  add column if not exists last_seen_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Den Zeitstempel setzt der Server, nicht die App.
--
-- Die App könnte ihn mitschicken; dann stünde in der Zeile aber, was die Uhr
-- des Geräts behauptet. Ein Trigger ist hier ausserdem der kürzere Weg: Der
-- Client stösst die Anmeldung als `upsert` an, und ein `upsert` erneuert nur
-- die Spalten, die er selbst mitbringt.
--
-- **Die Ausnahme ist der Versand.** Wenn `set_push_environment()` lernt, an
-- welchem Apple-Tor ein Token gilt, hat sich das Gerät nicht gemeldet – es
-- wurde etwas über es herausgefunden. Diese Änderung darf «zuletzt gesehen»
-- nicht verschieben, sonst sähe ein totes Gerät, an das der Versand einmal
-- täglich vergeblich schickt, für immer frisch aus.
-- ---------------------------------------------------------------------------
create or replace function public.touch_push_token()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE'
     and new.token = old.token
     and new.user_id = old.user_id
     and new.platform = old.platform
     and new.environment is distinct from old.environment then
    return new;
  end if;

  new.last_seen_at := now();
  return new;
end;
$$;

drop trigger if exists push_tokens_touch on push_tokens;
create trigger push_tokens_touch
  before insert or update on push_tokens
  for each row
  execute function public.touch_push_token();

-- Rechte entziehen, nicht vergeben: Postgres prüft `execute` auf eine
-- Triggerfunktion beim Anlegen des Triggers. Ein Grant hängte sie zusätzlich
-- als Endpunkt unter `/rest/v1/rpc/` (Vorlage: `0085`).
revoke execute on function public.touch_push_token() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Die Meldung, um das ergänzt, was ein Versand braucht, der scheitern kann:
-- Versuche, Fehler, Sperre. Wortgleich zu den Mail-Spalten aus `0084`.
-- ---------------------------------------------------------------------------
alter table notifications
  add column if not exists push_attempts   smallint not null default 0,
  add column if not exists push_claimed_at timestamptz,
  add column if not exists push_error      text;

-- Der Index aus `0045` kannte die Versuche noch nicht; ohne sie liest der
-- Abholer bei jedem Lauf die aufgegebenen Zeilen mit.
drop index if exists notifications_push_pending_idx;
create index if not exists notifications_push_pending_idx
  on notifications (push_after nulls first)
  where push_wanted and push_sent_at is null and push_attempts < 5;

-- ---------------------------------------------------------------------------
-- Der Abholer. Nur die Edge Function ruft ihn (`service_role`).
--
-- Er gibt **je Gerät eine Zeile** heraus und sperrt dabei die Meldung, nicht
-- das Gerät: Zwei Läufe sollen dieselbe Meldung nicht doppelt zustellen, und
-- dass zwei Meldungen an dasselbe Telefon gehen, ist der Normalfall.
--
-- Konten **ohne angemeldetes Gerät** werden ausgetragen statt fünf Mal
-- versucht – und das ist mehr als Sparsamkeit: Ohne diese Zeile stünde für
-- jedes Konto, das nie ein Gerät angemeldet hat, ein Rückstand aus Wochen
-- bereit, der beim ersten `register()` auf einen Schlag herausginge. Wer sein
-- erstes Gerät anmeldet, soll die nächste Meldung bekommen, nicht die letzten
-- zweihundert.
-- ---------------------------------------------------------------------------
create or replace function public.pending_push(
  p_limit     int      default 200,
  -- Welche Kanäle der Versand **heute** bedienen kann. `null` heisst alle.
  --
  -- Ohne diese Einschränkung sperrte der Abholer eine Meldung, bevor
  -- feststeht, ob sie überhaupt zustellbar ist: Solange der APNs-Schlüssel
  -- fehlt, verbrauchte jede Meldung an ein iPhone ihre fünf Versuche und wäre
  -- aufgegeben, bevor der Schlüssel da ist. Der Versand nennt deshalb, was er
  -- kann, und bekommt nur, was er kann.
  p_platforms text[]   default null
)
returns table (
  id           uuid,
  user_id      uuid,
  token_id     uuid,
  token        text,
  platform     text,
  environment  text,
  category     text,
  title        text,
  body         text,
  link         text,
  created_at   timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update notifications n
     set push_wanted = false,
         push_error  = 'Kein Gerät angemeldet'
   where n.push_wanted and n.push_sent_at is null
     and (n.push_after is null or n.push_after <= now())
     and not exists (select 1 from push_tokens p where p.user_id = n.user_id);

  return query
  with due as (
    select n.id
      from notifications n
     where n.push_wanted and n.push_sent_at is null and n.push_attempts < 5
       and (n.push_after is null or n.push_after <= now())
       and (n.push_claimed_at is null
            or n.push_claimed_at < now() - interval '10 minutes')
       -- Nur was zustellbar ist, wird gesperrt.
       and exists (
         select 1 from push_tokens p
          where p.user_id = n.user_id
            and (p_platforms is null or p.platform = any(p_platforms))
       )
     order by n.push_after nulls first, n.created_at
     limit p_limit
  ),
  claimed as (
    update notifications n
       set push_claimed_at = now(),
           push_attempts   = n.push_attempts + 1
      from due d
     where n.id = d.id
    returning n.id, n.user_id, n.category, n.title, n.body, n.link, n.created_at
  )
  select c.id, c.user_id, p.id, p.token, p.platform, p.environment,
         c.category, c.title, c.body, c.link, c.created_at
    from claimed c
    join push_tokens p on p.user_id = c.user_id
                      and (p_platforms is null or p.platform = any(p_platforms))
   order by c.created_at;
end;
$$;

-- Zugestellt heisst: auf mindestens einem Gerät angekommen.
create or replace function public.mark_push_sent(p_ids uuid[])
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update notifications
     set push_sent_at = now(), push_error = null
   where id = any(p_ids) and push_sent_at is null;
$$;

-- Gescheitert heisst: auf **keinem** Gerät angekommen. Die Sperre fällt, der
-- nächste Lauf versucht es erneut – bis zum fünften Mal.
create or replace function public.mark_push_failed(p_ids uuid[], p_error text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update notifications
     set push_error = left(p_error, 500), push_claimed_at = null
   where id = any(p_ids) and push_sent_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Ein Gerät, das der Dienst nicht mehr kennt, ist weg (BR-269).
--
-- Apple antwortet `410 Unregistered`, ein Web-Push-Dienst `404` oder `410`:
-- Die App ist deinstalliert, das Abonnement widerrufen, der Browser hat es
-- verworfen. Die Zeile stehen zu lassen hiesse, bei jeder Meldung erneut
-- dorthin zu schicken – und die Geräteliste im Profil zeigte ein Gerät, das
-- es nicht mehr gibt.
--
-- Eigene Funktion statt `forget_device()`: Die gehört der Person (`auth.uid()`),
-- diese hier dem Dienst. Zwei Vertrauensgrade, zwei Funktionen.
-- ---------------------------------------------------------------------------
create or replace function public.drop_push_token(p_token_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from push_tokens where id = p_token_id;
$$;

-- Was der Versand über ein Apple-Gerät gelernt hat, behält er.
create or replace function public.set_push_environment(
  p_token_id   uuid,
  p_environment text
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update push_tokens
     set environment = p_environment
   where id = p_token_id
     and p_environment in ('sandbox', 'production');
$$;

revoke execute on function public.pending_push(int, text[])      from public, anon, authenticated;
revoke execute on function public.mark_push_sent(uuid[])         from public, anon, authenticated;
revoke execute on function public.mark_push_failed(uuid[], text) from public, anon, authenticated;
revoke execute on function public.drop_push_token(uuid)          from public, anon, authenticated;
revoke execute on function public.set_push_environment(uuid, text) from public, anon, authenticated;
grant  execute on function public.pending_push(int, text[])      to service_role;
grant  execute on function public.mark_push_sent(uuid[])         to service_role;
grant  execute on function public.mark_push_failed(uuid[], text) to service_role;
grant  execute on function public.drop_push_token(uuid)          to service_role;
grant  execute on function public.set_push_environment(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Der Anstoss: pg_cron -> pg_net -> Edge Function `push-send`. Aufbau und
-- Wortlaut wie `send_pending_mail()` in `0084`.
--
-- **Jede Minute, nicht alle fünf.** Ein Push ist der Kanal, der zur Meldung
-- gehört, nicht zur Zusammenfassung: «Das Training fällt aus» eine Viertel-
-- stunde später ist eine andere Nachricht. Gibt es nichts Fälliges, kostet der
-- Lauf eine Indexabfrage und ruft die Function nicht.
-- ---------------------------------------------------------------------------
create or replace function public.send_pending_push()
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
  if not exists (
    select 1 from notifications n
     where n.push_wanted and n.push_sent_at is null and n.push_attempts < 5
       and (n.push_after is null or n.push_after <= now())
       and (n.push_claimed_at is null
            or n.push_claimed_at < now() - interval '10 minutes')
  ) then
    return null;
  end if;

  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'send_pending_push: vault-Geheimnisse project_url und service_role_key fehlen – kein Versand';
    return null;
  end if;

  select net.http_post(
    url     := v_project_url || '/functions/v1/push-send',
    body    := jsonb_build_object('mode', 'run'),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.send_pending_push()
  from public, anon, authenticated;
grant execute on function public.send_pending_push() to service_role;

select cron.schedule(
  'push-send',
  '* * * * *',
  $job$select public.send_pending_push()$job$
);
