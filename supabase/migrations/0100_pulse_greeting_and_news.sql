-- ============================================================================
-- 0100_pulse_greeting_and_news: der Puls als eigenes Blatt, mit den Beiträgen
--                               des Vereins und einem Gruss am Amt
--                               (UC-050, FR-188 bis FR-192)
--
-- **Warum 0100 und nicht 0098.** 0098 war frei (0097 und 0099 gehören zwei
-- Parallelsitzungen), und die erste Fassung dieser Migration schrieb
-- `save_office()` fort – deren jüngste Fassung steht in `0099`, also musste die
-- Nummer darüber liegen: Bei einem `db reset` läuft 0099 **nach** 0098 und
-- hätte die Erweiterung still überschrieben. Der Gruss hat inzwischen seine
-- eigene Funktion (Abschnitt 7), damit fällt dieser Zwang weg. Die Nummer
-- bleibt trotzdem oben, weil auch die neuen Spalten an `functionary_roles`
-- hängen und ein Leser die Reihenfolge nicht rückwärts lesen soll. 0098 bleibt
-- unbenutzt.
--
-- **Der Befund zuerst, weil er die Reihenfolge erklärt.** `release_pulse()`
-- aus `0044` verschickt den Puls als gewöhnliche Meldungszeile: Titel «Der
-- Vereins-Puls», Rumpf der Einleitungssatz, Verweis in die App. Per E-Mail
-- kommen die drei Abschnitte also **nie** an – nur ein Teaser. Zwei Jahre
-- Konzept über «die drei Fragen» (K2, BR-113), und im Postfach steht ein Link.
-- Aufgefallen ist es niemandem, weil es keine Vorschau gab; deshalb stehen das
-- Blatt (FR-188) und die Vorschau (FR-189) in derselben Migration.
--
-- Vier Dinge, die zusammengehören:
--
-- 1. **Der Gruss hängt am Amt** (FR-191, BR-252). `functionary_roles` bekommt
--    den Text – je Sprache, wie die Begriffe in `clubs.settings.labels`
--    (BR-148) – und die Adresse eines Porträts. Welches Amt den Puls
--    unterschreibt, sagt `clubs.settings.pulse.greetingRoleId`. Wechselt die
--    Besetzung, wechselt der Name von selbst; `club_pulses.released_by` ist
--    ausdrücklich **nicht** die Quelle – eine Unterschrift, die danach
--    wechselt, wer am Montag Zeit hatte, ist keine.
--
-- 2. **Das Porträt liegt öffentlich, und das ist eine Entscheidung**
--    (FR-192, BR-253). Profilbilder liegen nach BR-216 im privaten Bucket,
--    nur unter einer ablaufenden Signatur und nur für den Verein sichtbar.
--    Ein Postfach ist kein Verein: Die Signatur läuft ab, und die Bildproxys
--    der Anbieter holen und behalten, was sie einmal gesehen haben. Das
--    Porträt am Gruss ist deshalb ein Repräsentationsbild wie das Logo –
--    eigene Pfadart im öffentlichen Bucket, ausdrücklich hochgeladen – und
--    **nie** `club_members.avatar_url`.
--
-- 3. **Die vierte Quelle** (FR-190, BR-250, BR-251). Die vereinsweiten
--    Beiträge der letzten vierzehn Tage kommen in den **ersten** Abschnitt;
--    BR-113 bleibt unangetastet, weil eine neue **Art** entsteht und kein
--    vierter Abschnitt – dasselbe Muster, mit dem `0055` die Vorstandsantwort
--    in den zweiten Abschnitt gebracht hat. `team_id is null` ist keine
--    Vorsicht, sondern die Bedingung: Der Puls geht an alle.
--
-- 4. **Die Nutzlast** (FR-188, FR-189). `pending_mail()` reicht für eine Zeile
--    mit eigenem Blatt ein `payload` heraus; `pulse_payload()` baut es – in
--    der Sprache der Empfängerin, die `pending_mail()` kennt. Dieselbe
--    Funktion beantwortet die Vorschau, und zwar **ohne** zweite
--    Rollenprüfung: Sie ist `security invoker`, und die Policy aus `0044` gibt
--    Entwürfe nur dem Vorstand. Wer nichts sehen darf, bekommt `null`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Der Gruss am Amt.
--
-- `greeting` ist ein Objekt Sprache → Text. Leer heisst: Dieses Amt grüsst
-- nicht – und ein Blatt ohne Gruss endet nach den Abschnitten, ohne
-- Platzhalter (A1).
-- ---------------------------------------------------------------------------
alter table functionary_roles
  add column if not exists greeting           jsonb not null default '{}'::jsonb,
  add column if not exists greeting_image_url text;

