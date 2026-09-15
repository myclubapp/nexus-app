-- ============================================================================
-- 0096_club_mail_and_why: Der Verein als Absender, das Warum als Inhalt und
--                         die Begrüssung (FR-182, FR-183, FR-184, UC-048)
--
-- Drei Lücken, die zusammengehören, weil sie dieselbe Zeile betreffen.
--
-- **Erstens die Gestaltung (FR-182).** Die Meldungsmail kannte seit `0084` die
-- Vereinsfarbe, aber kein Logo; die Rechnungsmail kannte gar nichts; die
-- Anmeldemail kam aus der Vorlage von GoTrue. Drei Absender für einen Verein.
-- `pending_mail()` reicht ab hier auch Logo und Vereins-Warum heraus, und
-- `mail_brand()` gibt der Anmeldemail dieselben Angaben – sie entsteht in
-- einer Edge Function, die zu diesem Zeitpunkt nur eine Adresse kennt.
--
-- **Zweitens das Warum (FR-183, BR-239).** Eine Meldung, die sagt «Kommst
-- du?», ist eine Aufforderung. Eine Meldung, die dazu sagt, warum die Antwort
-- gebraucht wird, ist eine Information. Bisher gab es dafür keinen Platz:
-- `notify()` kannte Titel, Rumpf und Verweis, und wer ein Warum mitgeben
-- wollte, schrieb es in den Rumpf – wo es aussah wie der Inhalt selbst.
--
-- Ab hier trägt jede Zeile ein eigenes Feld dafür. Es bleibt **freiwillig**:
-- Fehlt es, setzt die Darstellung den Standardsatz der Kategorie ein (in der
-- App `notifications.why.*`, in der Mail `send-mail/template.ts`). Der Satz
-- der Kategorie ist bei Erinnerungen sogar der bessere – «der Verein plant mit
-- deiner Antwort» erklärt die Zustellung, während das `why` eines Termins
-- dessen Zweck erklärt und in der Agenda steht. Das Feld ist für die Fälle da,
-- in denen der Auslöser mehr weiss als die Kategorie: die Aufgabe, das Amt,
-- die Rechnung.
--
-- Was hier **nicht** geschieht: die 98 bestehenden `notify()`-Aufrufe
-- umschreiben. Sie bekommen den Standardsatz ihrer Kategorie und sind damit
-- vollständig; drei davon – die Rechnungserinnerungen – wissen mehr und sagen
-- es unten. Die Termin-, Aufgaben- und Schicht-Aufrufe liegen zurzeit in
-- parallelen Strängen (`0091`, `0095`) und werden dort und nicht hier
-- fortgeschrieben.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Die zwei Felder.
-- ---------------------------------------------------------------------------
alter table notifications
  add column if not exists why           text,
  add column if not exists mail_template text;

comment on column notifications.why is
  'Warum diese Meldung kommt und was sie bewirkt (FR-183). Leer heisst: Die '
  'Darstellung setzt den Standardsatz der Kategorie ein.';

comment on column notifications.mail_template is
  'Ein eigenes Blatt im Postfach statt der Meldungsliste (FR-184), z.B. '
  '«welcome». Leer heisst: die gewohnte Liste.';

-- Die Prüfung aus BR-240 läuft bei jedem Beitritt. Der Index ist schmal – es
-- gibt je Person und Verein höchstens eine solche Zeile. **Nicht** `unique`:
-- Ein Konflikt würde die Ausnahme in `redeem_invite()` tragen und aus einer
-- doppelten Begrüssung einen gescheiterten Beitritt machen.
create index if not exists notifications_welcome_idx
  on notifications (user_id, club_id)
  where mail_template = 'welcome';

-- ---------------------------------------------------------------------------
-- 2. `notify()` mit dem Warum und dem Blatt als achtem und neuntem Parameter.
--
-- Die alte Signatur muss weg, sonst stehen zwei Funktionen nebeneinander und
-- jeder positionale Aufruf mit sieben Argumenten ist nicht mehr eindeutig.
-- Alle bestehenden Aufrufer bleiben gültig – beide Parameter haben eine
-- Vorgabe. Rumpf sonst wortgleich zu `0084`.
--
-- `p_template` bleibt der **einzige** Weg zu einem eigenen Blatt: Ein zweiter
-- Einfügepfad in `notifications` müsste die Entscheidungen aus
-- `push_decision()` und `email_decision()` abschreiben, und zwei Abschriften
-- laufen auseinander.
-- ---------------------------------------------------------------------------
drop function if exists public.notify(uuid, text, text, text, text, uuid, boolean);

