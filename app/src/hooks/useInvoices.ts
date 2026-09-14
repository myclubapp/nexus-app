import { useQuery } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type { InvoiceRef, InvoiceStatus } from '../lib/invoice';

/**
 * Die eigenen Rechnungen (FR-118).
 *
 * Die Policy aus `0054` gibt die eigenen heraus – und dem Vorstand die des
 * Vereins, weil er sie stellt. Der Client filtert **nichts**.
 */
export function useMyInvoices() {
  const { activeClub, activeMembership } = useClub();

  return useQuery({
    queryKey: ['invoices', activeClub?.id, activeMembership?.id],
    enabled: Boolean(activeClub) && Boolean(activeMembership) && isConfigured,
    queryFn: async (): Promise<InvoiceRef[]> => {
      const { data, error } = await supabase
        .from('invoice_refs')
        .select('id, amount, due_date, status, paid_at, detail_url, pdf_path')
        .eq('member_id', activeMembership!.id)
        .order('due_date', { ascending: false });
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => ({
        id: row.id,
        amount: Number(row.amount),
        dueDate: row.due_date,
        status: row.status as InvoiceStatus,
        paidAt: row.paid_at,
        detailUrl: row.detail_url,
        pdfPath: row.pdf_path,
      }));
    },
  });
}