alter table functionary_roles drop constraint if exists functionary_roles_greeting_check;
alter table functionary_roles add constraint functionary_roles_greeting_check
  check (jsonb_typeof(greeting) = 'object');

comment on column functionary_roles.greeting is
  'Grusstext des Amts je Sprache (FR-191), z.B. {"de":"Herzlich, …"}. Leeres '
  'Objekt heisst: Dieses Amt grüsst nicht.';

comment on column functionary_roles.greeting_image_url is
  'Öffentliche Adresse des Porträts zum Gruss (FR-192). Liegt im Bucket '
  '«club-logo» unter <club_id>/greeting/<role_id>/…, nie im privaten Bucket '
  'der Profilbilder (BR-253).';

-- ---------------------------------------------------------------------------
-- 2. Die Pfadart «greeting» im öffentlichen Bucket.
--
-- `can_write_club_media()` aus `0083` gibt jeder unbekannten Art ein `false`;
-- ohne diesen Zweig liesse sich kein Porträt hochladen. Rumpf sonst wortgleich
-- zu `0083`.
-- ---------------------------------------------------------------------------
create or replace function public.can_write_club_media(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club  uuid := path_uuid(p_name, 1);
  v_kind  text := split_part(p_name, '/', 2);
  v_third uuid := path_uuid(p_name, 3);
begin
  if v_club is null then
    return false;
  end if;

  if v_kind = 'logo' then
    return is_club_admin(v_club);
  end if;

  -- Das Porträt am Gruss: ein Zeichen des Vereins, kein Gesicht aus der
  -- Kartei. Es hängt am **Amt** (BR-253, A3) – ein Co-Präsidium hinterlegt
  -- ein gemeinsames Bild oder keines.
  if v_kind = 'greeting' then
    return v_third is not null
       and exists (select 1 from functionary_roles
                    where id = v_third and club_id = v_club)
       and is_club_admin(v_club);
  end if;

  if v_kind = 'teams' then
    return v_third is not null
       and exists (select 1 from teams where id = v_third and club_id = v_club)
       and can_plan_for_team(v_club, v_third);
  end if;

  if v_kind = 'members' then
    return v_third is not null
       and exists (select 1 from club_members where id = v_third and club_id = v_club)
       and (v_third = current_member_id(v_club) or is_club_board(v_club));
  end if;

  return false;
end;
$$;

revoke execute on function public.can_write_club_media(text) from public, anon;
grant  execute on function public.can_write_club_media(text) to authenticated;

-- Die vier Policies aus `0083` pinnen die Art des Bildes. Jetzt sind es zwei
-- erlaubte Arten – die Bedingung bleibt sonst wortgleich.
drop policy if exists club_logo_insert on storage.objects;
create policy club_logo_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) in ('logo', 'greeting')
    and can_write_club_media(name)
  );

drop policy if exists club_logo_update on storage.objects;
create policy club_logo_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) in ('logo', 'greeting')
    and can_write_club_media(name)
  )
  with check (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) in ('logo', 'greeting')
    and can_write_club_media(name)
  );

drop policy if exists club_logo_delete on storage.objects;
create policy club_logo_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'club-logo'
    and split_part(name, '/', 2) in ('logo', 'greeting')
    and can_write_club_media(name)
  );

-- `club_logo_read` bleibt, wie `0083` sie gesetzt hat: Sie prüft die Art
-- nicht, weil die Bytes eines öffentlichen Buckets ohnehin ohne RLS
-- ausgeliefert werden. Das ist bei diesem Bild Absicht (BR-253).

