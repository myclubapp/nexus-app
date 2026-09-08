import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface AdminBlocker {
  clubId: string;
  clubName: string;
}

/**
 * Vereine, die durch eine Kontolöschung ohne Vorstand zurückblieben (A1).
 *
 * Die Frage wird vor der Bestätigung gestellt und von `delete_my_account()`
 * noch einmal – das UI erklärt, die Datenbank entscheidet (BR-023, C-011).
 */
export function useAdminBlockers() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['admin-blockers', user?.id],
    enabled: Boolean(user) && isConfigured,
    queryFn: async (): Promise<AdminBlocker[]> => {
      const { data, error } = await supabase.rpc('my_clubs_left_without_admin');
      if (error) throw new Error(error.message);
      return (data ?? [])
        .filter((row) => row.club_id && row.club_name)
        .map((row) => ({ clubId: row.club_id!, clubName: row.club_name! }));
    },
  });
}

/**
 * Konto löschen (UC-006).
 *
 * Die Reihenfolge steckt vollständig in der Datenbankfunktion: Sie läuft in
 * einer Transaktion, damit ein Abbruch kein halb gelöschtes Konto hinterlässt.
 * Danach ist die Sitzung wertlos – das Konto gibt es nicht mehr – und wird
 * lokal verworfen.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { signOut } = useAuth();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await signOut();
      queryClient.clear();
    },
  });
}
