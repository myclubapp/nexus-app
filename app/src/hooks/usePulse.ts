import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import i18n from '../i18n';
import { useClub } from './useClub';
import { toPulsePayload, type ClubPulse, type ConnectionRatio, type PulseItem, type PulsePayload } from '../lib/pulse';

function toPulse(row: Record<string, unknown>): ClubPulse {
  return {
    id: row.id as string,
    happening: (row.happening ?? []) as PulseItem[],
    workingOn: (row.working_on ?? []) as PulseItem[],
    joinIn: (row.join_in ?? []) as PulseItem[],
    intro: (row.intro ?? null) as string | null,
    status: row.status as ClubPulse['status'],
    composedAt: row.composed_at as string,
    sentAt: (row.sent_at ?? null) as string | null,
  };
}

/**
 * Der offene Entwurf des Vereins (UC-027, Schritt 3).
 *
 * Die Policy aus `0044` zeigt Entwürfe nur dem Vorstand – der Client filtert
 * nicht mit.
 */
export function usePulseDraft() {
  const { activeClub, isAdmin } = useClub();

  return useQuery({
    queryKey: ['pulse-draft', activeClub?.id],
    enabled: Boolean(activeClub) && isAdmin && isConfigured,
    queryFn: async (): Promise<ClubPulse | null> => {
      const { data, error } = await supabase
        .from('club_pulses')
        .select('*')
        .eq('club_id', activeClub!.id)
        .eq('status', 'draft')
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toPulse(data as Record<string, unknown>) : null;
    },
  });
}

/** Ein einzelner, versendeter Puls – die Leseansicht (A4). */
export function usePulse(pulseId: string | null) {
  return useQuery({
    queryKey: ['pulse', pulseId],
    enabled: Boolean(pulseId) && isConfigured,
    queryFn: async (): Promise<ClubPulse | null> => {
      const { data, error } = await supabase
        .from('club_pulses')
        .select('*')
        .eq('id', pulseId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toPulse(data as Record<string, unknown>) : null;
    },
  });
}

/**
 * Ein Puls mit allem, was im Blatt steht – Abschnitte **und** Gruss (UC-050).
 *
 * `pulse_payload()` ist `security invoker`: Die Policy aus `0044` entscheidet,
 * wer etwas sieht, und gibt `null` zurück, wenn nichts zu sehen ist. Deshalb
 * liest diese Abfrage auch den Gruss, den die Tabelle allein nicht kennt – er
 * hängt am Amt (BR-252).
 */
export function usePulsePayload(pulseId: string | null, keep: string[] | null = null) {
  // **Die Sprache gehört in den Schlüssel**, weil sie in die Abfrage geht: Der
  // Grusstext ist Prosa des Vereins und wird nach Sprache **ausgewählt**. Ohne
  // sie zeigte ein Sprachwechsel den Gruss von vorher.
  //
  // Und die Auswahl gehört ebenfalls hinein: Sie filtert **serverseitig**
  // (`p_keep`), damit die Regel «was gestrichen ist, steht nicht drin» genau
  // einmal im Repository steht – dieselbe Funktion beantwortet die App-Ansicht
  // und das Mailblatt.
  const keepKey = keep ? [...keep].sort().join(',') : 'alle';

  return useQuery({
    queryKey: ['pulse-payload', pulseId, keepKey, i18n.language],
    enabled: Boolean(pulseId) && isConfigured,
    queryFn: async (): Promise<PulsePayload | null> => {
      const { data, error } = await supabase.rpc('pulse_payload', {
        p_pulse_id: pulseId!,
        p_locale: i18n.language,
        p_keep: keep ?? undefined,
      });
      if (error) throw new Error(error.message);
      return toPulsePayload(data);
    },
  });
}

/**
 * Freigeben (Schritte 6–8).
 *
 * `keep` ist die Liste der **behaltenen** Einträge. Wer nichts streicht,
 * übergibt nichts und bekommt den Entwurf, wie er ist – das ist BR-115.
 */
export function useReleasePulse() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      pulseId: string;
      intro: string;
      keep: string[] | null;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('release_pulse', {
        p_pulse_id: input.pulseId,
        p_intro: input.intro || undefined,
        p_keep: input.keep ?? undefined,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-draft', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['connection-ratio'] });
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

/**
 * Den Entwurf von Hand anstossen (UC-027, A3).
 *
 * Komponiert wird weiterhin serverseitig – `request_club_pulse` prüft die
 * Rolle und das Modul und ruft dann denselben Lauf auf, den der Montag auslöst.
 * `null` heisst: Der Verein hat diese Woche nichts anzukündigen.
 */
export function useComposePulse() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('request_club_pulse', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-draft', activeClub?.id] });
    },
  });
}

