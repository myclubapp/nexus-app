-- ============================================================================
-- 0045_notification_settings: Benachrichtigungen einstellen (UC-028)
--
-- Seit UC-015 steht in jedem Plan derselbe offene Punkt: Push fehlt. Dieser
-- Use Case ist der Ort dafür – und zugleich der Ort, an dem sich zeigt, dass
-- er sich nicht vollständig schliessen lässt: Der Transport verlangt
-- APNs-Schlüssel, einen betriebenen ntfy-Dienst und ein VAPID-Paar.
--
-- Was sich vollständig bauen lässt, ist alles davor. Und es wird **wirksam**:
-- Eine Einstellung, die nur gespeichert wird und nirgends greift, ist Zierde.
-- `notify()` wertet sie deshalb beim Entstehen jeder Benachrichtigung aus und
-- hält das Ergebnis an der Zeile fest. Der spätere Versand holt nur noch die
-- Zeilen mit `push_wanted` ab.
--
-- BR-117 bleibt dabei unantastbar: Die Zeile entsteht **immer**. Abwählbar ist
-- allein der Push-Vermerk.
-- ============================================================================

create table if not exists notification_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  -- Je Kategorie ein Wahrheitswert. Fehlt eine, gilt sie als erlaubt: Eine
  -- neue Kategorie soll nicht stillschweigend stummgeschaltet sein.
  push        jsonb not null default '{}'::jsonb,
  -- A3: das tägliche Fenster. Beide leer heisst «keine stille Zeit».
  quiet_from  time,
  quiet_to    time,
  updated_at  timestamptz not null default now()
);

alter table notification_settings enable row level security;

drop policy if exists notification_settings_own on notification_settings;
create policy notification_settings_own on notification_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Der Vermerk an der Zeile. `push_wanted` sagt, ob **zugestellt werden darf**;
-- `push_after` hält den Zeitpunkt fest, ab dem eine in stiller Zeit
-- entstandene Nachricht nachgeholt werden darf (A3).
alter table notifications add column if not exists push_wanted boolean not null default true;
alter table notifications add column if not exists push_after timestamptz;
alter table notifications add column if not exists push_sent_at timestamptz;

-- Der Index, den der spätere Versand braucht: die offenen Push-Zeilen.
create index if not exists notifications_push_pending_idx
  on notifications (push_after nulls first)
  where push_wanted and push_sent_at is null;

