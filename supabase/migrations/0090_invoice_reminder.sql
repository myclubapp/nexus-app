-- ============================================================================
-- 0090_invoice_reminder: an eine offene Rechnung erinnern (FR-176, UC-046 A8)
--
-- Der letzte offene Punkt aus UC-046. Bisher gab es nur die Erinnerung
-- **vor** der Fälligkeit (`remind_due_invoices()`, seit `0054`, jede Nacht
-- sieben Tage davor). Was danach kommt, musste die Kassier:in einzeln von Hand
-- anstossen – genau das, was FR-176 abnehmen soll.
--
-- **BR-236: Eine Erinnerung je Woche und Rechnung.** Sie ist ein Hinweis, kein
-- Mahnlauf: Zwei Erinnerungen an einem Tag wären eine Drohung, und BR-158
-- verbietet die Sanktion. Der Zähler steht an der Rechnung, damit die Grenze
-- auch gilt, wenn zwei Vorstandsmitglieder gleichzeitig nachfassen.
--
-- **BR-158 bleibt unverändert:** Die Erinnerung nennt Betrag und Fälligkeit,
-- keine Gebühr, keine Folge, keine Frist.
-- ============================================================================

alter table invoices add column if not exists reminded_at timestamptz;
alter table invoices add column if not exists reminder_count int not null default 0;

-- Der Trigger aus `0087` lässt an einer versendeten Rechnung nur den
-- Lebenslauf zu; die beiden neuen Spalten gehören dazu und sind dort nicht
-- aufgezählt – er sperrt nur Betrag, Währung, Referenz, Mitglied, Periode und
-- Fälligkeit. Nichts zu ändern.

/**
 * An **eine** offene Rechnung erinnern (FR-176).
 *
 * Gibt zurück, ob die Erinnerung hinausging: `false` heisst, dass diese Woche
 * schon eine unterwegs war (BR-236) – das ist kein Fehler, sondern eine
 * Antwort, die der Sammellauf unten zählt.
 */
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
      '/tabs/profile/invoices', v_invoice.club_id);
  end if;

  return true;
end;
$$;

/**
 * An alle **überfälligen** Rechnungen einer Periode erinnern (FR-176).
 *
 * Der Weg, der die Arbeit abnimmt: «damit ich nicht einzeln nachfassen muss».
 * Erinnert wird nur, was fällig **und** noch offen ist – eine Rechnung, deren
 * Frist noch läuft, ist kein Anlass für Nachfragen.
 */
create or replace function public.remind_open_invoices(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_period  invoice_periods;
  v_row     record;
  v_sent    int := 0;
  v_skipped int := 0;
begin
  select * into v_period from invoice_periods where id = p_period_id;
  if v_period.id is null then
    raise exception 'Unbekannte Abrechnungsperiode';
  end if;
  if not is_club_admin(v_period.club_id) then
    raise exception 'Nur der Vorstand erinnert an eine Rechnung (BR-229)';
  end if;

  for v_row in
    select i.id
      from invoices i
      join club_members m on m.id = i.member_id
     where i.period_id = p_period_id
       and i.status = 'sent'
       and i.due_date < current_date
       and m.status <> 'left'
     order by i.due_date
  loop
    if remind_invoice(v_row.id) then
      v_sent := v_sent + 1;
    else
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('reminded', v_sent, 'skipped', v_skipped);
end;
$$;

-- Beide ruft der Vorstand aus der App auf und beide prüfen `is_club_admin()`
-- selbst; sie bleiben deshalb für `authenticated` offen.
