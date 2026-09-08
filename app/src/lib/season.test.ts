import { describe, expect, it } from 'vitest';
import { seasonLabel } from './season';

/**
 * Gegenstück zu `season_label()` in `0002_points.sql`. Laufen die beiden
 * auseinander, zeigt die App eine andere Saison an als die Rangliste
 * ausrechnet (NFR-035, BR-082) – deshalb prüfen diese Fälle die Grenzen.
 */
describe('seasonLabel', () => {
  it('fällt ohne Saisonstart auf das Kalenderjahr zurück', () => {
    expect(seasonLabel(null, new Date('2026-03-14T12:00:00Z'))).toBe('2026');
    expect(seasonLabel(undefined, new Date('2026-11-02T12:00:00Z'))).toBe('2026');
  });

  it('behandelt einen unlesbaren Saisonstart wie keinen', () => {
    expect(seasonLabel('kein-datum', new Date('2026-03-14T12:00:00Z'))).toBe('2026');
  });

  it('zählt ein Datum vor dem Saisonstart zur Vorsaison', () => {
    // Saisonstart 1. Juni, Datum im Mai -> noch Saison 2025/26.
    expect(seasonLabel('2020-06-01', new Date('2026-05-31T12:00:00'))).toBe('2025/26');
  });

  it('beginnt die neue Saison am Tag des Saisonstarts', () => {
    expect(seasonLabel('2020-06-01', new Date('2026-06-01T00:00:00'))).toBe('2026/27');
  });

  it('zählt ein Datum nach dem Saisonstart zur laufenden Saison', () => {
    expect(seasonLabel('2020-06-01', new Date('2026-12-24T12:00:00'))).toBe('2026/27');
  });

  it('füllt einstellige Folgejahre auf zwei Stellen auf', () => {
    // 2099/00 statt 2099/0 – sonst bricht die Sortierung nach Saisonlabel.
    expect(seasonLabel('2020-06-01', new Date('2099-07-01T12:00:00'))).toBe('2099/00');
  });
});