-- ---------------------------------------------------------------------------
-- Die Auswertung. Eine eigene Funktion, weil `notify()` sie braucht und die
-- Prüfung sie einzeln messen können soll.
--
-- Rückgabe: `null` heisst «zustellen, sofort». Ein Zeitstempel heisst
-- «zustellen, aber erst dann». `false` in `wanted` heisst «gar nicht».
-- ---------------------------------------------------------------------------
create or replace function public.push_decision(
  p_user_id  uuid,
  p_category text,
  p_at       timestamptz default now()
)
returns table (wanted boolean, after_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings notification_settings;
  v_local    time;
  v_quiet    boolean := false;
begin
  select * into v_settings from notification_settings where user_id = p_user_id;

  -- Ohne Einstellungen gilt alles als erlaubt: Wer nichts gesagt hat, hat
  -- nicht «nein» gesagt.
  if not found then
    return query select true, null::timestamptz;
    return;
  end if;

  -- BR-118: je Kategorie. Eine Kategorie, die nicht dasteht, ist erlaubt –
  -- sonst wäre jede neue Kategorie stillschweigend stummgeschaltet.
  if v_settings.push ? p_category
     and not coalesce((v_settings.push->>p_category)::boolean, true) then
    return query select false, null::timestamptz;
    return;
  end if;

  -- A3: die stille Zeit. Sie darf über Mitternacht gehen – dann ist das
  -- Fenster die Vereinigung von «ab from» und «bis to».
  if v_settings.quiet_from is not null and v_settings.quiet_to is not null then
    v_local := (p_at at time zone 'Europe/Zurich')::time;
    if v_settings.quiet_from <= v_settings.quiet_to then
      v_quiet := v_local >= v_settings.quiet_from and v_local < v_settings.quiet_to;
    else
      v_quiet := v_local >= v_settings.quiet_from or v_local < v_settings.quiet_to;
    end if;
  end if;

  if v_quiet then
    -- Nachgeholt wird am Ende des Fensters – heute, wenn es noch kommt, sonst
    -- morgen.
    return query select true,
      (date_trunc('day', p_at at time zone 'Europe/Zurich')
        + v_settings.quiet_to
        + case when (p_at at time zone 'Europe/Zurich')::time < v_settings.quiet_to
               then interval '0 day' else interval '1 day' end
      ) at time zone 'Europe/Zurich';
    return;
  end if;

  return query select true, null::timestamptz;
end;
$$;

-- ---------------------------------------------------------------------------
-- `notify()` wertet die Entscheidung aus.
--
-- **Die Zeile entsteht immer** (BR-117). Was sich ändert, ist ausschliesslich
-- der Vermerk, ob sie auch als Push hinausgehen darf.
-- ---------------------------------------------------------------------------
create or replace function public.notify(
  p_user_id  uuid,
  p_category text,
  p_title    text,
  p_body     text default null,
  p_link     text default null,
  p_club_id  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_decision record;
begin
  select * into v_decision from push_decision(p_user_id, p_category);

  insert into notifications
    (user_id, club_id, category, title, body, link, push_wanted, push_after)
  values
    (p_user_id, p_club_id, p_category, p_title, p_body, p_link,
     v_decision.wanted, v_decision.after_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Schritte 4 bis 6: die Einstellungen setzen.
-- ---------------------------------------------------------------------------
create or replace function public.set_notification_settings(
  p_push       jsonb default null,
  p_quiet_from time default null,
  p_quiet_to   time default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Nicht angemeldet';
  end if;

  -- Ein halbes Fenster ist kein Fenster.
  if (p_quiet_from is null) <> (p_quiet_to is null) then
    raise exception 'Eine stille Zeit braucht Anfang und Ende';
  end if;

  -- `p_push = null` heisst «Kategorien unverändert lassen» – etwa, wenn nur
  -- die stillen Zeiten geändert werden.
  --
  -- Der Rückgriff muss auf den **Parameter** zeigen und nicht auf `excluded`:
  -- Dort steht bereits der eingesetzte Wert `coalesce(p_push, '{}')`, der nie
  -- null ist. Genau daran wurde beim ersten Anlauf die ganze Matrix gelöscht,
  -- sobald jemand nur eine stille Zeit setzte.
  insert into notification_settings (user_id, push, quiet_from, quiet_to, updated_at)
  values (auth.uid(), coalesce(p_push, '{}'::jsonb), p_quiet_from, p_quiet_to, now())
  on conflict (user_id) do update
     set push = coalesce(p_push, notification_settings.push),
         quiet_from = excluded.quiet_from,
         quiet_to = excluded.quiet_to,
         updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------------
-- A4: ein Gerät abmelden.
--
-- `push_tokens` steht seit `0004` und ist leer geblieben – ohne Transport gibt
-- es nichts zu registrieren. Der Weg **hinaus** gehört trotzdem hierher: Wer
-- ein Gerät verliert, soll es entfernen können, sobald es welche gibt.
-- ---------------------------------------------------------------------------
create or replace function public.forget_device(p_token_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from push_tokens where id = p_token_id and user_id = auth.uid();
  if not found then
    raise exception 'Dieses Gerät gehört nicht zu deinem Konto';
  end if;
end;
$$;

revoke execute on function public.push_decision(uuid, text, timestamptz)
  from public, anon;
grant  execute on function public.push_decision(uuid, text, timestamptz) to authenticated;

revoke execute on function public.set_notification_settings(jsonb, time, time)
  from public, anon;
grant  execute on function public.set_notification_settings(jsonb, time, time)
  to authenticated;

revoke execute on function public.forget_device(uuid) from public, anon;
grant  execute on function public.forget_device(uuid) to authenticated;