-- ---------------------------------------------------------------------------
-- 3. Die Nutzlast eines Pulses – für das Blatt und für die Vorschau.
--
-- **`security invoker`, und das ist der Kern.** Die Funktion liest
-- `club_pulses` unter den Rechten der Aufruferin; die Policy aus `0044` gibt
-- Entwürfe nur dem Vorstand und versendete Pulse jedem Mitglied des Vereins.
-- Wer nichts sehen darf, bekommt `null` – es braucht keine zweite
-- Rollenprüfung, und damit gibt es keine zweite, die auseinanderlaufen könnte.
-- Aufgerufen aus `pending_mail()` (`security definer`, Eigentümer) sieht sie
-- alles, was der Versand braucht.
--
-- **Sie trägt Daten, keine fertigen Sätze.** Abschnittskennungen, Titel,
-- Zeitpunkte, Namen, Amtsbezeichnung, Bildadresse. Ausformuliert wird im
-- Blatt, wo die vier Sprachen ohnehin liegen. Der Grusstext ist die Ausnahme,
-- die die Regel bestätigt: Er ist Prosa des Vereins – wie ein News-Titel –
-- und wird deshalb nach Sprache **ausgewählt**, nicht übersetzt.
--
-- `p_keep` ist die Liste der behaltenen Einträge, damit die Vorschau zeigt,
-- was die Freigabe verschicken würde, **ohne** den Entwurf anzufassen
-- (BR-249). Dieselbe Prüfung wie in `release_pulse()`: `?` auf dem Array.
-- ---------------------------------------------------------------------------
create or replace function public.pulse_payload(
  p_pulse_id uuid,
  p_locale   text  default 'de',
  p_keep     jsonb default null
)
returns jsonb
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_pulse     club_pulses;
  v_role      functionary_roles;
  v_role_id   uuid;
  v_text      text;
  v_names     jsonb;
  v_happening jsonb;
  v_working   jsonb;
  v_join      jsonb;
begin
  select * into v_pulse from club_pulses where id = p_pulse_id;
  if not found then
    -- Kein Recht oder kein Puls – für die Aufruferin dasselbe.
    return null;
  end if;

  v_happening := v_pulse.happening;
  v_working   := v_pulse.working_on;
  v_join      := v_pulse.join_in;

  if p_keep is not null then
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_happening
      from jsonb_array_elements(v_happening) e where p_keep ? (e->>'id');
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_working
      from jsonb_array_elements(v_working) e where p_keep ? (e->>'id');
    select coalesce(jsonb_agg(e), '[]'::jsonb) into v_join
      from jsonb_array_elements(v_join) e where p_keep ? (e->>'id');
  end if;

  -- Welches Amt unterschreibt (FR-191). Fehlt die Angabe, grüsst niemand.
  select nullif(c.settings->'pulse'->>'greetingRoleId', '')::uuid
    into v_role_id
    from clubs c
   where c.id = v_pulse.club_id;

  if v_role_id is not null then
    select * into v_role
      from functionary_roles r
     where r.id = v_role_id and r.club_id = v_pulse.club_id;
  end if;

  if v_role.id is not null then
    v_text := coalesce(
      nullif(trim(v_role.greeting->>p_locale), ''),
      nullif(trim(v_role.greeting->>'de'), ''),
      (select nullif(trim(value), '') from jsonb_each_text(v_role.greeting)
        where nullif(trim(value), '') is not null limit 1));

    -- Alle, die das Amt halten – auch «ad interim»: Wer es hält, grüsst.
    -- Die Reihenfolge ist die der Belegung (A3).
    select coalesce(jsonb_agg(h.display_name order by h.since nulls last, h.created_at),
                    '[]'::jsonb)
      into v_names
      from functionary_holders h
     where h.role_id = v_role.id;
  end if;

  return jsonb_build_object(
    'pulseId', v_pulse.id,
    'intro',   v_pulse.intro,
    'sections', jsonb_build_object(
      'happening',  v_happening,
      'workingOn',  v_working,
      'joinIn',     v_join
    ),
    -- Kein Amt, kein Text und keine Belegung: kein Gruss. Ein Blatt ohne
    -- Gruss endet nach den Abschnitten, ohne Platzhalter (A1).
    'greeting', case
      when v_role.id is null then null
      when v_text is null and coalesce(jsonb_array_length(v_names), 0) = 0 then null
      else jsonb_build_object(
        'text',     v_text,
        'office',   v_role.title,
        'names',    coalesce(v_names, '[]'::jsonb),
        'imageUrl', v_role.greeting_image_url)
    end
  );
end;
$$;

revoke execute on function public.pulse_payload(uuid, text, jsonb) from public, anon;
grant  execute on function public.pulse_payload(uuid, text, jsonb)
  to authenticated, service_role;

