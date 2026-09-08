/**
 * Handgepflegte Schicht über den generierten Supabase-Typen.
 *
 * `database.generated.ts` wird von `npm run types:generate` vollständig
 * überschrieben – dort darf nichts von Hand stehen. Alles, was die App darüber
 * hinaus braucht, gehört hierher: die Aufzählungen hinter den `text`-Spalten
 * mit check-Constraint und die Form von `clubs.settings`.
 *
 * Type-Aliase statt Interfaces: supabase-js verlangt Kompatibilität zu
 * `Record<string, unknown>`, und Interfaces bekommen in TypeScript keine
 * implizite Index-Signatur.
 */
import type { Database as Generated, Tables as Row } from './database.generated';

export type {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';

// --- Noch nicht generierte Schemaänderungen --------------------------------
// `database.generated.ts` wird aus der verknüpften Datenbank erzeugt und hinkt
// deshalb jeder frisch geschriebenen Migration hinterher. Statt die generierte
// Datei von Hand anzufassen – ein `types:generate` würde die Änderung still
// verwerfen (NFR-036) – wird sie hier überlagert.
//
// Nach dem nächsten `npm run types:generate` gegen eine Datenbank mit den
// Migrationen 0008 und 0009 sind diese Blöcke überflüssig und gehören gelöscht.

/** Ergänzungen aus `0009_invites.sql`. */
type PendingInviteColumns = {
  /** Widerruf wirkt nur nach vorne (BR-012). */
  revoked_at: string | null;
};

/** Signaturen aus `0008_club_founding.sql` und `0009_invites.sql`. */
type PendingFunctions = {
  create_club: {
    Args: {
      p_name: string;
      p_club_kind?: string;
      p_season_start?: string | null;
      p_kind_label?: string | null;
    };
    Returns: string;
  };
  /** Gibt die id des Vereins zurück, dem die Person nun angehört. */
  redeem_invite: {
    Args: { p_code: string; p_display_name?: string | null };
    Returns: string;
  };
  preview_invite: {
    Args: { p_code: string };
    Returns: {
      club_id: string | null;
      club_name: string | null;
      team_name: string | null;
      role: string | null;
      is_valid: boolean;
      reason: string | null;
    }[];
  };
};

type GeneratedPublic = Generated['public'];
type GeneratedInvites = GeneratedPublic['Tables']['invites'];

export type Database = Omit<Generated, 'public'> & {
  public: Omit<GeneratedPublic, 'Functions' | 'Tables'> & {
    Functions: Omit<GeneratedPublic['Functions'], keyof PendingFunctions> &
      PendingFunctions;
    Tables: Omit<GeneratedPublic['Tables'], 'invites'> & {
      invites: Omit<GeneratedInvites, 'Row' | 'Insert' | 'Update'> & {
        Row: GeneratedInvites['Row'] & PendingInviteColumns;
        Insert: GeneratedInvites['Insert'] & Partial<PendingInviteColumns>;
        Update: GeneratedInvites['Update'] & Partial<PendingInviteColumns>;
      };
    };
  };
};

// --- Aufzählungen ----------------------------------------------------------
// Die Datenbank hält diese Spalten als `text` mit check-Constraint, generiert
// daraus also `string`. Die Constraints stehen in den Migrationen; laufen die
// Listen auseinander, akzeptiert die App Werte, die die Datenbank ablehnt.

/** `clubs.club_kind` – Constraint aus `0001_core.sql`. */
export type ClubKind =
  | 'sport'
  | 'music'
  | 'culture'
  | 'youth'
  | 'neighborhood'
  | 'other';

/**
 * `events.type` – Constraint aus `0003_agenda.sql`. Die Beschriftung kommt
 * immer aus `clubs.settings.labels` über `useClub().eventLabel()`, nie aus
 * einem festen Sportvokabular.
 */
export type EventType =
  | 'training'
  | 'match'
  | 'cup'
  | 'tournament'
  | 'gv'
  | 'social'
  | 'helper';

/** `attendance.status` – Constraint aus `0003_agenda.sql`. */
export type AttendanceStatus = 'registered' | 'present' | 'excused' | 'absent';

// --- Vereinseinstellungen --------------------------------------------------

/**
 * `clubs.settings` ist ein `jsonb` und generiert deshalb als `Json`. Die App
 * liest daraus die Vereinsfarben (White-Label ohne Rebuild) und die
 * Begriffs-Labels.
 */
export type ClubSettings = {
  theme?: {
    primary?: string;
    secondary?: string;
    tertiary?: string;
  };
  /** Vereinseigene Begriffe je Terminart, z.B. «Probe» statt «Training». */
  labels?: Partial<Record<EventType, string>>;
};

// --- Zeilentypen -----------------------------------------------------------

/** `clubs` – `settings` wird gegenüber dem generierten `Json` verengt. */
export type Club = Omit<Row<'clubs'>, 'settings'> & {
  settings: ClubSettings | null;
};

export type ClubMember = Row<'club_members'>;

/** `events` – `type` wird auf die Terminarten verengt. */
export type AppEvent = Omit<Row<'events'>, 'type'> & {
  type: EventType;
};

export type EventShift = Row<'event_shifts'>;

/** `attendance` – `status` wird auf die erlaubten Werte verengt. */
export type Attendance = Omit<Row<'attendance'>, 'status'> & {
  status: AttendanceStatus;
};

/** `invites` – inklusive der noch nicht generierten Spalte `revoked_at`. */
export type Invite = Database['public']['Tables']['invites']['Row'];

/** Rolle, die eine Einladung vergibt – Constraint aus `0001_core.sql`. */
export type InviteRole = 'member' | 'trainer' | 'admin';

/** `club_members.role` – Constraint aus `0001_core.sql`. */
export type MemberRole = InviteRole | 'superadmin';

export type Team = Row<'teams'>;
export type PointRule = Row<'point_rules'>;
export type PointTransaction = Row<'point_transactions'>;
export type Task = Row<'tasks'>;
export type TaskAssignment = Row<'task_assignments'>;
export type News = Row<'news'>;
export type Notification = Row<'notifications'>;
export type LeaderboardRow = Row<'leaderboard'>;
