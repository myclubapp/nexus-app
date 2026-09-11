-- ============================================================================
-- 0054_invoice_mirror: Rechnungen einsehen, Punkte bei pünktlicher Zahlung
--                      (UC-036)
--
-- **BR-156: «Die App kennt nur den Spiegel.»** Betrag, Fälligkeit, Status und
-- ein Link – Positionen, Zahlungsreferenzen und Bankdaten bleiben im
-- Rechnungsdienst. Diese Migration erzeugt deshalb **keine** Rechnung und
-- keinen QR-Einzahlungsschein; das gehört dorthin, wo die Gläubigerangaben
-- liegen (in der bestehenden myclub-App: `swissqrbill` im Backend).
--
-- **FR-119 ist der eigentliche Ertrag.** Die Punkteregel `invoice_on_time`
-- (Säule 6, 40 Punkte) steht seit `0005` in jedem Verein – und hatte bis heute
-- keine Quelle. Dasselbe gilt für den Signaltyp `invoice_overdue` aus `0040`.
-- ============================================================================

create table if not exists invoice_refs (
  -- Die Kennung **des Dienstes**: Er meldet dieselbe Rechnung mehrfach, und
  -- zweimal buchen darf sie nicht.
  id         uuid primary key,
  club_id    uuid not null references clubs(id) on delete cascade,
  member_id  uuid not null references club_members(id) on delete cascade,
  amount     numeric(10,2) not null check (amount >= 0),
  due_date   date not null,
  status     text not null check (status in ('open','paid','overdue')),
  paid_at    timestamptz,
  -- Der signierte Verweis in den Dienst. Signiert wird **dort** (BR-159); die
  -- App reicht ihn durch und kennt das Geheimnis nicht.
  detail_url text check (detail_url is null or length(detail_url) <= 1000),
  updated_at timestamptz not null default now()
);

create index if not exists invoice_refs_member_idx
  on invoice_refs(member_id, due_date desc);
create index if not exists invoice_refs_club_idx
  on invoice_refs(club_id, status, due_date);

-- Bezahlt heisst: mit Zeitpunkt. Ohne ihn liesse sich die Frist nicht prüfen,
-- und BR-157 wäre nicht anwendbar.
alter table invoice_refs drop constraint if exists invoice_refs_paid_check;
alter table invoice_refs add constraint invoice_refs_paid_check
  check (
    case when status = 'paid'
      then paid_at is not null
      else true
    end
  );

alter table invoice_refs enable row level security;

-- ---------------------------------------------------------------------------
-- Wer eine Rechnung sieht.
--
-- Die eigene – und der Vorstand die des Vereins: Er stellt sie, er mahnt sie,
-- und der Zahlungsstatus steht in UC-025 ausdrücklich als Datenart, die der
-- Verein sieht. Trainer:innen nicht: Sie haben damit nichts zu tun.
-- ---------------------------------------------------------------------------
drop policy if exists invoice_refs_read on invoice_refs;
create policy invoice_refs_read on invoice_refs
  for select using (
    member_id = current_member_id(club_id)
    or is_club_admin(club_id)
  );

-- Geschrieben wird ausschliesslich über `report_invoice()`, und die darf nur
-- der Dienst aufrufen.

