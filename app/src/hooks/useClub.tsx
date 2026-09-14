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
import { resolveLabel } from '../lib/clubSettings';
import { applyClubTheme } from '../lib/theme';
import type { Club, ClubMember, EventType } from '../lib/database.types';
import { useAuth } from './useAuth';

const ACTIVE_CLUB_KEY = 'myclub.activeClubId';

/** Eine Mitgliedschaft samt dem Verein, zu dem sie gehört. */
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
  /** Wahr für Rollen, die Schichten bestätigen, Punkte buchen und
   *  Fürsorge-Hinweise sehen dürfen. */
  isAdmin: boolean;
  /**
   * Vereins-Scope (C-032, `is_club_board()` in `0073`): Vorstand, Admin und
   * Sportchef:in sehen und planen den ganzen Verein.
   */
  isBoard: boolean;
  /**
   * Darf überhaupt planen (`is_club_trainer()`): Trainer:innen und alle
   * Vorstandsrollen. Über die Reichweite sagt das nichts – eine Trainer:in
   * plant nur für ihre Teams; siehe `canPlanFor()` in `lib/scope.ts`.
   */
  isTrainer: boolean;
  /**
   * Der vereinseigene Begriff für eine Terminart. Ein Chor nennt das
   * Training eine Probe; der MVP-Schnitt verlangt, dass der Kern ohne
   * Sportvokabular auskommt.
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
  const { t, i18n } = useTranslation();
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

  // Auf die erste Mitgliedschaft zurückfallen, wenn nichts gespeichert ist
  // oder der gespeicherte Verein nicht mehr dazugehört.
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

  // BR-147/BR-148: Der Begriff ist eine Einstellung des Vereins, und sie gilt
  // je Sprache. `resolveLabel()` fällt auf eine andere hinterlegte Sprache
  // zurück, bevor es die Standardübersetzung nimmt – wer «Probe» nur auf
  // Deutsch eingetragen hat, meint sie auch auf Französisch.
  const eventLabel = useCallback(
    (type: EventType) =>
      resolveLabel(activeMembership?.club.settings?.labels, type, i18n.language) ??
      t(`agenda.type.${type}`),
    [activeMembership, i18n.language, t],
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
      isBoard: role === 'sportchef' || role === 'admin' || role === 'superadmin',
      isTrainer:
        role === 'trainer' || role === 'sportchef' || role === 'admin' || role === 'superadmin',
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