create or replace function public.notify(
  p_user_id  uuid,
  p_category text,
  p_title    text,
  p_body     text default null,
  p_link     text default null,
  p_club_id  uuid default null,
  p_urgent   boolean default false,
  p_why      text default null,
  p_template text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_push  record;
  v_email record;
begin
  select * into v_push  from push_decision(p_user_id, p_category);
  select * into v_email from email_decision(p_user_id, p_category, p_urgent);

  insert into notifications
    (user_id, club_id, category, title, body, link, why, mail_template,
     push_wanted, push_after, email_wanted, email_after)
  values
    (p_user_id, p_club_id, p_category, p_title, p_body, p_link,
     nullif(trim(coalesce(p_why, '')), ''),
     nullif(trim(coalesce(p_template, '')), ''),
     v_push.wanted, v_push.after_at, v_email.wanted, v_email.after_at);
end;
$$;

revoke execute on function public.notify(uuid, text, text, text, text, uuid, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.notify(uuid, text, text, text, text, uuid, boolean, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3. Die Marke für die Anmeldemail (FR-182).
--
-- Der Hook «Send Email» bekommt von GoTrue nur Anlass, Person und Token. Wer
-- sich zum ersten Mal anmeldet, ist noch in keinem Verein – dann zählt der
-- Einladungscode, den die App bei der Anmeldung mitgibt. Er ist **Eingabe**
-- und wird hier gegen `invites` geprüft, nicht geglaubt: Ein erfundener Code
-- ergibt keinen Verein, nicht einen fremden.
--
-- Reihenfolge: die Einladung vor der Mitgliedschaft. Wer eingeladen wird,
-- bekommt den Link zu **diesem** Verein, auch wenn er schon in einem anderen
-- ist.
--
-- Gibt immer genau eine Zeile zurück, auch eine leere: Die Function darf an
-- einer fehlenden Zeile nicht scheitern – sie steht auf dem Weg zur Anmeldung.
-- ---------------------------------------------------------------------------
create or replace function public.mail_brand(
  p_user_id     uuid default null,
  p_invite_code text default null
)
returns table (club_name text, club_color text, club_logo text, locale text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_club clubs;
begin
  -- Die Bedingung steht **in** der Abfrage und nicht in einem `if` darum: So
  -- läuft das `into` in jedem Fall und weist `v_club` zu – notfalls eine Zeile
  -- aus lauter null. Eine Zeilenvariable, die nie zugewiesen wurde, ist eine
  -- Stolperstelle, die sich hier ohne Kosten vermeiden lässt.
  select c.* into v_club
    from invites i
    join clubs c on c.id = i.club_id
   where p_invite_code is not null
     and i.code = lower(trim(p_invite_code))
     and i.revoked_at is null
     and i.expires_at > now()
     and i.uses < i.max_uses
   limit 1;

  if v_club.id is null and p_user_id is not null then
    select c.* into v_club
      from club_members m
      join clubs c on c.id = m.club_id
     where m.user_id = p_user_id
       and m.status <> 'left'
     order by m.member_since desc
     limit 1;
  end if;

  return query
  select v_club.name,
         v_club.settings->'theme'->>'primary',
         v_club.settings->>'logoUrl',
         (select s.locale from notification_settings s where s.user_id = p_user_id);
end;
$$;

revoke execute on function public.mail_brand(uuid, text) from public, anon, authenticated;
grant  execute on function public.mail_brand(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Der Abholer reicht Logo, Vereins-Warum und das Warum der Zeile heraus.
--
-- `create or replace` kann den Rückgabetyp nicht ändern; die Funktion wird
-- deshalb neu angelegt und die Rechte neu gesetzt. Der Rumpf ist sonst
-- wortgleich zu `0084` – geändert sind allein die vier Spalten.
--
-- `club_why` ist das Warum des **Vereins** (`settings.dna.why`, FR-114). Es
-- steht im Willkommensblatt (`0097`) und nirgends sonst: In einer Meldung
-- wäre es jede Woche derselbe Satz.
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
         c.category, c.title, c.body, c.link, c.why, c.mail_template, c.created_at
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
-- 5. Die drei Erinnerungen, die mehr wissen als ihre Kategorie.
--
-- Eine Rechnung ist der einzige Anlass, bei dem eine Meldung Geld verlangt.
-- Sie sagt deshalb, wofür – und **ohne jede Folge einer späten Zahlung**
-- (BR-158 gilt unverändert). Rümpfe wortgleich zur jeweils jüngsten Fassung
-- (`remind_due_invoices` aus `0089`, `remind_invoice` aus `0090`); geändert
-- ist allein das Warum als achtes Argument.
--
-- `remind_due_invoices` bekommt dabei einen Rumpf, der eine Rechnung
-- beschreibt: Bisher stand dort `v_row.points::text` – die Punktzahl für
-- pünktliches Zahlen, als blosse Zahl und ohne Wort darum. In der Inbox las
-- sich das als «Eine Rechnung wird nächste Woche fällig / 30».
-- ---------------------------------------------------------------------------
create or replace function public.remind_due_invoices()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row   record;
  v_count int := 0;
begin
  for v_row in
    select i.id, i.club_id, i.due_date, m.user_id,
           coalesce((select r.points from point_rules r
                      where r.club_id = i.club_id and r.code = 'invoice_on_time'), 0)
             as points
      from invoice_refs i
      join club_members m on m.id = i.member_id
     where i.status = 'open'
       and i.due_date = current_date + 7
       and m.status <> 'left'
       and m.user_id is not null
       and module_enabled(i.club_id, 'invoice')
  loop
    -- Nicht zweimal zur selben Rechnung: Der Tagesvergleich oben sorgt dafür,
    -- dass dieser Fall genau an einem Tag eintritt.
    perform notify(
      v_row.user_id, 'invoice',
      'Eine Rechnung wird nächste Woche fällig',
      'Fällig am ' || to_char(v_row.due_date, 'DD.MM.YYYY') || '.',
      '/tabs/profile/invoices', v_row.club_id, false,
      case when v_row.points > 0
           then 'Die Beiträge tragen den Vereinsbetrieb. Wer rechtzeitig zahlt, '
                || 'erhält ' || v_row.points || ' Punkte für Verlässlichkeit.'
           else 'Die Beiträge tragen den Vereinsbetrieb.'
      end);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.remind_due_invoices() from public, anon, authenticated;

create or replace function public.remind_invoice(p_invoice_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
  v_club    clubs;
  v_user    uuid;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if not is_club_admin(v_invoice.club_id) then
    raise exception 'Nur der Vorstand erinnert an eine Rechnung (BR-229)';
  end if;
  if v_invoice.status <> 'sent' then
    raise exception 'Nur an eine offene Rechnung lässt sich erinnern';
  end if;

  -- BR-236: höchstens eine je Woche.
  if v_invoice.reminded_at is not null
     and v_invoice.reminded_at > now() - interval '7 days' then
    return false;
  end if;

  update invoices
     set reminded_at = now(), reminder_count = reminder_count + 1
   where id = p_invoice_id;

  select m.user_id into v_user from club_members m where m.id = v_invoice.member_id;
  select * into v_club from clubs where id = v_invoice.club_id;

  -- Ohne Konto gibt es niemanden, den die App erreicht. Die Erinnerung ist
  -- trotzdem gezählt: Die Kassier:in hat sie ausgelöst und sieht am Zähler,
  -- dass dieser Fall den Postweg braucht.
  if v_user is not null then
    perform notify(
      v_user, 'invoice',
      'Eine Rechnung ist noch offen',
      v_invoice.currency || ' ' || to_char(v_invoice.amount, 'FM999G999D00')
        || ' – fällig am ' || to_char(v_invoice.due_date, 'DD.MM.YYYY'),
      '/tabs/profile/invoices', v_invoice.club_id, false,
      'Die Beiträge tragen den Vereinsbetrieb. Ist die Zahlung schon '
        || 'unterwegs, hat sich diese Erinnerung überschnitten.');
  end if;

  return true;
end;
$$;

-- `0090` liess die Rechte, wie Postgres sie vergibt. `anon` hat an einem
-- Endpunkt, der eine Meldung auslöst, nichts zu suchen – die Prüfung
-- `is_club_admin()` im Rumpf wiese ihn ohnehin ab, aber ein offener Endpunkt
-- ist ein offener Endpunkt (CLAUDE.md).
revoke execute on function public.remind_invoice(uuid) from public, anon;
grant  execute on function public.remind_invoice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Die Begrüssung (FR-184).
--
-- **BR-240: einmal je Person und Verein.** Wer austritt und wieder beitritt,
-- bekommt kein zweites Willkommen; wer über eine Einladung beitritt, während
-- seine Beitritts-Anfrage noch offen ist, auch nicht. Der Schutz steht hier
-- und nicht in den zwei Aufrufern, sonst gäbe es ihn bald nur noch in einem.
--
-- **Dringend (BR-211).** Eine Begrüssung, die im Tagesbündel um 18:00 landet,
-- ist keine. Wer den E-Mail-Kanal ganz abgeschaltet hat, bekommt sie nicht –
-- die Einstellung steht über dem Anlass, und die Inbox enthält sie ohnehin.
--
-- Kein eigener Text je Verein: Das Blatt erklärt, wie die App funktioniert,
-- und das ist überall dasselbe. Was der Verein beisteuert, ist sein eigenes
-- Warum (`settings.dna.why`, FR-114) – `pending_mail()` reicht es oben heraus.
-- ---------------------------------------------------------------------------
create or replace function public.welcome_member(
  p_user_id uuid,
  p_club_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club clubs;
begin
  if p_user_id is null or p_club_id is null then
    return;
  end if;

  -- BR-240.
  if exists (
    select 1 from notifications
     where user_id = p_user_id
       and club_id = p_club_id
       and mail_template = 'welcome'
  ) then
    return;
  end if;

  select * into v_club from clubs where id = p_club_id;
  if v_club.id is null then
    return;
  end if;

  perform notify(
    p_user_id, 'join_request',
    'Willkommen bei ' || v_club.name,
    'Hier eine kurze Übersicht, wie der Verein die App nutzt.',
    '/tabs/dashboard', p_club_id, true,
    null::text, 'welcome');
end;
$$;

revoke execute on function public.welcome_member(uuid, uuid)
  from public, anon, authenticated;
grant  execute on function public.welcome_member(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 7. Die zwei Wege in einen Verein lösen sie aus.
--
-- Rümpfe wortgleich zur jeweils jüngsten Fassung (`redeem_invite` aus `0071`,
-- `decide_join_request` aus `0084`); geändert ist allein der Aufruf am Ende.
--
-- `redeem_invite` begrüsst nur, wenn die Mitgliedschaft **neu** entstanden ist
-- (`v_is_new`): Eine erneut eingelöste Einladung ist kein Beitritt (BR-008).
-- ---------------------------------------------------------------------------
create or replace function public.redeem_invite(
  p_code         text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user      uuid := auth.uid();
  v_invite    invites;
  v_member_id uuid;
  v_is_new    boolean := false;
  v_name      text;
  v_email     text;
begin
  if v_user is null then
    raise exception 'Nicht angemeldet';
  end if;

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

  -- Das Mitglied ohne Konto mit derselben Adresse (BR-192): Es bekommt das
  -- Konto, seine Rolle aus der alten App bleibt, sein Name auch – es sei
  -- denn, die Person nennt beim Beitritt einen.
  if v_member_id is null then
    select email into v_email from auth.users where id = v_user;
    select m.id into v_member_id
      from club_members m join member_contacts c on c.member_id = m.id
     where m.club_id = v_invite.club_id
       and m.user_id is null
       and m.status <> 'left'
       and v_email is not null
       and lower(c.email) = lower(v_email)
     limit 1;
    if v_member_id is not null then
      update club_members
         set user_id = v_user,
             display_name = coalesce(v_name, display_name)
       where id = v_member_id;
      v_is_new := true;
    end if;
  end if;

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
    v_is_new := true;
  end if;

  if v_invite.team_id is not null then
    insert into team_members (team_id, member_id)
    values (v_invite.team_id, v_member_id)
    on conflict do nothing;
  end if;

  if v_is_new and v_invite.created_by is not null
     and v_invite.created_by <> v_member_id then
    perform award_points(v_invite.created_by, 'member_referred', 'invite', v_invite.id);
  end if;

  update invites set uses = uses + 1 where id = v_invite.id;

  -- FR-184: die Begrüssung, sobald die Mitgliedschaft entstanden ist.
  if v_is_new then
    perform welcome_member(v_user, v_invite.club_id);
  end if;

  return v_invite.club_id;
end;
$$;

revoke execute on function public.redeem_invite(text, text) from public, anon;
grant  execute on function public.redeem_invite(text, text) to authenticated;

create or replace function public.decide_join_request(
  p_request_id uuid,
  p_approve    boolean,
  p_role       text default 'member',
  p_team_id    uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request   join_requests;
  v_club      clubs;
  v_decider   uuid;
  v_member_id uuid;
  v_role      text;
begin
  select * into v_request from join_requests where id = p_request_id for update;
  if not found then
    raise exception 'Anfrage nicht gefunden';
  end if;

  -- BR-013: Der Entscheid ist dem Vorstand vorbehalten, geprüft hier und nicht
  -- durch ein ausgeblendetes Bedienelement.
  if not is_club_admin(v_request.club_id) then
    raise exception 'Nur der Vorstand entscheidet über Beitritts-Anfragen';
  end if;

  if v_request.status <> 'pending' then
    -- Zwei Vorstände gleichzeitig: Der zweite Entscheid läuft ins Leere,
    -- statt den ersten zu überschreiben.
    return v_request.status;
  end if;

  select * into v_club from clubs where id = v_request.club_id;
  v_decider := current_member_id(v_request.club_id);

  -- BR-015: Ohne abweichende Wahl wird die Person Mitglied.
  v_role := coalesce(nullif(trim(p_role), ''), 'member');
  if v_role not in ('member','trainer','admin') then
    raise exception 'Unbekannte Rolle: %', v_role;
  end if;

  -- BR-014: Jeder Entscheid hält fest, wer wann entschieden hat.
  update join_requests
     set status     = case when p_approve then 'approved' else 'rejected' end,
         decided_by = v_decider,
         decided_at = now()
   where id = p_request_id;

  if not p_approve then
    -- BR-016: neutral formuliert, ohne gespeicherte Begründung.
    perform notify(
      v_request.user_id, 'join_request',
      'Entscheid zu deiner Anfrage',
      v_club.name || ' hat deine Beitritts-Anfrage nicht angenommen.',
      null, v_request.club_id,
      true,
      'Der Vorstand entscheidet über jede Anfrage einzeln. Eine neue Anfrage '
        || 'ist jederzeit möglich.'
    );
    return 'rejected';
  end if;

  -- A2: Zwischen Anfrage und Entscheid kann die Person über eine Einladung
  -- beigetreten sein. Dann bleibt es bei der bestehenden Mitgliedschaft.
  select id into v_member_id
    from club_members
   where club_id = v_request.club_id and user_id = v_request.user_id;

  if v_member_id is null then
    insert into club_members (club_id, user_id, role, display_name)
    values (
      v_request.club_id, v_request.user_id, v_role,
      coalesce(
        (select nullif(raw_user_meta_data->>'full_name', '')
           from auth.users where id = v_request.user_id),
        split_part((select email from auth.users where id = v_request.user_id), '@', 1)
      )
    )
    returning id into v_member_id;
  end if;

  if coalesce(p_team_id, v_request.team_id) is not null then
    insert into team_members (team_id, member_id)
    values (coalesce(p_team_id, v_request.team_id), v_member_id)
    on conflict do nothing;
  end if;

  -- FR-184: Die Begrüssung ersetzt die bisherige Zeile «Willkommen bei X» –
  -- sie sagt dasselbe und erklärt zusätzlich, wie es weitergeht. `BR-240`
  -- sorgt dafür, dass sie nicht neben einer Begrüssung aus `redeem_invite`
  -- steht, wenn die Person inzwischen über eine Einladung beigetreten ist.
  perform welcome_member(v_request.user_id, v_request.club_id);

  return 'approved';
end;
$$;
