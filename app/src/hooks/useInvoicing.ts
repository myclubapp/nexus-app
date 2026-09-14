import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useClub } from './useClub';
import type {
  Invoice,
  InvoiceCreditor,
  InvoiceFeeItem,
  InvoicePeriod,
  InvoicePosition,
} from '../lib/database.types';

/**
 * Die Rechnungsstellung des Vereins (UC-046) und der Zahlungsabgleich
 * (UC-047).
 *
 * **Was der Client darf, ist schmal:** lesen, Perioden und Positionen des
 * Vereins pflegen, und drei Funktionen aufrufen, die ihrerseits
 * `is_club_admin()` prüfen. Er schreibt **keine** Rechnung, keinen Stand und
 * keine Referenz – dafür gibt es keine Policy (BR-220).
 */

/** Die Gläubigerangaben des Vereins (FR-169). */
export function useCreditor() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['invoiceCreditor', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<InvoiceCreditor | null> => {
      const { data, error } = await supabase
        .from('invoice_creditors')
        .select('*')
        .eq('club_id', activeClub!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export interface CreditorInput {
  iban: string;
  name: string;
  street: string;
  house_number: string;
  postal_code: string;
  city: string;
  country: string;
}

export function useSaveCreditor() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: CreditorInput) => {
      const { error } = await supabase.from('invoice_creditors').upsert(
        {
          club_id: activeClub!.id,
          iban: input.iban.replace(/\s/g, '').toUpperCase(),
          name: input.name.trim(),
          street: input.street.trim() || null,
          house_number: input.house_number.trim() || null,
          postal_code: input.postal_code.trim() || null,
          city: input.city.trim() || null,
          country: input.country.trim().toUpperCase() || 'CH',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'club_id' },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoiceCreditor'] }),
  });
}

/** Beiträge je Team und Zuschläge des Vereins (FR-171). */
export function useFeeItems() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['invoiceFeeItems', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<InvoiceFeeItem[]> => {
      const { data, error } = await supabase
        .from('invoice_fee_items')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('team_id', { nullsFirst: true })
        .order('created_at');
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export interface FeeItemInput {
  id?: string;
  team_id: string | null;
  name: string;
  amount: number;
  currency: string;
  is_active: boolean;
}

export function useSaveFeeItem() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: FeeItemInput) => {
      const row = {
        club_id: activeClub!.id,
        team_id: input.team_id,
        name: input.name.trim(),
        amount: input.amount,
        currency: input.currency,
        is_active: input.is_active,
      };
      const { error } = input.id
        ? await supabase.from('invoice_fee_items').update(row).eq('id', input.id)
        : await supabase.from('invoice_fee_items').insert(row);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoiceFeeItems'] }),
  });
}

export function useDeleteFeeItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_fee_items').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoiceFeeItems'] }),
  });
}

/** Die Abrechnungsperioden (FR-170). */
export function useInvoicePeriods() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['invoicePeriods', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<InvoicePeriod[]> => {
      const { data, error } = await supabase
        .from('invoice_periods')
        .select('*')
        .eq('club_id', activeClub!.id)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });
}

export interface PeriodInput {
  name: string;
  dueDate: string;
  currency: string;
  referencePrefix: string;
}

export function useCreatePeriod() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: PeriodInput): Promise<InvoicePeriod> => {
      const { data, error } = await supabase
        .from('invoice_periods')
        .insert({
          club_id: activeClub!.id,
          name: input.name.trim(),
          due_date: input.dueDate,
          currency: input.currency,
          reference_prefix: input.referencePrefix.trim() || null,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoicePeriods'] }),
  });
}

/** Eine Rechnung mit ihren Positionen und dem Namen der Person. */
export interface InvoiceRow extends Invoice {
  memberName: string;
  positions: InvoicePosition[];
}

export function usePeriodInvoices(periodId: string | null) {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['invoices', activeClub?.id, periodId],
    enabled: Boolean(activeClub) && Boolean(periodId) && isConfigured,
    queryFn: async (): Promise<InvoiceRow[]> => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, club_members(display_name), invoice_positions(*)')
        .eq('period_id', periodId!)
        .order('created_at');
      if (error) throw new Error(error.message);

      return ((data ?? []) as unknown as (Invoice & {
        club_members: { display_name: string } | null;
        invoice_positions: InvoicePosition[];
      })[]).map(({ club_members, invoice_positions, ...invoice }) => ({
        ...invoice,
        memberName: club_members?.display_name ?? '—',
        positions: [...invoice_positions].sort((a, b) => a.sort_order - b.sort_order),
      }));
    },
  });
}

