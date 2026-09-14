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
import type { Language } from '../i18n';

export type {
  CompositeTypes,
  Database,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated';

/**
 * Eine Zeile von `export_members()` (0082).
 *
 * Handgepflegt, obwohl der Generator die Funktion kennt: Er gibt für die
 * Rückgabe einer `returns table`-Funktion die Spalten einzeln und ohne die
 * Aufzählungen dahinter. Diese Form ist die, mit der `lib/memberExport.ts`
 * rechnet.
 */
export type MemberExportRecord = {
  member_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  role: string;
  status: string;
  member_since: string | null;
  teams: string | null;
  offices: string | null;
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
 * `events.type` – Constraint aus `0003_agenda.sql`, zuletzt verengt in
 * `0072`: `cup` und `tournament` sind weg, ein Wettbewerb ist ein `match`.
 * Die Beschriftung kommt immer aus `clubs.settings.labels` über
 * `useClub().eventLabel()`, nie aus einem festen Sportvokabular.
 */
export type EventType =
  | 'training'
  | 'match'
  | 'gv'
  | 'social'
  | 'helper'
  // Seit UC-031: die Sitzung. Sie ist ein Termin wie jeder andere – mit
  // Einladung, Zu- und Absage –, nur geht ihre Einladung an Ämter (FR-095).
  | 'meeting';

/**
 * Die zuschaltbaren Module – dieselben Namen wie `module_enabled()` in `0052`.
 *
 * Agenda, Einladungen und Punkte fehlen mit Absicht: Sie sind kein Modul,
 * sondern das, womit ein Verein startet (K7).
 */
export const CLUB_MODULES = [
  'voice',
  'meeting',
  'checkin',
  'pulse',
  'health',
  // Seit UC-036: der Rechnungsdienst. A4 verlangt, dass der Bereich ohne ihn
  // **vollständig** verschwindet.
  'invoice',
  // Seit UC-042: das Saisonziel für den Beitrag. Voreinstellung aus (BR-199) –
  // der MVP-Schnitt kennt kein Soll, dies ist die Ausbaustufe.
  'goal',
] as const;
export type ClubModule = (typeof CLUB_MODULES)[number];

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
  /**
   * Vereinseigene Begriffe je Terminart, z.B. «Probe» statt «Training» – und
   * **je Sprache** (BR-148). Ein Verein, der «Probe» sagt, sagt auf
   * Französisch «répétition»; ein einzelnes Wort für alle vier Sprachen war
   * die Lücke, die UC-034 geschlossen hat (`0052`).
   */
  labels?: Partial<Record<EventType, Partial<Record<Language, string>>>>;
  /** Die Adresse des Vereinslogos (FR-111). */
  logoUrl?: string;
  /**
   * Die zuschaltbaren Module (FR-115).
   *
   * Fehlt ein Eintrag, ist das Modul **aus** – anders als bei jeder anderen
   * Einstellung dieser App. K7 verlangt den Zero-Config-Start; ein Modul, das
   * ungefragt da ist, wäre keine progressive Aktivierung (BR-150).
   */
  modules?: Partial<Record<ClubModule, boolean>>;
  /** Die Vereins-DNA (FR-114, K6c). */
  dna?: {
    why?: string;
    values?: string;
    tone?: string;
    traditions?: string;
  };
  /**
   * UC-042: das Saisonziel für den Beitrag, in Punkten derselben Skala wie
   * alle Regeln. Fehlt die Zahl, zeigt die Übersicht nur das Ist – eine Ampel
   * ohne Massstab gibt es nicht (A2).
   */
  goal?: {
    seasonPoints?: number;
  };
  /** UC-022 A3: Anzeige auf die vorderen Ränge begrenzen. */
  leaderboard?: {
    topOnly?: number;
    /** Konzept §7.2: Ränge ohne Punktzahl – die Reihenfolge bleibt, die Zahl fällt weg. */
    hidePoints?: boolean;
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
/**
 * Seit `0059` auch `sportchef` (Vision §4): führt einen **Bereich**, nicht den
 * Verein. Nicht über eine Einladung vergeben, sondern im Mitglied-Detail.
 */
export type MemberRole = InviteRole | 'sportchef' | 'superadmin';

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

/**
 * `news_sources.api_style` – Constraint aus `0048_news_source_settings.sql`.
 * Wie die WordPress-Schnittstelle erreichbar ist: `pretty` unter `/wp-json/`,
 * `query` über `?rest_route=` für Websites ohne sprechende Adressen.
 */
export type ApiStyle = 'pretty' | 'query';

export type Notification = Row<'notifications'>;
// Die Sicht `leaderboard` ist mit `0039` gewichen: Die Rangfolge steht nur
// noch in `leaderboard_rows()`, damit es nicht zwei Beschreibungen derselben
// Sache gibt. Die Zeilenform liegt in `src/lib/leaderboard.ts`.

// --- Rechnungsstellung (UC-046, UC-047) ------------------------------------

export type InvoiceCreditor = Row<'invoice_creditors'>;
export type InvoiceFeeItem = Row<'invoice_fee_items'>;
export type InvoicePeriod = Row<'invoice_periods'>;
export type InvoicePosition = Row<'invoice_positions'>;

/** `invoices.status` – Constraint aus `0087_invoicing.sql`. */
export type InvoiceState = 'draft' | 'sent' | 'paid' | 'cancelled';

export type Invoice = Omit<Row<'invoices'>, 'status'> & { status: InvoiceState };