comment on function public.pulse_payload(uuid, text, jsonb) is
  'Die Nutzlast eines Pulses für Blatt und Vorschau (FR-188, FR-189). '
  '«security invoker» mit Absicht: Die Policy aus 0044 entscheidet, wer '
  'einen Entwurf sieht.';

-- ---------------------------------------------------------------------------
-- 4. Die vierte Quelle (FR-190).
--
-- Die vereinsweiten Beiträge der letzten vierzehn Tage kommen in den **ersten**
-- Abschnitt. Drei Dinge daran sind Absicht:
--
-- * **`team_id is null`** (BR-250). Der Puls geht an alle Mitglieder und kennt
--   keinen Geltungsbereich; eine Team-News darin wäre ein Leck. Dieselbe
--   Grenze zieht `0055` schon für die Vorstandsantwort.
-- * **`source in ('club','website')`**. `'board'` steht bereits im zweiten
--   Abschnitt; zweimal wäre dieselbe News zweimal im Blatt.
-- * **Die Termine bleiben vorn.** Der Abschnitt sortiert nach `at`, und
--   `published_at` einer News liegt in der Vergangenheit – sortiert man beides
--   gemeinsam, stünde der Rückblick vor dem nächsten Termin. Deshalb zwei
--   Abfragen und ein `||`: Zukunft zuerst, weil sie eine Antwort verlangt.
--
-- Dass ein Beitrag, der schon als Meldung kam, hier erneut erscheint, ist
-- Sandros Entscheid vom 15.09.2026 (BR-251): Der Puls ist der Wochenrückblick,
-- und ein Rückblick, der auslässt, was schon gemeldet wurde, ist keiner.
--
-- Rumpf sonst wortgleich zu `0094`; die Signatur bleibt zweistellig, damit der
-- Cron-Auftrag eindeutig bleibt.
-- ---------------------------------------------------------------------------
create or replace function public.compose_club_pulse(
  p_club_id   uuid default null,
  p_skip_user uuid default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club      record;
  v_happening jsonb;
  v_news      jsonb;
  v_decisions jsonb;
  v_working   jsonb;
  v_join      jsonb;
  v_pulse     uuid;
  v_person    record;
  v_count     int := 0;
begin
  for v_club in
    select c.id from clubs c where p_club_id is null or c.id = p_club_id
  loop
    -- UC-034: Ohne das Modul entsteht nichts.
    if not module_enabled(v_club.id, 'pulse') then
      continue;
    end if;

    if exists (select 1 from club_pulses
                where club_id = v_club.id and status = 'draft') then
      continue;
    end if;

    -- «Was passiert»: die Vereinstermine der kommenden vierzehn Tage.
    select coalesce(jsonb_agg(item order by item->>'at'), '[]'::jsonb)
      into v_happening
      from (
        select jsonb_build_object(
                 'kind', 'event', 'id', e.id, 'title', e.title,
                 'at', e.starts_at, 'detail', e.type) as item
          from events e
         where e.club_id = v_club.id
           and e.team_id is null
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and e.starts_at between now() and now() + interval '14 days'
         order by e.starts_at
         limit 8
      ) x;

    -- … und danach die vereinsweiten Beiträge der letzten vierzehn Tage.
    -- `url` trägt die Adresse der Website, wenn der Beitrag von dort kommt
    -- (UC-038, A7) – in der App steht er im Feed.
    select coalesce(jsonb_agg(item order by at desc), '[]'::jsonb)
      into v_news
      from (
        select jsonb_build_object(
                 'kind', 'news', 'id', n.id, 'title', n.title,
                 'at', n.published_at, 'detail', n.author,
                 'url', n.external_url) as item,
               n.published_at as at
          from news n
         where n.club_id = v_club.id
           and n.source in ('club', 'website')
           and n.team_id is null
           and not n.is_sample
           and n.published_at > now() - interval '14 days'
         order by n.published_at desc
         limit 4
      ) x;

    v_happening := v_happening || v_news;

    -- «Woran wir arbeiten»: publizierte Vorstandsantworten, dann laufende
    -- Aufgaben des ganzen Vereins.
    select coalesce(jsonb_agg(item order by at desc), '[]'::jsonb)
      into v_decisions
      from (
        select jsonb_build_object(
                 'kind', 'decision', 'id', n.id, 'title', n.title,
                 'at', n.published_at, 'detail', null) as item,
               n.published_at as at
          from news n
         where n.club_id = v_club.id
           and n.source = 'board'
           and n.team_id is null
           and not n.is_sample
           and n.published_at > now() - interval '14 days'
         order by n.published_at desc
         limit 4
      ) x;

    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_working
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item
          from tasks t
         where t.club_id = v_club.id
           and t.team_id is null
           and t.status in ('claimed','submitted')
           and not t.is_sample
         order by t.due_at nulls last
         limit 6
      ) x;

    v_working := v_decisions || v_working;

    -- «Wo du dabei sein kannst»: offene Vereinsaufgaben und unterbesetzte
    -- Schichten von Vereinsterminen.
    select coalesce(jsonb_agg(item), '[]'::jsonb)
      into v_join
      from (
        select jsonb_build_object(
                 'kind', 'task', 'id', t.id, 'title', t.title,
                 'at', t.due_at, 'detail', t.category) as item,
               t.due_at as at
          from tasks t
         where t.club_id = v_club.id
           and t.team_id is null
           and t.status = 'open'
           and not t.is_sample
           and t.max_assignees > (select count(*) from task_assignments a
                                   where a.task_id = t.id)
        union all
        select jsonb_build_object(
                 'kind', 'shift', 'id', s.id, 'title', s.title,
                 'at', s.starts_at, 'detail', e.title) as item,
               s.starts_at as at
          from event_shifts s
          join events e on e.id = s.event_id
         where e.club_id = v_club.id
           and e.team_id is null
           and e.published_at is not null
           and e.cancelled_at is null
           and not e.is_sample
           and s.starts_at > now()
           and s.needed > (select count(*) from attendance a
                            where a.shift_id = s.id
                              and a.status in ('registered','present'))
         order by at nulls last
         limit 8
      ) x;

    -- A3: nichts zu berichten.
    if jsonb_array_length(v_happening) = 0
       and jsonb_array_length(v_working) = 0
       and jsonb_array_length(v_join) = 0 then
      continue;
    end if;

    insert into club_pulses (club_id, happening, working_on, join_in)
    values (v_club.id, v_happening, v_working, v_join)
    returning id into v_pulse;

    v_count := v_count + 1;

    for v_person in
      select m.user_id from club_members m
       where m.club_id = v_club.id
         and m.role in ('admin','superadmin')
         and m.status <> 'left'
         and m.user_id is not null
         -- Wer den Entwurf selbst angestossen hat, steht bereits davor.
         and (p_skip_user is null or m.user_id <> p_skip_user)
    loop
      perform notify(
        v_person.user_id, 'pulse', 'Der Vereins-Puls liegt bereit',
        null, '/tabs/profile/pulse', v_club.id
      );
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.compose_club_pulse(uuid, uuid)
  from public, anon, authenticated;
