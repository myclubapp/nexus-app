import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import type { Json } from '../lib/database.types';
import type { LabelSet } from '../lib/clubSettings';
import { SUPPORTED_LANGUAGES, type Language } from '../i18n';
import {
  FACTSHEET_BUCKET,
  factsheetPath,
  parseDuties,
  readDuties,
  type Office,
  type OfficeDraft,
  type OfficeHolder,
} from '../lib/office';
import { useClub } from './useClub';

interface HolderRow {
  id: string;
  member_id: string | null;
  display_name: string;
  interim: boolean;
  since: string | null;
  created_at: string;
}

/**
 * Die Ämter des Vereins samt Belegung und Factsheet (UC-041).
 *
 * Eine Abfrage für alle Leser: Sitzungs-Blätter (Verteiler), Ämterliste,
 * Marktplatz. Die Policy aus `0049`/`0070` gibt heraus, was Mitglieder sehen
 * dürfen – der Client filtert nichts.
 */
/**
 * Der Grusstext je Sprache (UC-050, FR-191) – tolerant gelesen, weil er als
 * `jsonb` kommt. Was keine Zeichenkette ist, fällt weg: Ein Objekt mit einer
 * Zahl darin wäre kein Gruss.
 */
function readGreeting(value: unknown): LabelSet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([code, text]) =>
      typeof text === 'string' && text.trim() !== '' && SUPPORTED_LANGUAGES.includes(code as Language),
  );
  return Object.fromEntries(entries) as LabelSet;
}

export function useOffices() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['offices', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<Office[]> => {
      const { data, error } = await supabase
        .from('functionary_roles')
        // Ein einziges Literal: Aus einer zusammengesetzten Zeichenkette kann
        // supabase-js die Zeilenform nicht ableiten. Der Spiegel und die
        // Ansprechperson zeigen beide auf `club_members` – ohne den Namen des
        // Fremdschlüssels wäre die Einbettung mehrdeutig.
        .select(
          'id, title, holder_member_id, held_since, why, duties, hours_per_season, points_label, season_points, is_board, max_holders, contact_member_id, contact_name, factsheet_path, greeting, greeting_image_url, holder:club_members!functionary_roles_holder_member_id_fkey(display_name), holders:functionary_holders(id, member_id, display_name, interim, since, created_at)',
        )
        .eq('club_id', activeClub!.id)
        .order('title');
      if (error) throw new Error(error.message);

      return (data ?? []).map((row) => {
        const holders = ((row.holders ?? []) as HolderRow[])
          .slice()
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(
            (holder): OfficeHolder => ({
              id: holder.id,
              memberId: holder.member_id,
              displayName: holder.display_name,
              interim: holder.interim,
              since: holder.since,
            }),
          );
        return {
          id: row.id,
          title: row.title,
          holderMemberId: row.holder_member_id,
          holderName:
            (row.holder as { display_name: string } | null)?.display_name ?? null,
          heldSince: row.held_since,
          why: row.why,
          duties: readDuties(row.duties),
          hoursPerSeason: row.hours_per_season,
          pointsLabel: row.points_label,
          seasonPoints: row.season_points,
          maxHolders: row.max_holders,
          isBoard: row.is_board,
          contactMemberId: row.contact_member_id,
          contactName: row.contact_name,
          factsheetPath: row.factsheet_path,
          greeting: readGreeting(row.greeting),
          greetingImageUrl: row.greeting_image_url,
          holders,
        };
      });
    },
  });
}

/**
 * Ein Amt anlegen oder ändern – samt Belegung, in einem Schritt.
 *
 * `save_office()` (0070) prüft die Vorstandsrolle und schreibt Amt und Sitze
 * in einer Transaktion. Der Spiegel `holder_member_id` entsteht dort per
 * Trigger (BR-185); die App schreibt ihn nie.
 */
export function useSaveOffice() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { id: string | null; draft: OfficeDraft }): Promise<string> => {
      const { draft } = input;
      const { data, error } = await supabase.rpc('save_office', {
        p_club_id: activeClub!.id,
        p_title: draft.title.trim(),
        p_id: input.id ?? undefined,
        p_why: draft.why.trim() || undefined,
        // `Json` verlangt eine Index-Signatur, die ein Interface nicht hat.
        p_duties: parseDuties(draft.dutiesText) as unknown as Json,
        p_hours_per_season: draft.hoursPerSeason.trim() || undefined,
        p_points_label: draft.pointsLabel.trim() || undefined,
        p_max_holders: draft.maxHolders,
        // BR-237: `undefined` hiesse «unverändert» – hier ist der Wert immer
        // gemeint, weil das Formular ihn zeigt.
        p_is_board: draft.isBoard,
        p_contact_member_id: draft.contactMemberId ?? undefined,
        p_contact_name: draft.contactName.trim() || undefined,
        p_holders: draft.holders.map((holder) => ({
          id: holder.id ?? undefined,
          member_id: holder.memberId ?? undefined,
          display_name: holder.displayName.trim(),
          interim: holder.interim,
          // `undefined` heisst «unverändert»: `save_office()` behält dann das
          // gespeicherte Datum. Ein Wert kommt aus der eingelesenen
          // Ämterbeschreibung (UC-041 A8); das Formular reicht ihn durch.
          since: holder.since ?? undefined,
        })) as unknown as Json,
      });
      if (error) throw new Error(error.message);
      const roleId = data as string;

      // BR-206: Der Punktwert geht über eine eigene Funktion und nicht als
      // Parameter an `save_office()`. Ein zusätzlicher Parameter mit
      // Vorgabewert `null` würde bei jedem Speichern aus einem Formular, das
      // ihn nicht kennt, den Wert stillschweigend löschen.
      const { error: pointsError } = await supabase.rpc('set_office_points', {
        p_role_id: roleId,
        // `null` ist ein gültiger Wert – «noch nicht festgelegt», nicht «null
        // Punkte». Die generierten Typen kennen für Funktionsparameter keine
        // Nullbarkeit, deshalb der Cast; PostgREST reicht `null` als SQL-NULL
        // durch.
        p_points: draft.seasonPoints as unknown as number,
      });
      if (pointsError) throw new Error(pointsError.message);

      return roleId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offices', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matching-vacancies', activeClub?.id] });
    },
  });
}

