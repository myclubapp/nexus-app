import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import type { SampleKind } from '../lib/sample';

export interface SampleItem {
  kind: SampleKind;
  id: string;
  title: string;
}

/**
 * Die verbliebenen Beispielinhalte – die Grundlage für A3.
 *
 * Sie stehen an **einer** Stelle beisammen, in den Vereinseinstellungen: Der
 * Use Case heisst «Beispielinhalte **verwalten**», und drei Arten über drei
 * Tabs zu verteilen wäre das Gegenteil davon (BR-162).
 */
export function useSampleContent() {
  const { activeClub } = useClub();

  return useQuery({
    queryKey: ['sample-content', activeClub?.id],
    enabled: Boolean(activeClub) && isConfigured,
    queryFn: async (): Promise<SampleItem[]> => {
      const [events, tasks, news] = await Promise.all([
        supabase.from('events').select('id, title').eq('club_id', activeClub!.id)
          .eq('is_sample', true).order('starts_at'),
        supabase.from('tasks').select('id, title').eq('club_id', activeClub!.id)
          .eq('is_sample', true).order('created_at'),
        supabase.from('news').select('id, title').eq('club_id', activeClub!.id)
          .eq('is_sample', true).order('published_at'),
      ]);
      const failure = events.error ?? tasks.error ?? news.error;
      if (failure) throw new Error(failure.message);

      return [
        ...(events.data ?? []).map((row) => ({ kind: 'event' as const, ...row })),
        ...(tasks.data ?? []).map((row) => ({ kind: 'task' as const, ...row })),
        ...(news.data ?? []).map((row) => ({ kind: 'news' as const, ...row })),
      ];
    },
  });
}

/**
 * Alle Beispielinhalte in **einem** Schritt entfernen (FR-136).
 *
 * BR-163: Gelöscht wird ausschliesslich, was die Kennzeichnung trägt. Ein
 * Inhalt, der aus einem Beispiel hervorgegangen ist, hat sie verloren und
 * bleibt unangetastet.
 */
export function useDropSampleContent() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('drop_sample_content', {
        p_club_id: activeClub!.id,
      });
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
    onSettled: () => {
      // Die Beispiele standen auf drei Tabs – alle drei sind jetzt anders.
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['news'] });
      void queryClient.invalidateQueries({ queryKey: ['sample-content'] });
    },
  });
}

/**
 * A3: einen Beispielinhalt als eigenen übernehmen.
 *
 * Die Kennzeichnung fällt weg – und damit gelten Zustellung, Punkte und
 * Verbindungs-Quote ab sofort. Ausgeschrieben wird dabei **nicht** erneut.
 */
export function useAdoptSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { kind: SampleKind; id: string }) => {
      const { error } = await supabase.rpc('adopt_sample', {
        p_kind: input.kind,
        p_id: input.id,
      });
      if (error) throw new Error(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['news'] });
      void queryClient.invalidateQueries({ queryKey: ['sample-content'] });
    },
  });
}
