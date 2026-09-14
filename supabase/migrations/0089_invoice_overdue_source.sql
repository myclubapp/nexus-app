-- ============================================================================
-- 0089_invoice_overdue_source: Überfälligkeit bekommt wieder eine Quelle
--
-- **Ein Befund aus dem eigenen Umbau.** `0054` liess den Stand `overdue` von
-- aussen melden: Der fremde Rechnungsdienst schickte `invoice.overdue`, und
-- `flag_overdue_invoices()` machte daraus das Fürsorge-Signal (UC-023).
-- Seit der Dienst in nexus läuft (UC-046), meldet niemand mehr von aussen –
-- und damit stand `invoice_refs.status = 'overdue'` nirgends mehr:
--
--   * das Mitglied sah eine längst fällige Rechnung weiter als «offen»,
--   * `flag_overdue_invoices()` fand nie eine Zeile und das Signal
--     `invoice_overdue` war wieder ohne Quelle – genau der Zustand, den
--     UC-036 behoben hatte.
--
-- Zwei kleine Funktionen schliessen das, plus ein Auftrag, der **vor** dem
-- bestehenden `invoice-overdue` läuft (05:20 gegen 05:30).
--
-- Ausserdem: Die Erinnerung vor der Fälligkeit stellte unter der Kategorie
-- `points` zu. Seit UC-046 gibt es `invoice` – eine Rechnung, die unter
-- «Punkte» ankommt, ist in den Benachrichtigungs-Einstellungen nicht
-- abwählbar, ohne die Punkte mit abzuschalten.
-- ============================================================================

/**
 * Was fällig war und nicht bezahlt ist, ist überfällig.
 *
 * Auf dem **Spiegel**, nicht auf `invoices`: Der Stand einer Rechnung ist ihr
 * Lebenslauf (`draft`, `sent`, `paid`, `cancelled`), «überfällig» ist eine
 * Aussage über die Zeit. Die Verwaltungsansicht rechnet sie ohnehin aus dem
 * Fälligkeitsdatum aus (`stateTone()`); das Mitglied bekommt sie hier.
 */
create or replace function public.refresh_invoice_overdue()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  update invoice_refs
     set status = 'overdue', updated_at = now()
   where status = 'open'
     and due_date < current_date;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Die Erinnerung vor der Fälligkeit, wortgleich zu `0054` – geändert ist die
-- Kategorie (`invoice` statt `points`) und der Hinweis, dass die Rechnung im
-- Vereinsspeicher liegt.
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
    perform notify(v_row.user_id, 'invoice',
                   'Eine Rechnung wird nächste Woche fällig',
                   v_row.points::text, '/tabs/profile/invoices', v_row.club_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.refresh_invoice_overdue() from public, anon, authenticated;
revoke execute on function public.remind_due_invoices() from public, anon, authenticated;

-- Zehn Minuten vor `invoice-overdue` (05:30), damit das Fürsorge-Signal am
-- selben Morgen entsteht und nicht einen Tag später.
select cron.unschedule('invoice-overdue-refresh')
 where exists (select 1 from cron.job where jobname = 'invoice-overdue-refresh');
select cron.schedule('invoice-overdue-refresh', '20 5 * * *',
  $cron$select public.refresh_invoice_overdue();$cron$);