/** Was die Vorschau zurückgibt – das fertige Blatt, wie es im Postfach ankommt. */
export interface PulsePreview {
  subject: string;
  html: string;
}

/**
 * Die Vorschau des Pulses (UC-050, FR-189).
 *
 * Gerendert wird in der Function `pulse-preview` – mit **demselben** Blatt wie
 * der Versand (`_shared/pulse_sheet.ts`). Die App baut es ausdrücklich nicht
 * nach: Eine zweite Abschrift zeigte etwas, das niemand bekommt.
 *
 * `keep` ist die Auswahl des Vorstands, damit die Vorschau zeigt, was die
 * Freigabe verschicken würde. Geschrieben wird dabei nichts (BR-249).
 */
export function usePulsePreview(
  pulseId: string | null,
  keep: string[] | null,
  enabled: boolean,
) {
  // Die Auswahl gehört in den Schlüssel, nicht nur in den Rumpf: Wer einen
  // Eintrag streicht und die Vorschau erneut öffnet, soll sie ohne diesen
  // Eintrag sehen und nicht die zwischengespeicherte von vorher.
  const keepKey = keep ? [...keep].sort().join(',') : 'alle';

  return useQuery({
    queryKey: ['pulse-preview', pulseId, keepKey, i18n.language],
    enabled: Boolean(pulseId) && enabled && isConfigured,
    // Eine Vorschau ist nichts, was im Hintergrund altert – sie entsteht beim
    // Öffnen des Blatts und wird danach nicht mehr gebraucht.
    staleTime: 0,
    gcTime: 0,
    queryFn: async (): Promise<PulsePreview> => {
      const { data, error } = await supabase.functions.invoke<PulsePreview>('pulse-preview', {
        body: { pulseId, locale: i18n.language, keep },
      });
      // `functions.invoke` wirft bei jedem Status ab 400 denselben Satz –
      // dasselbe Muster wie in `useInvoicing`: die Meldung der Function lesen,
      // sonst steht «non-2xx status code» auf dem Bildschirm.
      if (error) throw new Error(await functionMessage(error));
      if (!data) throw new Error(i18n.t('pulse.previewEmpty'));
      return data;
    },
  });
}

/** Die Meldung aus dem Rumpf einer Function – nicht der Satz von supabase-js. */
async function functionMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // Kein JSON im Rumpf – dann bleibt die Meldung der Bibliothek.
    }
  }
  return (error as Error).message;
}

/** A2: «Diese Woche nicht». */
export function useDiscardPulse() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (pulseId: string) => {
      const { error } = await supabase.rpc('discard_pulse', { p_pulse_id: pulseId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse-draft', activeClub?.id] });
    },
  });
}

/**
 * Die Verbindungs-Quote (FR-070).
 *
 * Gezählt wird sie seit `0018`. Dass sie nirgends stand, ist der Grund, warum
 * ein Vorstand bis heute nicht sah, ob sein Verein nur bittet.
 */
export function useConnectionRatio(days = 56) {
  // Eine Vereinszahl: `connection_ratio()` gibt sie seit `0073` nur dem Vorstand.
  const { activeClub, isBoard } = useClub();

  return useQuery({
    queryKey: ['connection-ratio', activeClub?.id, days],
    enabled: Boolean(activeClub) && isBoard && isConfigured,
    queryFn: async (): Promise<ConnectionRatio> => {
      const { data, error } = await supabase.rpc('connection_ratio', {
        p_club_id: activeClub!.id,
        p_days: days,
      });
      if (error) throw new Error(error.message);

      const row = data?.[0];
      return {
        connections: row?.connections ?? 0,
        calls: row?.calls ?? 0,
        lastConnection: row?.last_connection ?? null,
      };
    },
  });
}