/** Was ein Lauf erzeugt hat – und was er ausgelassen hat (A6). */
export interface GenerateResult {
  created: number;
  existing: string[];
  without: string[];
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      periodId: string;
      memberIds: string[];
      feeItemIds: string[];
    }): Promise<GenerateResult> => {
      const { data, error } = await supabase.rpc('generate_invoices', {
        p_period_id: input.periodId,
        p_member_ids: input.memberIds,
        p_fee_item_ids: input.feeItemIds,
      });
      if (error) throw new Error(error.message);
      return data as unknown as GenerateResult;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useAddPosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invoiceId: string; label: string; amount: number }) => {
      const { error } = await supabase.rpc('add_invoice_position', {
        p_invoice_id: input.invoiceId,
        p_label: input.label.trim(),
        p_amount: input.amount,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (positionId: string) => {
      const { error } = await supabase.rpc('delete_invoice_position', {
        p_position_id: positionId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

/** A4: einen Entwurf verwerfen. Versendetes wird storniert, nicht gelöscht. */
export function useDeleteDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { error } = await supabase.rpc('delete_invoice_draft', { p_invoice_id: invoiceId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

/** A5: stornieren. Das Mitglied erfährt es, der Spiegel verliert die Zeile. */
export function useCancelInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invoiceId: string; reason: string }) => {
      const { error } = await supabase.rpc('cancel_invoice', {
        p_invoice_id: input.invoiceId,
        // `p_reason` hat in SQL eine Vorgabe; der Typgenerator macht daraus
        // ein wahlfreies Argument. `undefined` heisst hier «weglassen» und
        // trifft damit genau die Vorgabe `null`.
        p_reason: input.reason.trim() || undefined,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

/** Was der Rechnungslauf zurückmeldet (FR-173, FR-174). */
export interface InvoiceRunResult {
  sent: number;
  failed: { id: string; error: string }[];
  /** Rechnungen, die mit unvollständiger Adresse hinausgingen (BR-223). */
  incomplete: string[];
  /** Rechnungen ohne E-Mail-Adresse – sie wollen auf Papier (A3). */
  withoutEmail: string[];
}

/**
 * Den Lauf auslösen (Schritt 8).
 *
 * Die Function baut die PDF, verschickt sie und quittiert in der Datenbank.
 * Der Client erfährt nur, was daraus geworden ist – er sieht weder die
 * Adressen der anderen noch den SMTP-Zugang.
 */
export function useInvoiceRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      periodId: string;
      invoiceId?: string;
    }): Promise<InvoiceRunResult> => {
      const { data, error } = await supabase.functions.invoke<InvoiceRunResult>('invoice-run', {
        body: { periodId: input.periodId, invoiceId: input.invoiceId },
      });
      if (error) throw new Error(await readFunctionError(error, 'invoice-run'));
      return data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['invoiceRefs'] });
    },
  });
}

/** Was der Zahlungsabgleich zurückmeldet (UC-047). */
export interface PaymentImportResult {
  found: number;
  matched?: number;
  already?: number;
  points?: number;
  unmatched?: { reference: string; amount: string | null; reason: string }[];
  /** Nur beim Probelauf: was in der Datei steht, ohne dass gebucht wurde. */
  preview?: { reference: string; amount: number; paid_at: string | null; payer: string | null }[];
  dryRun?: boolean;
}

/**
 * Die Bankdatei verbuchen (UC-047, FR-175).
 *
 * **Die Datei wird im Backend gelesen**, nicht hier: Welche Rechnung als
 * bezahlt gilt, ist dieselbe Klasse Entscheidung wie eine Punktebuchung
 * (NFR-012). Diese Stelle reicht den Text weiter und zeigt die Antwort.
 */
export function usePaymentImport() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      xml: string;
      filename: string;
      dryRun?: boolean;
    }): Promise<PaymentImportResult> => {
      const { data, error } = await supabase.functions.invoke<PaymentImportResult>(
        'payment-import',
        {
          body: {
            clubId: activeClub!.id,
            xml: input.xml,
            filename: input.filename,
            dryRun: input.dryRun === true,
          },
        },
      );
      if (error) throw new Error(await readFunctionError(error, 'payment-import'));
      return data!;
    },
    onSuccess: async (_result, input) => {
      if (input.dryRun === true) return;
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['points'] });
    },
  });
}

/**
 * Die Adresse zur abgelegten Rechnung (BR-225).
 *
 * Signiert und befristet: Der Bucket ist privat, und eine gespeicherte Adresse
 * liefe ab. Eine Stunde reicht, um sie anzusehen oder zu sichern.
 */
export function useInvoicePdfUrl() {
  return useMutation({
    mutationFn: async (path: string): Promise<string> => {
      const { data, error } = await supabase.storage
        .from('club-invoices')
        .createSignedUrl(path, 3600);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}

/**
 * Die Meldung aus einer Edge Function lesbar machen.
 *
 * `functions.invoke` wirft bei jedem Status ab 400 denselben Satz
 * («Edge Function returned a non-2xx status code»). Was die Function
 * tatsächlich sagt, steht im Rumpf der Antwort – ohne diesen Umweg stünde in
 * der Ansicht nie der Grund, sondern immer nur, dass etwas schiefging.
 */
async function readFunctionError(error: unknown, name: string): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Kein JSON im Rumpf – dann bleibt die ursprüngliche Meldung.
    }
  }
  return (error as Error).message || `${name} antwortet nicht`;
}
