import { describe, expect, it } from 'vitest';
import { SAMPLE_KINDS, canActOn, isSample } from './sample';

/**
 * UC-037 steht auf zwei Sätzen. **BR-160: «Beispielinhalte sind immer
 * gekennzeichnet»** – ein Beispiel, das aussieht wie ein echter Vereinsinhalt,
 * erzeugt eine Erwartung, die niemand einlöst. Und **BR-161: «Beispiele sind
 * folgenlos»** – daraus folgt A2: mitmachen kann man an ihnen nicht.
 */
describe('SAMPLE_KINDS', () => {
  it('führt genau die drei Arten, die als Beispiel entstehen', () => {
    // Dieselben Werte nimmt `adopt_sample()` in `0053` entgegen.
    expect([...SAMPLE_KINDS]).toEqual(['event', 'task', 'news']);
  });
});

describe('isSample', () => {
  it('erkennt die Kennzeichnung', () => {
    expect(isSample({ is_sample: true })).toBe(true);
    expect(isSample({ is_sample: false })).toBe(false);
  });

  it('hält alles andere für einen echten Inhalt', () => {
    // Ein fehlendes Feld darf nie zu «Beispiel» führen: Sonst trüge ein echter
    // Vereinsinhalt das Abzeichen – und das wäre schlimmer als andersherum.
    expect(isSample({})).toBe(false);
    expect(isSample(null)).toBe(false);
    expect(isSample(undefined)).toBe(false);
    expect(isSample({ is_sample: null })).toBe(false);
  });
});

describe('canActOn', () => {
  it('lässt an echten Inhalten mitmachen', () => {
    expect(canActOn({ is_sample: false })).toBe(true);
    expect(canActOn({})).toBe(true);
  });

  it('sperrt das Mitmachen an einem Beispiel (A2)', () => {
    // Eine Zusage zu einem erfundenen Termin wäre eine Verabredung mit
    // niemandem. Gesperrt ist es am Server; hier entscheidet es nur, ob ein
    // Knopf erscheint.
    expect(canActOn({ is_sample: true })).toBe(false);
  });

  it('ist das Gegenteil von `isSample` – und bleibt es', () => {
    for (const row of [{ is_sample: true }, { is_sample: false }, {}, null]) {
      expect(canActOn(row)).toBe(!isSample(row));
    }
  });
});
