-- ============================================================================
-- 0087_invoicing: Rechnungen stellen (UC-046) und Zahlungen verbuchen (UC-047)
--
-- **Der Entscheid vom 14.09.2026 dreht MVP-Scope §3 um.** Die Rechnungsstellung
-- sollte ein eigenständiger Dienst werden; gebaut wird sie stattdessen hier,
-- nach dem Vorbild der bisherigen myclub-App (`myclubapp/backend`,
-- `functions/src/firestore/invoice/changeInvoice.ts`) – auf Postgres statt
-- Firestore, ohne Google-Bausteine.
--
-- Was `0054` gebracht hat, bleibt unverändert gültig: `invoice_refs` ist der
-- Spiegel, den das Mitglied sieht (BR-156), `report_invoice()` die einzige
-- Stelle, die ihn schreibt und dabei Säule 6 bucht (BR-157). Neu ist allein,
-- **wer** sie aufruft: nicht mehr ein fremder Dienst, sondern der eigene
-- Rechnungslauf.
--
-- Vier Regeln tragen diese Migration:
--   BR-220  Rechnung, Referenz und Stand entstehen serverseitig.
--   BR-221  Die Referenz kommt aus einer Sequenz und trägt ihre Prüfziffer.
--   BR-224  Ein Entwurf ist änderbar, eine versendete Rechnung nicht.
--   BR-229  Rechnungen stellt nur der Vorstand – geprüft in jeder Policy.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- IBAN und QR-Referenz.
--
-- Beide Funktionen sind rein und `immutable`, damit sie in `check`-Bedingungen
-- stehen dürfen. Die alte App prüfte **nichts**: Eine falsche IBAN fiel erst
-- auf, wenn ein Mitglied den Einzahlungsschein bei seiner Bank vorlegte.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_iban(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_iban  text := upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g'));
  v_moved text;
  v_digits text := '';
  v_char  text;
  v_mod   int := 0;
  i       int;
begin
  -- Zwei Buchstaben, zwei Prüfziffern, danach alphanumerisch (ISO 13616).
  if v_iban !~ '^[A-Z]{2}[0-9]{2}[0-9A-Z]{11,30}$' then
    return false;
  end if;

  v_moved := substr(v_iban, 5) || substr(v_iban, 1, 4);

  for i in 1..length(v_moved) loop
    v_char := substr(v_moved, i, 1);
    if v_char ~ '^[0-9]$' then
      v_digits := v_digits || v_char;
    else
      -- A=10 … Z=35
      v_digits := v_digits || (ascii(v_char) - 55)::text;
    end if;
  end loop;

  -- Stückweise: Die Zahl hat bis zu 70 Stellen und passt in keinen `bigint`.
  for i in 1..length(v_digits) loop
    v_mod := (v_mod * 10 + substr(v_digits, i, 1)::int) % 97;
  end loop;

  return v_mod = 1;
end;
$$;

comment on function public.is_valid_iban(text) is
  'Prüfziffer einer IBAN nach ISO 7064 (mod 97-10). Rein, damit sie in check-Bedingungen stehen darf.';

/**
 * Ist das eine **QR-IBAN**?
 *
 * Nur sie trägt eine QRR-Referenz, und nur mit einer QRR-Referenz lässt sich
 * ein Zahlungseingang später eindeutig einer Rechnung zuordnen (UC-047). Die
 * QR-IID steht an den Stellen 5 bis 9 und liegt zwischen 30000 und 31999
 * (SIX Implementation Guidelines).
 */
create or replace function public.is_qr_iban(p_iban text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  -- Ein Ausdruck statt eines Vergleichs mit Cast: `and` wertet in Postgres
  -- nicht garantiert von links nach rechts aus, und `substr(...)::int` auf
  -- einer Nicht-Ziffer wäre ein Fehler statt einer Antwort. `3[01][0-9]{3}`
  -- an den Stellen 5 bis 9 ist genau der Bereich 30000 bis 31999.
  select is_valid_iban(p_iban)
     and upper(regexp_replace(coalesce(p_iban, ''), '\s', '', 'g')) ~ '^(CH|LI)[0-9]{2}3[01][0-9]{3}';
$$;

/**
 * Die Prüfziffer der QR-Referenz: Modulo 10 rekursiv (SIX).
 *
 * Dieselbe Tabelle wie `mod10()` in der alten App – dort im Client, hier in
 * der Datenbank, weil die Referenz hier entsteht.
 */
create or replace function public.qr_check_digit(p_base text)
returns int
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_table constant int[] := array[0, 9, 4, 6, 8, 2, 7, 1, 3, 5];
  v_carry int := 0;
  i       int;
begin
  if p_base !~ '^[0-9]+$' then
    raise exception 'Referenzbasis besteht nicht nur aus Ziffern: %', p_base;
  end if;

  for i in 1..length(p_base) loop
    -- Postgres-Arrays beginnen bei 1, die Übertragstabelle bei 0.
    v_carry := v_table[((v_carry + substr(p_base, i, 1)::int) % 10) + 1];
  end loop;

  return (10 - v_carry) % 10;
end;
$$;

-- Die Eindeutigkeit der Referenz kommt aus einer Sequenz und nicht aus der
-- Uhr: Die alte App baute sie aus `Date.now()` und einem Index – zwei
-- Rechnungen in derselben Millisekunde teilten sich die Referenz.
create sequence if not exists invoice_reference_seq;

create or replace function public.qr_reference(p_prefix text default null)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_prefix text := left(regexp_replace(coalesce(p_prefix, ''), '\D', '', 'g'), 10);
  v_base   text;
begin
  v_base := v_prefix || lpad(nextval('invoice_reference_seq')::text, 26 - length(v_prefix), '0');

  if length(v_base) <> 26 then
    raise exception 'Referenzbasis ist nicht 26-stellig: %', v_base;
  end if;

  return v_base || qr_check_digit(v_base)::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- Die Gläubigerangaben des Vereins (FR-169).
--
-- Eine Zeile je Verein. Die IBAN steht als `check` unter der Prüfziffer – eine
-- ungültige kommt gar nicht erst in die Tabelle.
-- ---------------------------------------------------------------------------
create table if not exists invoice_creditors (
  club_id         uuid primary key references clubs(id) on delete cascade,
  iban            text not null check (is_valid_iban(iban)),
  name            text not null check (length(trim(name)) between 2 and 120),
  street          text check (street is null or length(trim(street)) between 1 and 200),
  house_number    text check (house_number is null or length(trim(house_number)) between 1 and 20),
  postal_code     text check (postal_code is null or length(trim(postal_code)) between 1 and 12),
  city            text check (city is null or length(trim(city)) between 1 and 80),
  country         text not null default 'CH' check (country ~ '^[A-Z]{2}$'),
  updated_at      timestamptz not null default now()
);

alter table invoice_creditors enable row level security;

drop policy if exists invoice_creditors_admin on invoice_creditors;
create policy invoice_creditors_admin on invoice_creditors
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

/**
 * Kann dieser Verein versenden (BR-222)?
 *
 * Die Frage steht **einmal**: Die Einrichtungsseite stellt sie, bevor eine
 * Periode entsteht, und der Rechnungslauf stellt sie noch einmal, bevor eine
 * Rechnung hinausgeht. Zweimal dieselbe Regel in zwei Sprachen wäre der
 * Anfang zweier Antworten.
 */
create or replace function public.creditor_ready(p_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from invoice_creditors c
     where c.club_id = p_club_id
       and is_qr_iban(c.iban)
       and coalesce(trim(c.street), '') <> ''
       and coalesce(trim(c.postal_code), '') <> ''
       and coalesce(trim(c.city), '') <> ''
  );
$$;

-- ---------------------------------------------------------------------------
-- Beiträge und Zuschläge (FR-171).
--
-- **Eine** Tabelle für beides: Mit `team_id` ist es der Beitrag dieses Teams,
-- ohne ist es ein Zuschlag oder Abzug des Vereins (negativ erlaubt). Zwei
-- Tabellen wären zweimal dasselbe – eine vorgeschlagene Position.
--
-- Die Zeile trägt einen `team_id` und ist trotzdem **nicht** nach Team
-- abgegrenzt (CLAUDE.md): Sie wird enger geführt, nicht weiter – nur der
-- Vorstand liest und schreibt sie. Was ein Team kostet, ist eine Frage des
-- Vereins und keine des Trainers.
-- ---------------------------------------------------------------------------
create table if not exists invoice_fee_items (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  team_id    uuid references teams(id) on delete cascade,
  name       text not null check (length(trim(name)) between 2 and 120),
  amount     numeric(10,2) not null,
  currency   text not null default 'CHF' check (currency ~ '^[A-Z]{3}$'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists invoice_fee_items_club_idx
  on invoice_fee_items(club_id, team_id);

alter table invoice_fee_items enable row level security;

drop policy if exists invoice_fee_items_admin on invoice_fee_items;
create policy invoice_fee_items_admin on invoice_fee_items
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- Die Abrechnungsperiode (FR-170).
--
-- Sie ist der Rahmen eines Laufs: ein Zweck, eine Fälligkeit, eine Währung.
-- Der Referenz-Präfix erlaubt es, die Rechnungen einer Periode im Kontoauszug
-- zu erkennen – er ist Bequemlichkeit, die Eindeutigkeit kommt aus der
-- Sequenz.
-- ---------------------------------------------------------------------------
create table if not exists invoice_periods (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid not null references clubs(id) on delete cascade,
  name             text not null check (length(trim(name)) between 2 and 120),
  due_date         date not null,
  currency         text not null default 'CHF' check (currency ~ '^[A-Z]{3}$'),
  reference_prefix text check (reference_prefix is null or reference_prefix ~ '^[0-9]{1,10}$'),
  created_at       timestamptz not null default now()
);

create index if not exists invoice_periods_club_idx
  on invoice_periods(club_id, created_at desc);

alter table invoice_periods enable row level security;

drop policy if exists invoice_periods_admin on invoice_periods;
create policy invoice_periods_admin on invoice_periods
  for all using (is_club_admin(club_id)) with check (is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- Die Rechnung und ihre Positionen (FR-172).
--
-- Die Stände heissen englisch – die alte App führte `draft`, `send`, `sent`
-- und `bezahlt`, den letzten deutsch mitten in englischen Werten. `send` war
-- zudem kein Stand, sondern ein Auftrag im Statusfeld; der Auftrag ist hier
-- der Aufruf des Rechnungslaufs.
-- ---------------------------------------------------------------------------
create table if not exists invoices (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid not null references clubs(id) on delete cascade,
  period_id    uuid not null references invoice_periods(id) on delete cascade,
  member_id    uuid not null references club_members(id) on delete cascade,
  reference    text not null unique check (reference ~ '^[0-9]{27}$'),
  amount       numeric(10,2) not null default 0 check (amount >= 0),
  currency     text not null default 'CHF' check (currency ~ '^[A-Z]{3}$'),
  status       text not null default 'draft'
                 check (status in ('draft', 'sent', 'paid', 'cancelled')),
  due_date     date not null,
  pdf_path     text check (pdf_path is null or length(pdf_path) <= 400),
  sent_at      timestamptz,
  paid_at      timestamptz,
  payer        text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Eine Rechnung je Mitglied und Periode: Ein zweiter Lauf über dieselbe
-- Periode soll überspringen, nicht doppeln.
create unique index if not exists invoices_period_member_idx
  on invoices(period_id, member_id);
create index if not exists invoices_club_status_idx
  on invoices(club_id, status, due_date);
create index if not exists invoices_member_idx
  on invoices(member_id, due_date desc);

create table if not exists invoice_positions (
  id         uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  label      text not null check (length(trim(label)) between 1 and 120),
  amount     numeric(10,2) not null,
  sort_order int not null default 0
);

create index if not exists invoice_positions_invoice_idx
  on invoice_positions(invoice_id, sort_order);

alter table invoices enable row level security;
alter table invoice_positions enable row level security;

-- Lesen: der Vorstand alles, das Mitglied die eigene – aber **keinen
-- Entwurf** (BR-226). Ein Entwurf ist eine Überlegung des Vorstands, keine
-- Forderung.
drop policy if exists invoices_read on invoices;
create policy invoices_read on invoices
  for select using (
    is_club_admin(club_id)
    or (status <> 'draft' and member_id = current_member_id(club_id))
  );

drop policy if exists invoice_positions_read on invoice_positions;
create policy invoice_positions_read on invoice_positions
  for select using (
    exists (
      select 1 from invoices i
       where i.id = invoice_positions.invoice_id
         and (
           is_club_admin(i.club_id)
           or (i.status <> 'draft' and i.member_id = current_member_id(i.club_id))
         )
    )
  );

-- Geschrieben wird ausschliesslich über die Funktionen weiter unten: Es gibt
-- für `insert`, `update` und `delete` **keine** Policy (BR-220).

/**
 * BR-224: Was versendet ist, ändert sich nicht mehr.
 *
 * Der Trigger lässt genau das durch, was zum Lebenslauf einer Rechnung
 * gehört – Stand, Zeitstempel, Ablage des PDF, Zahler. Betrag, Referenz,
 * Mitglied und Periode sind nach dem Entwurf festgeschrieben. Auch für
 * `service_role`: Die Edge Function schreibt mit dem Dienstschlüssel und
 * umginge jede Policy, aber keinen Trigger.
 */
create or replace function public.invoices_guard_after_send()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status <> 'draft' then
    if new.amount is distinct from old.amount
       or new.currency is distinct from old.currency
       or new.reference is distinct from old.reference
       or new.member_id is distinct from old.member_id
       or new.period_id is distinct from old.period_id
       or new.due_date is distinct from old.due_date then
      raise exception 'Eine versendete Rechnung ist unveränderlich (BR-224)';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists invoices_guard on invoices;
create trigger invoices_guard
  before update on invoices
  for each row execute function invoices_guard_after_send();

-- ---------------------------------------------------------------------------
-- Der Ausweis eines Laufs mit der Bankdatei (UC-047).
--
-- Er hält fest, was eine hochgeladene Datei bewirkt hat. Ohne ihn wäre nach
-- dem zweiten Lauf nicht mehr zu sagen, welche Zahlung aus welcher Datei kam.
-- ---------------------------------------------------------------------------
create table if not exists invoice_payment_imports (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references clubs(id) on delete cascade,
  filename   text,
  found      int not null default 0,
  matched    int not null default 0,
  already    int not null default 0,
  unmatched  jsonb not null default '[]'::jsonb,
  created_by uuid references club_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invoice_payment_imports_club_idx
  on invoice_payment_imports(club_id, created_at desc);

alter table invoice_payment_imports enable row level security;

drop policy if exists invoice_payment_imports_read on invoice_payment_imports;
create policy invoice_payment_imports_read on invoice_payment_imports
  for select using (is_club_admin(club_id));

-- ---------------------------------------------------------------------------
-- Der Betrag ist die Summe seiner Positionen (BR-228).
-- ---------------------------------------------------------------------------
create or replace function public.recalc_invoice_amount(p_invoice_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sum numeric(10,2);
begin
  select coalesce(sum(amount), 0) into v_sum
    from invoice_positions where invoice_id = p_invoice_id;

  -- Ein Abzug, der die Rechnung unter null zöge, wäre eine Gutschrift – und
  -- die kennt dieser Ablauf nicht (`amount >= 0` am Tisch).
  if v_sum < 0 then
    raise exception 'Die Summe der Positionen ist negativ: %', v_sum;
  end if;

  update invoices set amount = v_sum where id = p_invoice_id;
  return v_sum;
end;
$$;

-- ---------------------------------------------------------------------------
-- Entwürfe erzeugen (FR-172, Schritte 4 bis 7).
--
-- Die Antwort nennt, was **nicht** entstanden ist: wer schon eine Rechnung in
-- dieser Periode hat und für wen keine einzige Position zutraf (A6). Eine
-- Zahl «12 erzeugt» ohne den Rest verdeckte genau die Fälle, die jemand
-- ansehen muss.
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoices(
  p_period_id    uuid,
  p_member_ids   uuid[],
  p_fee_item_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period    invoice_periods;
  v_member    uuid;
  v_invoice   uuid;
  v_positions int;
  v_created   int := 0;
  v_existing  uuid[] := '{}';
  v_without   uuid[] := '{}';
  v_wrong     int;
begin
  select * into v_period from invoice_periods where id = p_period_id;
  if v_period.id is null then
    raise exception 'Unbekannte Abrechnungsperiode';
  end if;

  if not is_club_admin(v_period.club_id) then
    raise exception 'Nur der Vorstand stellt Rechnungen (BR-229)';
  end if;

  if not module_enabled(v_period.club_id, 'invoice') then
    raise exception 'Das Rechnungsmodul ist nicht eingeschaltet';
  end if;

  -- Eine Rechnung trägt **eine** Währung. Wer eine Position in einer anderen
  -- gewählt hat, hat sich vertan – das bricht hier ab, bevor eine einzige
  -- Rechnung entsteht, statt die Hälfte falsch zu rechnen.
  select count(*) into v_wrong
    from invoice_fee_items f
   where f.id = any(p_fee_item_ids)
     and f.club_id = v_period.club_id
     and f.currency <> v_period.currency;
  if v_wrong > 0 then
    raise exception 'Gewählte Positionen führen eine andere Währung als die Periode (%)', v_period.currency;
  end if;

  foreach v_member in array coalesce(p_member_ids, '{}') loop
    -- Fremde Mitglieder still zu überspringen wäre falsch: Der Aufruf ist
    -- dann nicht das, wofür er sich ausgibt.
    if not exists (
      select 1 from club_members m
       where m.id = v_member and m.club_id = v_period.club_id and m.status <> 'left'
    ) then
      raise exception 'Mitglied gehört nicht zu diesem Verein oder ist ausgetreten';
    end if;

    if exists (select 1 from invoices i
                where i.period_id = p_period_id and i.member_id = v_member) then
      v_existing := v_existing || v_member;
      continue;
    end if;

    insert into invoices (club_id, period_id, member_id, reference, currency, due_date)
    values (v_period.club_id, p_period_id, v_member,
            qr_reference(v_period.reference_prefix), v_period.currency, v_period.due_date)
    returning id into v_invoice;

    -- Der Beitrag des Teams gilt für die Mitglieder dieses Teams, der
    -- Zuschlag des Vereins (`team_id` null) für alle Gewählten.
    insert into invoice_positions (invoice_id, label, amount, sort_order)
    select v_invoice, f.name, f.amount,
           row_number() over (order by f.team_id nulls last, f.created_at)
      from invoice_fee_items f
     where f.id = any(p_fee_item_ids)
       and f.club_id = v_period.club_id
       and f.is_active
       and (
         f.team_id is null
         or exists (select 1 from team_members tm
                     where tm.team_id = f.team_id and tm.member_id = v_member)
       );

    get diagnostics v_positions = row_count;

    if v_positions = 0 then
      delete from invoices where id = v_invoice;
      v_without := v_without || v_member;
      continue;
    end if;

    perform recalc_invoice_amount(v_invoice);
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object(
    'created',  v_created,
    'existing', to_jsonb(v_existing),
    'without',  to_jsonb(v_without)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Am Entwurf ändern (Schritt 6). Alles drei prüft dasselbe: Vorstand, und der
-- Entwurf ist noch einer.
-- ---------------------------------------------------------------------------
create or replace function public.add_invoice_position(
  p_invoice_id uuid,
  p_label      text,
  p_amount     numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
  v_id      uuid;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if not is_club_admin(v_invoice.club_id) then
    raise exception 'Nur der Vorstand stellt Rechnungen (BR-229)';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Eine versendete Rechnung ist unveränderlich (BR-224)';
  end if;

  insert into invoice_positions (invoice_id, label, amount, sort_order)
  values (p_invoice_id, p_label, p_amount,
          coalesce((select max(sort_order) + 1 from invoice_positions
                     where invoice_id = p_invoice_id), 1))
  returning id into v_id;

  perform recalc_invoice_amount(p_invoice_id);
  return v_id;
end;
$$;

create or replace function public.delete_invoice_position(p_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
begin
  select i.* into v_invoice
    from invoice_positions p join invoices i on i.id = p.invoice_id
   where p.id = p_position_id;

  if v_invoice.id is null then
    raise exception 'Unbekannte Position';
  end if;
  if not is_club_admin(v_invoice.club_id) then
    raise exception 'Nur der Vorstand stellt Rechnungen (BR-229)';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Eine versendete Rechnung ist unveränderlich (BR-224)';
  end if;

  delete from invoice_positions where id = p_position_id;

  if not exists (select 1 from invoice_positions where invoice_id = v_invoice.id) then
    -- Eine Rechnung ohne Position ist keine Rechnung (BR-228).
    delete from invoices where id = v_invoice.id;
    return;
  end if;

  perform recalc_invoice_amount(v_invoice.id);
end;
$$;

/** A4: einen Entwurf verwerfen. Seine Referenz wird nicht wiederverwendet. */
create or replace function public.delete_invoice_draft(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if not is_club_admin(v_invoice.club_id) then
    raise exception 'Nur der Vorstand stellt Rechnungen (BR-229)';
  end if;
  if v_invoice.status <> 'draft' then
    raise exception 'Nur ein Entwurf lässt sich verwerfen; Versendetes wird storniert (BR-224)';
  end if;

  delete from invoices where id = p_invoice_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- A5: stornieren.
--
-- Der Spiegel verliert die Rechnung nicht still: `invoice_refs` wird
-- mitgelöscht, damit «Meine Rechnungen» sie nicht weiter als offen führt, und
-- das Mitglied erfährt es.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_invoice(
  p_invoice_id uuid,
  p_reason     text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
  v_user    uuid;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if not is_club_admin(v_invoice.club_id) then
    raise exception 'Nur der Vorstand stellt Rechnungen (BR-229)';
  end if;
  if v_invoice.status = 'cancelled' then
    return;
  end if;
  if v_invoice.status = 'draft' then
    raise exception 'Ein Entwurf wird verworfen, nicht storniert';
  end if;

  update invoices
     set status = 'cancelled', cancelled_at = now(), cancel_reason = p_reason
   where id = p_invoice_id;

  delete from invoice_refs where id = p_invoice_id;

  select m.user_id into v_user from club_members m where m.id = v_invoice.member_id;
  if v_user is not null then
    perform notify(v_user, 'invoice', 'Eine Rechnung wurde storniert',
                   p_reason, '/tabs/profile/invoices', v_invoice.club_id);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Was der Rechnungslauf braucht (FR-173).
--
-- **Nur `service_role`.** Die Antwort trägt Adressen und E-Mail-Adressen aller
-- Mitglieder einer Periode; sie gehört der Function, die das PDF baut, und
-- nicht dem Browser.
-- ---------------------------------------------------------------------------
create or replace function public.invoice_payload(
  p_period_id  uuid,
  p_invoice_id uuid default null
)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'period', jsonb_build_object(
      'id', p.id, 'name', p.name, 'due_date', p.due_date, 'currency', p.currency
    ),
    'club', jsonb_build_object(
      'id', c.id, 'name', c.name, 'logo_url', c.settings->>'logoUrl'
    ),
    'creditor', to_jsonb(cr) - 'club_id' - 'updated_at',
    'invoices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'reference', i.reference,
        'amount', i.amount,
        'currency', i.currency,
        'due_date', i.due_date,
        'member_id', i.member_id,
        'name', coalesce(nullif(trim(coalesce(m.first_name, '') || ' ' || coalesce(m.last_name, '')), ''),
                         m.display_name),
        'email', coalesce(nullif(trim(mc.email), ''),
                          (select u.email from auth.users u where u.id = m.user_id)),
        'locale', coalesce((select ns.locale from notification_settings ns where ns.user_id = m.user_id), 'de'),
        'street', mc.street,
        'house_number', mc.house_number,
        'postal_code', mc.postal_code,
        'city', mc.city,
        'country', coalesce(mc.country, 'CH'),
        'positions', coalesce((
          select jsonb_agg(jsonb_build_object('label', pos.label, 'amount', pos.amount)
                           order by pos.sort_order)
            from invoice_positions pos where pos.invoice_id = i.id
        ), '[]'::jsonb)
      ) order by m.display_name)
        from invoices i
        join club_members m on m.id = i.member_id
        left join member_contacts mc on mc.member_id = m.id
       where i.period_id = p.id
         and i.status = 'draft'
         and (p_invoice_id is null or i.id = p_invoice_id)
    ), '[]'::jsonb)
  )
    from invoice_periods p
    join clubs c on c.id = p.club_id
    left join invoice_creditors cr on cr.club_id = p.club_id
   where p.id = p_period_id;
$$;

-- ---------------------------------------------------------------------------
-- Die Quittung des Laufs (FR-174, Schritt 11).
--
-- Hier wird aus dem Entwurf eine Forderung: Stand, Ablage des PDF, der
-- Spiegel für UC-036 und die Meldung an das Mitglied. `report_invoice()` ist
-- dieselbe Funktion, die `0054` für den fremden Dienst gebaut hat – sie bucht
-- **keine** Punkte, weil der Stand `open` ist (BR-227).
-- ---------------------------------------------------------------------------
create or replace function public.mark_invoice_sent(
  p_invoice_id uuid,
  p_pdf_path   text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
  v_user    uuid;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if v_invoice.status <> 'draft' then
    -- Ein zweiter Lauf über dieselbe Rechnung ist kein Fehler, er tut nur
    -- nichts: Der Versand darf abbrechen dürfen, ohne dass der nächste Lauf
    -- doppelt zustellt.
    return;
  end if;

  update invoices
     set status = 'sent', sent_at = now(), pdf_path = coalesce(p_pdf_path, pdf_path)
   where id = p_invoice_id;

  -- Der Spiegel (BR-156, BR-226). `detail_url` bleibt leer: Das PDF liegt im
  -- Vereinsspeicher und wird je Abruf signiert, eine gespeicherte Adresse
  -- liefe ab.
  perform report_invoice(
    v_invoice.id, v_invoice.club_id, v_invoice.member_id,
    v_invoice.amount, v_invoice.due_date, 'open', null, null
  );

  update invoice_refs set pdf_path = coalesce(p_pdf_path, pdf_path)
   where id = v_invoice.id;

  select m.user_id into v_user from club_members m where m.id = v_invoice.member_id;

  if v_user is not null then
    perform notify(v_user, 'invoice', 'Eine neue Rechnung',
                   v_invoice.currency || ' ' || to_char(v_invoice.amount, 'FM999G999D00'),
                   '/tabs/profile/invoices', v_invoice.club_id);
  end if;
end;
$$;

-- Der Spiegel führt neu auch den Weg zum eigenen PDF: Die Rechnung liegt im
-- Vereinsspeicher, nicht bei einem fremden Dienst. `detail_url` bleibt für den
-- Fall, dass ein Verein seine Rechnungen doch auswärts stellt.
alter table invoice_refs add column if not exists pdf_path text
  check (pdf_path is null or length(pdf_path) <= 400);

-- ---------------------------------------------------------------------------
-- Der Zahlungseingang (UC-047, FR-175).
--
-- **Nur `service_role`**: Wer sie aufrufen könnte, behauptete eine Zahlung und
-- bekäme die Punkte der Säule 6 (NFR-012). Die Prüfung, ob die aufrufende
-- Person Vorstand **dieses** Vereins ist, macht die Edge Function mit ihrem
-- Token, bevor sie hierher kommt.
-- ---------------------------------------------------------------------------
create or replace function public.record_invoice_payment(
  p_invoice_id uuid,
  p_paid_at    timestamptz,
  p_payer      text default null
)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice invoices;
begin
  select * into v_invoice from invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Unbekannte Rechnung';
  end if;
  if v_invoice.status = 'paid' then
    return 0;
  end if;
  if v_invoice.status <> 'sent' then
    raise exception 'Nur eine versendete Rechnung kann bezahlt werden';
  end if;

  update invoices
     set status = 'paid', paid_at = p_paid_at, payer = p_payer
   where id = p_invoice_id;

  -- Hier entstehen die Punkte – und nur hier (BR-157, BR-227).
  -- `report_invoice()` dedupliziert über die Quelle (NFR-017).
  return report_invoice(
    v_invoice.id, v_invoice.club_id, v_invoice.member_id,
    v_invoice.amount, v_invoice.due_date, 'paid', p_paid_at, null
  );
end;
$$;

/**
 * Die Zahlungen einer Bankdatei zuordnen (UC-047, Schritte 4 bis 7).
 *
 * Die Edge Function liest die camt-Datei und reicht die gefundenen Zahlungen
 * als `[{reference, amount, paid_at, payer}]` herein. **Die Zuordnung
 * geschieht hier**, nicht im Client: Welche Rechnung als bezahlt gilt, ist
 * dieselbe Klasse Entscheidung wie eine Punktebuchung.
 *
 * `p_club_id` grenzt ab: Eine Referenz, die zu einer Rechnung eines **anderen**
 * Vereins gehört, wird nicht gefunden und bleibt unzugeordnet.
 */
create or replace function public.match_camt_payments(
  p_club_id  uuid,
  p_payments jsonb,
  p_filename text default null,
  p_actor    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_payment  jsonb;
  v_ref      text;
  v_invoice  invoices;
  v_found    int := 0;
  v_matched  int := 0;
  v_already  int := 0;
  v_points   int := 0;
  v_open     jsonb := '[]'::jsonb;
  v_result   int;
begin
  for v_payment in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_found := v_found + 1;
    v_ref := regexp_replace(coalesce(v_payment->>'reference', ''), '\s', '', 'g');

    select * into v_invoice
      from invoices
     where club_id = p_club_id and reference = v_ref;

    if v_invoice.id is null then
      v_open := v_open || jsonb_build_object(
        'reference', v_ref,
        'amount', v_payment->>'amount',
        'reason', 'unknown'
      );
      continue;
    end if;

    if v_invoice.status = 'paid' then
      v_already := v_already + 1;
      continue;
    end if;

    if v_invoice.status <> 'sent' then
      v_open := v_open || jsonb_build_object(
        'reference', v_ref,
        'amount', v_payment->>'amount',
        'reason', v_invoice.status
      );
      continue;
    end if;

    v_result := record_invoice_payment(
      v_invoice.id,
      coalesce((v_payment->>'paid_at')::timestamptz, now()),
      nullif(trim(coalesce(v_payment->>'payer', '')), '')
    );
    v_points := v_points + coalesce(v_result, 0);
    v_matched := v_matched + 1;
  end loop;

  insert into invoice_payment_imports
    (club_id, filename, found, matched, already, unmatched, created_by)
  values
    (p_club_id, p_filename, v_found, v_matched, v_already, v_open, p_actor);

  return jsonb_build_object(
    'found', v_found,
    'matched', v_matched,
    'already', v_already,
    'points', v_points,
    'unmatched', v_open
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Der Vereinsspeicher für die PDF (BR-225).
--
-- Privat: Eine Rechnung nennt Name, Adresse und Betrag einer Person. 2 MiB je
-- Datei reichen für einen Einzahlungsschein mit Logo um ein Vielfaches.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-invoices', 'club-invoices', false, 2097152, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

/**
 * Wer diese Rechnung lesen darf.
 *
 * Der Pfad ist `<club_id>/<invoice_id>.pdf`; entschieden wird aber nicht über
 * den Pfad, sondern über die Rechnung dahinter – der Pfad ist eine Behauptung,
 * die Zeile ist die Wahrheit.
 */
create or replace function public.can_read_invoice_pdf(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from invoices i
     where i.pdf_path = p_name
       and (
         is_club_admin(i.club_id)
         or (i.status <> 'draft' and i.member_id = current_member_id(i.club_id))
       )
  );
$$;

drop policy if exists invoice_pdf_read on storage.objects;
create policy invoice_pdf_read on storage.objects
  for select to authenticated
  using (bucket_id = 'club-invoices' and can_read_invoice_pdf(name));

-- Geschrieben wird der Bucket allein vom Rechnungslauf mit dem Dienst-
-- schlüssel: Es gibt keine `insert`-Policy.

-- ---------------------------------------------------------------------------
-- Rechte.
--
-- Postgres vergibt `execute` automatisch an `public`, Supabase zusätzlich an
-- `anon` und `authenticated` – jede Funktion hängt damit unter `/rest/v1/rpc/`
-- (CLAUDE.md). Was der Vorstand aufruft, bleibt offen und prüft **innen**;
-- alles andere wird entzogen.
-- ---------------------------------------------------------------------------
revoke execute on function public.invoice_payload(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.invoice_payload(uuid, uuid) to service_role;

revoke execute on function public.mark_invoice_sent(uuid, text) from public, anon, authenticated;
grant  execute on function public.mark_invoice_sent(uuid, text) to service_role;

revoke execute on function public.record_invoice_payment(uuid, timestamptz, text) from public, anon, authenticated;
grant  execute on function public.record_invoice_payment(uuid, timestamptz, text) to service_role;

revoke execute on function public.match_camt_payments(uuid, jsonb, text, uuid) from public, anon, authenticated;
grant  execute on function public.match_camt_payments(uuid, jsonb, text, uuid) to service_role;

revoke execute on function public.recalc_invoice_amount(uuid) from public, anon, authenticated;
revoke execute on function public.invoices_guard_after_send() from public, anon, authenticated;
revoke execute on function public.qr_reference(text) from public, anon, authenticated;

-- Diese vier ruft der Vorstand aus der App auf; sie prüfen `is_club_admin()`
-- selbst und dürfen deshalb offen bleiben.
--   generate_invoices, add_invoice_position, delete_invoice_position,
--   delete_invoice_draft, cancel_invoice
