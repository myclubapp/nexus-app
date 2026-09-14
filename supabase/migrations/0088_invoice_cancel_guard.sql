-- ============================================================================
-- 0088_invoice_cancel_guard: zwei Befunde aus der Verhaltensprüfung zu 0087
--
-- 1. **Eine bezahlte Rechnung liess sich stornieren.** Die Probe zeigte es:
--    Nach dem Zahlungseingang nahm `cancel_invoice()` sie an, setzte sie auf
--    `cancelled` und löschte den Spiegel – das Geld war da, die Punkte der
--    Säule 6 gebucht, und das Mitglied sah seine bezahlte Rechnung nicht mehr.
--    Eine Rückerstattung ist kein Storno; sie findet ausserhalb der App statt.
--
-- 2. **Eine Periode konnte jede Währung tragen.** Der QR-Einzahlungsschein
--    kennt nur CHF und EUR (SIX). Alles andere wäre eine Rechnung, die nie
--    versendet werden kann – und das fiele erst im Rechnungslauf auf.
-- ============================================================================

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
  -- Neu (Befund der Probe): Bezahltes wird nicht storniert. Sonst verschwände
  -- eine bezahlte Rechnung aus «Meine Rechnungen», während die Punkte der
  -- Säule 6 gebucht bleiben – zwei Stände derselben Sache.
  if v_invoice.status = 'paid' then
    raise exception 'Eine bezahlte Rechnung wird nicht storniert; eine Rückerstattung läuft ausserhalb der App';
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

-- Die Währung einer Periode: nur, was ein Einzahlungsschein tragen kann.
alter table invoice_periods drop constraint if exists invoice_periods_currency_check;
alter table invoice_periods add constraint invoice_periods_currency_check
  check (currency in ('CHF', 'EUR'));

alter table invoice_fee_items drop constraint if exists invoice_fee_items_currency_check;
alter table invoice_fee_items add constraint invoice_fee_items_currency_check
  check (currency in ('CHF', 'EUR'));

alter table invoices drop constraint if exists invoices_currency_check;
alter table invoices add constraint invoices_currency_check
  check (currency in ('CHF', 'EUR'));
