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
import type { Tables as Row } from './database.generated';

export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';

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
  /** UC-022 A3: Anzeige auf die vorderen Ränge begrenzen. */
  leaderboard?: {
    topOnly?: number;
  };
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

/** `invites` – `revoked_at` trägt den Widerruf (BR-012). */
export type Invite = Row<'invites'>;

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

/** `news_sources` – die verbundene Vereins-Website (UC-038). */
export type NewsSource = Row<'news_sources'>;

/** `news_sources.last_status` – Constraint aus `0022_news_sources.sql`. */
export type NewsSyncStatus = 'ok' | 'error';

export type Notification = Row<'notifications'>;
// Die Sicht `leaderboard` ist mit `0039` gewichen: Die Rangfolge steht nur
// noch in `leaderboard_rows()`, damit es nicht zwei Beschreibungen derselben
// Sache gibt. Die Zeilenform liegt in `src/lib/leaderboard.ts`.
