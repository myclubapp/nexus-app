import type { PointRule } from './database.types';

/**
 * Die sieben Säulen aus dem Gamification-Konzept.
 *
 * Die Zahl steht in `point_rules.pillar`; wie sie heisst, steht in der
 * Übersetzung unter `pointRules.pillar.<n>`.
 */
export const PILLARS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Pillar = (typeof PILLARS)[number];

/** Zeiträume einer Häufigkeitsgrenze (A5) – dieselben wie in SQL. */
export const LIMIT_PERIODS = ['day', 'week', 'month', 'season'] as const;
export type LimitPeriod = (typeof LIMIT_PERIODS)[number];

export interface RuleLimit {
  max: number | null;
  period: LimitPeriod;
}

/**
 * Häufigkeitsgrenze aus `point_rules.meta` lesen.
 *
 * `max_per_week` ist die Kurzform, die `seed_point_rules()` verwendet;
 * `max_per_period` mit `period` ist die allgemeine Form. Gegenstück zu
 * `rule_limit_reached()` in `0014_point_rules.sql` – laufen die beiden
 * auseinander, zeigt die App eine andere Grenze an, als der Server prüft.
 */
export function readRuleLimit(meta: unknown): RuleLimit {
  const record = (meta ?? {}) as Record<string, unknown>;

  const weekly = Number(record.max_per_week);
  if (Number.isFinite(weekly) && weekly > 0) {
    return { max: weekly, period: 'week' };
  }

  const general = Number(record.max_per_period);
  if (Number.isFinite(general) && general > 0) {
    const period = record.period;
    return {
      max: general,
      period: LIMIT_PERIODS.includes(period as LimitPeriod)
        ? (period as LimitPeriod)
        : 'week',
    };
  }

  return { max: null, period: 'week' };
}

/** Häufigkeitsgrenze nach `meta` schreiben; `null` entfernt sie. */
export function writeRuleLimit(meta: unknown, limit: RuleLimit): Record<string, unknown> {
  const record = { ...((meta ?? {}) as Record<string, unknown>) };
  // Immer beide Kurz- und Langform entfernen, sonst bliebe die alte stehen
  // und `rule_limit_reached()` läse zuerst die Wochenform.
  delete record.max_per_week;
  delete record.max_per_period;
  delete record.period;

  if (limit.max !== null && limit.max > 0) {
    record.max_per_period = limit.max;
    record.period = limit.period;
  }
  return record;
}

/**
 * Ist die Regel im Nur-Dank-Modus (A4, FR-040)?
 *
 * Ein Punktwert von null heisst: Der Beitrag zählt, wird aber ohne Zahl
 * gewürdigt. Die Regel bleibt aktiv – sonst verschwände der Anlass ganz.
 */
export function isThanksOnly(rule: Pick<PointRule, 'points' | 'is_active'>): boolean {
  return rule.is_active && rule.points === 0;
}

/** Regeln nach Säule gruppieren, Säulen in fester Reihenfolge (Schritt 2). */
export function groupByPillar<T extends { pillar: number }>(
  rules: readonly T[],
): { pillar: Pillar; rules: T[] }[] {
  return PILLARS.map((pillar) => ({
    pillar,
    rules: rules.filter((rule) => rule.pillar === pillar),
  })).filter((group) => group.rules.length > 0);
}

/**
 * Ist ein Regelcode im Verein noch frei (BR-064)?
 *
 * Die Datenbank hat den Unique-Index; diese Prüfung erspart der Person die
 * Fehlermeldung nach dem Absenden.
 */
export function isCodeAvailable(
  rules: readonly Pick<PointRule, 'code'>[],
  code: string,
): boolean {
  const normalised = normaliseRuleCode(code);
  return normalised.length > 0 && !rules.some((rule) => rule.code === normalised);
}

/** Technische Codes sind klein, ohne Leerzeichen und ohne Sonderzeichen. */
export function normaliseRuleCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}