grant  execute on function public.compose_club_pulse(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Der Versand bekommt sein Blatt (FR-188).
--
-- Eine einzige Änderung am Rumpf aus `0044`: `p_template => 'pulse'`. Damit
-- bekommt die Zeile in `send-mail` ihre **eigene** Gruppe und damit ihre eigene
-- Mail, auch wenn im selben Lauf weitere Meldungen für dieselbe Person fällig
-- sind – die ausdrückliche Ausnahme zu BR-213, die `0096` für das
-- Willkommensblatt eingeführt hat.
--
-- Titel und Rumpf bleiben, wie sie sind: Sie stehen in der Inbox. Dass sie
-- deutscher Klartext sind, ist die Lücke, die UC-049 mit FR-187 für alle 90
-- `notify()`-Aufrufe gemeinsam schliesst – nicht hier für einen.
-- ---------------------------------------------------------------------------
create or replace function public.release_pulse(
  p_pulse_id uuid,
  p_intro    text default null,
  p_keep     jsonb default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pulse  club_pulses;
  v_person record;
  v_count  int := 0;
  v_intro  text;
begin
  select * into v_pulse from club_pulses where id = p_pulse_id for update;
  if not found then
    raise exception 'Puls nicht gefunden';
  end if;

  if not is_club_admin(v_pulse.club_id) then
    raise exception 'Nur der Vorstand gibt den Puls frei';
  end if;

  if v_pulse.status <> 'draft' then
    return 0;
  end if;

  v_intro := nullif(trim(p_intro), '');

  -- Gestrichene Einträge fallen weg. `p_keep` ist eine Liste von Ids; fehlt
  -- sie, bleibt alles stehen.
  if p_keep is not null then
    update club_pulses
       set happening = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(happening) e
              where p_keep ? (e->>'id')),
           working_on = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(working_on) e
              where p_keep ? (e->>'id')),
           join_in = (
             select coalesce(jsonb_agg(e), '[]'::jsonb) from jsonb_array_elements(join_in) e
              where p_keep ? (e->>'id'))
     where id = p_pulse_id;
    select * into v_pulse from club_pulses where id = p_pulse_id;
  end if;

  update club_pulses
     set status = 'sent',
         sent_at = now(),
         intro = v_intro,
         released_by = current_member_id(v_pulse.club_id)
   where id = p_pulse_id;

  -- Schritt 7: an **alle** Mitglieder – der Puls kennt keinen Geltungsbereich.
  for v_person in
    select m.user_id from club_members m
     where m.club_id = v_pulse.club_id
       and m.status <> 'left'
       and m.user_id is not null
  loop
    perform notify(
      p_user_id  => v_person.user_id,
      p_category => 'pulse',
      p_title    => 'Der Vereins-Puls',
      p_body     => coalesce(v_intro, 'Was passiert, woran wir arbeiten, wo du dabei sein kannst.'),
      p_link     => '/tabs/pulse/' || p_pulse_id,
      p_club_id  => v_pulse.club_id,
      p_template => 'pulse'
    );
    v_count := v_count + 1;
  end loop;

  -- BR-116: Der Puls ist die Verbindungs-Routine. Dieser Eintrag ist es, der
  -- die sanfte Sperre aus UC-011 löst.
  perform log_club_message(v_pulse.club_id, 'connection', 'pulse');

  return v_count;
