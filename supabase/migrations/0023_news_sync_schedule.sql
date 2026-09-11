-- ============================================================================
-- 0023_news_sync_schedule: Täglicher Abgleich der Website-News (UC-038)
--
-- Gegenstück zu `updatePersistenceJobNews()` im alten Backend: Der Import ist
-- nichts, was der Vorstand von Hand anstossen soll. Eine Meldung, die auf der
-- Vereinswebsite steht, gehört am nächsten Morgen im Feed – sonst ist der
-- Anschluss ein einmaliger Umzug statt einer Verbindung (BR-155).
--
-- Der Weg ist pg_cron -> pg_net -> Edge Function. Der Abruf bleibt damit an
-- der einen Stelle, die ihn beherrscht; Postgres stösst ihn nur an.
-- ============================================================================

-- pg_cron ist nicht verschiebbar und legt immer das Schema `cron` an.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Den Abgleich für alle aktiven Quellen anstossen.
--
-- Projekt-URL und Service-Role-Key stehen im Vault und nicht im Klartext in
-- dieser Datei: Migrationen liegen im Repository, ein Schlüssel darf das nicht.
-- Fehlen sie, tut die Funktion nichts und sagt warum – ein Job, der jede Nacht
-- mit einem Fehler abbricht, wird nach zwei Wochen ignoriert.
--
-- Einmalige Einrichtung (Werte aus den Projekteinstellungen):
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service-role-key>',        'service_role_key');
-- ---------------------------------------------------------------------------
create or replace function public.sync_news_sources()
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
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'service_role_key';

  if v_project_url is null or v_service_key is null then
    raise warning 'sync_news_sources: vault-Geheimnisse project_url und service_role_key fehlen – kein Abgleich';
    return null;
  end if;

  if not exists (select 1 from news_sources where active) then
    return null;
  end if;

  select net.http_post(
    url     := v_project_url || '/functions/v1/import-wordpress-news',
    body    := jsonb_build_object('mode', 'all'),
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_key
               ),
    -- Ein Verein mit langsamer Website darf die übrigen nicht mitreissen; die
    -- Function nimmt sich innen ihre eigenen Zeitlimits pro Quelle.
    timeout_milliseconds := 120000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- Eine neue security-definer-Funktion ist sofort ein offener Endpunkt: Ohne
-- den Entzug hinge sie unter /rest/v1/rpc/ und jede angemeldete Person könnte
-- den Abgleich beliebig oft auslösen (CLAUDE.md, NFR-013).
revoke execute on function public.sync_news_sources()
  from public, anon, authenticated;
grant execute on function public.sync_news_sources() to service_role;

-- Nachts um 04:20 UTC: Die Websites der Vereine sind dann unbelastet, und der
-- Feed steht am Morgen. `cron.schedule` ist über den Namen idempotent – ein
-- erneutes Deployment legt keinen zweiten Job an.
select cron.schedule(
  'news-website-sync',
  '20 4 * * *',
  $job$select public.sync_news_sources()$job$
);
