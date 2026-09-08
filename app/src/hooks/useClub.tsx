import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Preferences } from '@capacitor/preferences';
import { supabase, isConfigured } from '../lib/supabase';
import { applyClubTheme } from '../lib/theme';
import type { Club, ClubMember, EventType } from '../lib/database.types';
import { useAuth } from './useAuth';

const ACTIVE_CLUB_KEY = 'myclub.activeClubId';

/** A membership row together with the club it belongs to. */
export interface Membership extends ClubMember {
  club: Club;
}

interface ClubContextValue {
  memberships: Membership[];
  activeMembership: Membership | null;
  activeClub: Club | null;
  isLoading: boolean;
  error: Error | null;
  /** Lädt die Mitgliedschaften erneut, nachdem die Abfrage fehlgeschlagen ist. */
  refetch: () => void;
  setActiveClub: (clubId: string) => void;
  /** True for roles that may confirm shifts, award points and see health signals. */
  isAdmin: boolean;
  isTrainer: boolean;
  /**
   * Club-specific wording for an event type. A choir calls a training a
   * rehearsal; the MVP scope requires the vocabulary to stay club-neutral.
   */
  eventLabel: (type: EventType) => string;
}

const ClubContext = createContext<ClubContextValue | undefined>(undefined);

async function fetchMemberships(userId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from('club_members')
    .select('*, club:clubs(*)')
    .eq('user_id', userId)
    .neq('status', 'left');

  if (error) throw new Error(error.message);

  // Ohne feste Reihenfolge liefert PostgREST die Mitgliedschaften beliebig –
  // der Fallback unten würde dann nach jedem Neuladen einen anderen Verein
  // als aktiv wählen.
  return ((data ?? []) as unknown as Membership[]).sort((a, b) =>
    a.club.name.localeCompare(b.club.name) || a.club_id.localeCompare(b.club_id),
  );
}

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    void Preferences.get({ key: ACTIVE_CLUB_KEY }).then(({ value }) => {
      setActiveClubId(value);
      setRestored(true);
    });
  }, []);

  const query = useQuery({
    queryKey: ['memberships', user?.id],
    queryFn: () => fetchMemberships(user!.id),
    enabled: Boolean(user?.id) && isConfigured,
  });

  const memberships = useMemo(() => query.data ?? [], [query.data]);

  const { refetch } = query;
  const refetchMemberships = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Fall back to the first membership when nothing was stored or the stored
  // club is no longer among the user's memberships.
  const activeMembership = useMemo(() => {
    if (memberships.length === 0) return null;
    return (
      memberships.find((m) => m.club_id === activeClubId) ?? memberships[0] ?? null
    );
  }, [memberships, activeClubId]);

  useEffect(() => {
    applyClubTheme(activeMembership?.club.settings);
  }, [activeMembership]);

  const setActiveClub = useCallback((clubId: string) => {
    setActiveClubId(clubId);
    void Preferences.set({ key: ACTIVE_CLUB_KEY, value: clubId });
  }, []);

  const eventLabel = useCallback(
    (type: EventType) =>
      activeMembership?.club.settings?.labels?.[type] ?? t(`agenda.type.${type}`),
    [activeMembership, t],
  );

  const role = activeMembership?.role;

  const value = useMemo<ClubContextValue>(
    () => ({
      memberships,
      activeMembership,
      activeClub: activeMembership?.club ?? null,
      isLoading: !restored || query.isLoading,
      error: query.error as Error | null,
      refetch: refetchMemberships,
      setActiveClub,
      isAdmin: role === 'admin' || role === 'superadmin',
      isTrainer: role === 'trainer' || role === 'admin' || role === 'superadmin',
      eventLabel,
    }),
    [
      memberships,
      activeMembership,
      restored,
      query.isLoading,
      query.error,
      refetchMemberships,
      setActiveClub,
      role,
      eventLabel,
    ],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): ClubContextValue {
  const context = useContext(ClubContext);
  if (!context) {
    throw new Error('useClub must be used inside a ClubProvider');
  }
  return context;
}