end;
$$;

revoke execute on function public.release_pulse(uuid, text, jsonb) from public, anon;
grant  execute on function public.release_pulse(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. `pending_mail()` reicht die Nutzlast heraus.
--
-- Eine Spalte mehr, gefüllt **nur** für Zeilen mit eigenem Blatt. Der
-- Rückgabetyp ändert sich damit, also muss die Funktion fallen und neu
-- entstehen; Rumpf sonst wortgleich zu `0096`.
--
-- **Die Nutzlast entsteht beim Abholen, nicht beim Anlegen der Zeile.** Das
-- ist der Grund, warum die Sprache stimmt: Zwischen dem Entstehen einer
-- Meldung und ihrem Versand liegen bei `email_mode = 'weekly'` bis zu sieben
-- Tage. Wer in dieser Zeit die Sprache wechselt, bekommt den Gruss in der
-- neuen – und nicht ein deutsches Blatt mit französischem Kopfband.
--
-- Die Id des Pulses steckt im Verweis (`/tabs/pulse/<uuid>`). Sie wird gegen
-- die Form geprüft und nicht geglaubt; steht dort etwas anderes, bleibt die
-- Nutzlast leer und das Blatt fällt auf die Meldungsliste zurück.
-- ---------------------------------------------------------------------------
drop function if exists public.pending_mail(int);

create or replace function public.pending_mail(p_user_limit int default 50)
returns table (
  id            uuid,
  user_id       uuid,
  email         text,
  locale        text,
  email_mode    text,
  display_name  text,
  club_id       uuid,
  club_name     text,
  club_color    text,
  club_logo     text,
  club_why      text,
  category      text,
  title         text,
  body          text,
  link          text,
  why           text,
  mail_template text,
  payload       jsonb,
  created_at    timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Konten ohne Adresse: kein Versand, kein weiterer Versuch.
  update notifications n
     set email_wanted = false,
         email_error  = 'Konto ohne E-Mail-Adresse'
    from auth.users u
   where u.id = n.user_id
     and u.email is null
     and n.email_wanted and n.email_sent_at is null;

  return query
  with due_users as (
    select distinct n.user_id
      from notifications n
     where n.email_wanted and n.email_sent_at is null and n.email_attempts < 5
       and (n.email_after is null or n.email_after <= now())
       and (n.email_claimed_at is null
            or n.email_claimed_at < now() - interval '10 minutes')
     limit p_user_limit
  ),
  claimed as (
    update notifications n
       set email_claimed_at = now(),
           email_attempts   = n.email_attempts + 1
      from due_users d
     where n.user_id = d.user_id
       and n.email_wanted and n.email_sent_at is null and n.email_attempts < 5
       and (n.email_after is null or n.email_after <= now())
       and (n.email_claimed_at is null
            or n.email_claimed_at < now() - interval '10 minutes')
    returning n.id, n.user_id, n.club_id, n.category, n.title, n.body, n.link,
              n.why, n.mail_template, n.created_at
  )
  select c.id, c.user_id, u.email::text, s.locale, coalesce(s.email_mode, 'daily'),
         m.display_name, c.club_id, cl.name, cl.settings->'theme'->>'primary',
         cl.settings->>'logoUrl', cl.settings->'dna'->>'why',
         c.category, c.title, c.body, c.link, c.why, c.mail_template,
         case
           when c.mail_template = 'pulse'
                and c.link ~ '^/tabs/pulse/[0-9a-fA-F-]{36}$'
           then pulse_payload(substring(c.link from 13)::uuid,
                              coalesce(s.locale, 'de'))
         end,
         c.created_at
    from claimed c
    join auth.users u on u.id = c.user_id
    left join notification_settings s on s.user_id = c.user_id
    left join clubs cl on cl.id = c.club_id
    left join lateral (
      select cm.display_name from club_members cm
       where cm.user_id = c.user_id
         and (c.club_id is null or cm.club_id = c.club_id)
       order by cm.member_since limit 1
    ) m on true
   order by c.user_id, c.created_at;
end;
$$;

revoke execute on function public.pending_mail(int) from public, anon, authenticated;
grant  execute on function public.pending_mail(int) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Der Gruss wird geschrieben – über seine **eigene** Funktion.
--
-- Nicht als Parameter an `save_office()`, und zwar aus demselben Grund, aus
-- dem `0091` den Punktwert herausgenommen hat (BR-206): Ein Formular, das den
-- Wert nicht kennt, würde ihn bei jedem Speichern stillschweigend löschen.
--
-- Bei `save_office()` wäre es sogar schlimmer als ein verlorener Wert. Dort
-- heisst `p_holders` mit Vorgabe `'[]'` **«keine Sitze»**, und der Rumpf löscht
-- am Ende, was nicht in der Liste steht: Ein Aufruf, der nur den Gruss setzen
-- wollte, hätte die ganze Belegung des Amtes gelöscht. Eine Funktion, die
-- eine Spalte setzt, setzt eine Spalte.
--
-- Die Rollenprüfung steht hier und nicht im Client (CLAUDE.md), und die
-- Bildadresse wird geprüft, nicht geglaubt (BR-253, BR-242): `https:` oder
-- nichts.
-- ---------------------------------------------------------------------------
create or replace function public.set_office_greeting(
  p_role_id  uuid,
  p_greeting jsonb default null,
  p_image    text  default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid;
begin
  select club_id into v_club from functionary_roles where id = p_role_id;
  if v_club is null then
    raise exception 'Dieses Amt gibt es nicht';
  end if;
  if not is_club_admin(v_club) then
    raise exception 'Nur der Vorstand schreibt den Gruss eines Amtes';
  end if;
  if p_greeting is not null and jsonb_typeof(p_greeting) <> 'object' then
    raise exception 'Der Gruss ist ein Objekt Sprache → Text';
  end if;
  if p_image is not null and trim(p_image) <> ''
     and trim(p_image) not like 'https://%' then
    raise exception 'Das Porträt braucht eine https-Adresse';
  end if;

  update functionary_roles
     -- `null` heisst «unverändert», das leere Objekt «grüsst nicht mehr»,
     -- die leere Zeichenkette «kein Porträt mehr».
     set greeting = coalesce(p_greeting, greeting),
         greeting_image_url = case
                                when p_image is null then greeting_image_url
                                when trim(p_image) = '' then null
                                else trim(p_image)
                              end
   where id = p_role_id;
end;
$$;

revoke execute on function public.set_office_greeting(uuid, jsonb, text) from public, anon;
grant  execute on function public.set_office_greeting(uuid, jsonb, text) to authenticated;

comment on function public.set_office_greeting(uuid, jsonb, text) is
  'Grusstext und Porträt eines Amtes setzen (FR-191, FR-192). Eigene Funktion '
  'statt Parameter an save_office(), damit ein Formular ohne diese Felder '
  'weder den Gruss noch die Belegung löscht.';