/** Ein Amt auflösen. Die Inputs daran bleiben – sie tragen ihre Kennung selbst. */
/**
 * Den Gruss eines Amtes schreiben (FR-191, FR-192).
 *
 * **Eigene Funktion, nicht `save_office()`** – aus demselben Grund, aus dem
 * der Punktwert eine eigene hat (BR-206): Ein Formular, das die Felder nicht
 * kennt, würde sie sonst löschen. Bei `save_office()` käme es schlimmer, weil
 * ein Aufruf ohne Belegung die Sitze des Amtes löscht.
 *
 * `undefined` heisst «unverändert», das leere Objekt «grüsst nicht mehr», die
 * leere Zeichenkette «kein Porträt mehr».
 */
export function useSaveOfficeGreeting() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      roleId: string;
      greeting?: LabelSet;
      imageUrl?: string;
    }): Promise<void> => {
      const { error } = await supabase.rpc('set_office_greeting', {
        p_role_id: input.roleId,
        // `Json` verlangt eine Index-Signatur, die ein Type-Alias über
        // `Partial<Record<…>>` nicht mitbringt.
        p_greeting: input.greeting as unknown as Json,
        p_image: input.imageUrl,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['offices', activeClub?.id] });
    },
  });
}

export function useDeleteOffice() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (office: Pick<Office, 'id' | 'factsheetPath'>) => {
      // Das PDF zuerst: Ein Amt, das weg ist, kann seinen Pfad nicht mehr nennen.
      if (office.factsheetPath) {
        const { error: removeError } = await supabase.storage
          .from(FACTSHEET_BUCKET)
          .remove([office.factsheetPath]);
        if (removeError) throw new Error(removeError.message);
      }
      const { error } = await supabase.from('functionary_roles').delete().eq('id', office.id);
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['offices', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['matching-vacancies', activeClub?.id] });
    },
  });
}

/** Wie lange eine signierte Adresse gilt, in Sekunden. */
const FACTSHEET_URL_TTL = 3600;

/**
 * Die Adresse eines Factsheets zum Öffnen.
 *
 * Der Bucket ist privat (BR-186): Jede Adresse ist signiert und läuft ab.
 * Sie wird geholt, sobald das Blatt offen ist – damit der Knopf ein `href`
 * trägt und das PDF wie ein Website-Link aufgeht, ohne dass ein Popup-Blocker
 * ein nachträgliches `window.open()` verschluckt.
 */
export function useFactsheetUrl(path: string | null) {
  return useQuery({
    queryKey: ['factsheet-url', path],
    enabled: Boolean(path) && isConfigured,
    // Deutlich kürzer als die Gültigkeit: Eine abgelaufene Adresse im Knopf
    // wäre ein Link ins Leere.
    staleTime: (FACTSHEET_URL_TTL / 4) * 1000,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase.storage
        .from(FACTSHEET_BUCKET)
        .createSignedUrl(path!, FACTSHEET_URL_TTL);
      if (error) throw new Error(error.message);
      return data.signedUrl;
    },
  });
}

/**
 * Ein Factsheet hochladen oder ersetzen.
 *
 * Der Pfad ist die Kennung des Amtes im Vereinsordner (`factsheetPath()`):
 * Ein Ersatz überschreibt, und die Storage-Policy prüft den Ordner. Danach
 * steht der Pfad am Amt – der einzige Spaltenwert, den die App am Amt direkt
 * schreibt (0070 gibt genau diese Spalten frei).
 */
export function useUploadFactsheet() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { officeId: string; file: File }): Promise<string> => {
      const path = factsheetPath(activeClub!.id, input.officeId);
      const { error: uploadError } = await supabase.storage
        .from(FACTSHEET_BUCKET)
        .upload(path, input.file, { upsert: true, contentType: 'application/pdf' });
      if (uploadError) throw new Error(uploadError.message);

      const { data, error } = await supabase
        .from('functionary_roles')
        .update({ factsheet_path: path })
        .eq('id', input.officeId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('office_not_found');
      return path;
    },
    onSuccess: (path) => {
      void queryClient.invalidateQueries({ queryKey: ['offices', activeClub?.id] });
      void queryClient.invalidateQueries({ queryKey: ['factsheet-url', path] });
    },
  });
}

/** Ein Factsheet entfernen: Datei weg, Pfad weg – in dieser Reihenfolge. */
export function useRemoveFactsheet() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: { officeId: string; path: string }): Promise<void> => {
      const { error: removeError } = await supabase.storage
        .from(FACTSHEET_BUCKET)
        .remove([input.path]);
      if (removeError) throw new Error(removeError.message);

      const { data, error } = await supabase
        .from('functionary_roles')
        .update({ factsheet_path: null })
        .eq('id', input.officeId)
        .select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('office_not_found');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['offices', activeClub?.id] });
    },
  });
}