-- ---------------------------------------------------------------------------
-- Die Meldestelle des Rechnungsdienstes (Schritte 6–8).
--
-- **Nur `service_role`.** Könnte ein angemeldetes Konto sie aufrufen, liesse
-- sich ein Zahlungseingang behaupten und damit die Punkte der Säule 6 buchen –
-- das wäre der erste Weg in dieser App, auf dem sich jemand selbst Punkte
-- gibt (NFR-012).
-- ---------------------------------------------------------------------------
create or replace function public.report_invoice(
  p_invoice_id uuid,
  p_club_id    uuid,
  p_member_id  uuid,
  p_amount     numeric,
  p_due_date   date,
  p_status     text,
  p_paid_at    timestamptz default null,
  p_detail_url text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before text;
  v_points int := 0;
  v_user   uuid;
begin
  if p_status not in ('open','paid','overdue') then
    raise exception 'Unbekannter Status: %', p_status;
  end if;

  if not exists (select 1 from club_members m
                  where m.id = p_member_id and m.club_id = p_club_id) then
    raise exception 'Mitglied gehört nicht zu diesem Verein';
  end if;

  select status into v_before from invoice_refs where id = p_invoice_id;

  insert into invoice_refs
    (id, club_id, member_id, amount, due_date, status, paid_at, detail_url, updated_at)
  values
    (p_invoice_id, p_club_id, p_member_id, p_amount, p_due_date, p_status,
     p_paid_at, p_detail_url, now())
  on conflict (id) do update
     set amount     = excluded.amount,
         due_date   = excluded.due_date,
         status     = excluded.status,
         paid_at    = excluded.paid_at,
         detail_url = coalesce(excluded.detail_url, invoice_refs.detail_url),
         updated_at = now();

  -- BR-157: Punkte nur, wenn der Zahlungszeitpunkt nicht **nach** dem
  -- Fälligkeitsdatum liegt. Auf den Tag: Wer am Fälligkeitstag zahlt, ist
  -- pünktlich.
  if p_status = 'paid'
     and p_paid_at is not null
     and p_paid_at::date <= p_due_date then
    -- `award_points()` dedupliziert über (member_id, rule_code, source_id) –
    -- eine zweite Meldung derselben Rechnung bucht nicht nochmals (NFR-017).
    v_points := award_points(p_member_id, 'invoice_on_time', 'invoice', p_invoice_id);

    if v_points > 0 then
      select m.user_id into v_user from club_members m where m.id = p_member_id;
      if v_user is not null then
        perform notify(v_user, 'points', 'Danke fürs pünktliche Bezahlen',
                       null, '/tabs/profile/points', p_club_id);
      end if;
    end if;
  end if;

  -- BR-158: Verzug führt zu **nichts** – kein Abzug, kein Vermerk. Der
  -- Statuswechsel ist die ganze Folge.
  return v_points;
end;
$$;

-- ---------------------------------------------------------------------------
-- A1: die Erinnerung vor der Fälligkeit.
--
-- Sie nennt die Punkte, die eine fristgerechte Zahlung bringt – das ist der
-- Unterschied zwischen einer Mahnung und einem Hinweis.
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
    perform notify(v_row.user_id, 'points',
                   'Eine Rechnung wird nächste Woche fällig',
                   v_row.points::text, '/tabs/profile/invoices', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- A3: Überfälligkeit als **Spätindikator** in der Gesundheitsbetrachtung.
--
-- `invoice_overdue` steht seit `0040` im Constraint und hatte keine Quelle.
-- Der Widerspruch aus UC-025 gilt: Wer ihn gesetzt hat, erzeugt kein Signal.
-- ---------------------------------------------------------------------------
create or replace function public.flag_overdue_invoices()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row    record;
  v_signal uuid;
  v_count  int := 0;
begin
  for v_row in
    select distinct i.club_id, i.member_id
      from invoice_refs i
      join club_members m on m.id = i.member_id
     where i.status = 'overdue'
       and m.status <> 'left'
       -- UC-025: Der Widerspruch gilt für **jedes** personenbezogene Signal.
       and not m.health_opt_out
       and module_enabled(i.club_id, 'invoice')
  loop
    v_signal := null;

    insert into health_signals
      (club_id, member_id, team_id, signal_type, severity, detail)
    values
      (v_row.club_id, v_row.member_id, null, 'invoice_overdue', 'info',
       (select count(*)::text from invoice_refs i2
         where i2.member_id = v_row.member_id and i2.status = 'overdue'))
    on conflict do nothing
    returning id into v_signal;

    if v_signal is null then
      continue;
    end if;

    -- BR-158: Das Signal ist ein Anlass für Kontakt, keine Massnahme. Die
    -- Schwere ist deshalb `info` und nicht `urgent`.
    perform notify_signal_owners(v_signal);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- FR-117: der Ausgangskorb für den Mitglieder-Sync.
--
-- Der **Transport** braucht den Rechnungsdienst, den es noch nicht gibt. Was
-- hier entsteht, ist der Teil, der ohnehin in diese Datenbank gehört: eine
-- verlässliche Liste dessen, was sich geändert hat. Wer sie abholt, ist die
-- Frage des Dienstes – dass nichts verloren geht, ist die Frage dieser
-- Migration.
-- ---------------------------------------------------------------------------
create table if not exists billing_outbox (
  id         bigserial primary key,
  club_id    uuid not null references clubs(id) on delete cascade,
  member_id  uuid not null references club_members(id) on delete cascade,
  -- `upsert` oder `remove` – mehr Fälle kennt ein Debitoren-Spiegel nicht.
  operation  text not null check (operation in ('upsert','remove')),
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create index if not exists billing_outbox_pending_idx
  on billing_outbox(club_id, created_at) where sent_at is null;

alter table billing_outbox enable row level security;

-- Niemand liest ihn ausser dem Dienst; für Angemeldete gibt es hier nichts.
drop policy if exists billing_outbox_none on billing_outbox;

create or replace function public.queue_billing_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_club uuid := coalesce(new.club_id, old.club_id);
begin
  -- Ohne aktiven Rechnungsdienst entsteht kein Eintrag: Ein Ausgangskorb, den
  -- niemand leert, wäre nur eine wachsende Tabelle.
  if not module_enabled(v_club, 'invoice') then
    return coalesce(new, old);
  end if;

  insert into billing_outbox (club_id, member_id, operation)
  values (
    v_club,
    coalesce(new.id, old.id),
    case when tg_op = 'DELETE' or coalesce(new.status, '') = 'left'
      then 'remove' else 'upsert' end
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists club_members_billing_sync on club_members;
create trigger club_members_billing_sync
  after insert or update of display_name, status, role or delete on club_members
  for each row execute function queue_billing_sync();

-- ---------------------------------------------------------------------------
-- Rechte.
-- ---------------------------------------------------------------------------

-- Die Meldestelle gehört dem Dienst. **Nicht** `authenticated`: Sonst könnte
-- sich jemand Punkte der Säule 6 buchen, indem er eine Zahlung behauptet.
revoke execute on function public.report_invoice(uuid, uuid, uuid, numeric, date, text, timestamptz, text)
  from public, anon, authenticated;
grant  execute on function public.report_invoice(uuid, uuid, uuid, numeric, date, text, timestamptz, text)
  to service_role;

revoke execute on function public.remind_due_invoices() from public, anon, authenticated;
revoke execute on function public.flag_overdue_invoices() from public, anon, authenticated;
revoke execute on function public.queue_billing_sync() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Aufträge.
-- ---------------------------------------------------------------------------
select cron.unschedule('invoice-remind')
 where exists (select 1 from cron.job where jobname = 'invoice-remind');
select cron.schedule('invoice-remind', '20 8 * * *',
  $cron$select public.remind_due_invoices();$cron$);

select cron.unschedule('invoice-overdue')
 where exists (select 1 from cron.job where jobname = 'invoice-overdue');
select cron.schedule('invoice-overdue', '30 5 * * *',
  $cron$select public.flag_overdue_invoices();$cron$);
