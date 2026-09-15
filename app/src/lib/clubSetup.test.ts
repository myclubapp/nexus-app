import { describe, expect, it } from 'vitest';
import {
  clampStep,
  newsOffer,
  newsToggleMessageKey,
  setupSteps,
  SETUP_STEPS,
} from './clubSetup';
import { deliversNews } from './federation';

/**
 * Der Einrichtungs-Assistent (UC-051).
 *
 * Geprüft wird die Schrittliste und nicht die Ansicht: Eine Schrittführung
 * lässt sich in jsdom nur über Klicks bedienen, und `ion-segment` wie
 * `ion-toggle` melden dort nichts (docs/TESTING.md §6.4). Was den Assistenten
 * ausmacht – **wann** die Frage nach den Verbandsnews auftaucht und **wo** er
 * nach einer Änderung stehen bleibt –, entscheiden diese Funktionen.
 */
describe('setupSteps (FR-195)', () => {
  it('fragt die Verbandsnews erst, wenn ein Verband verbunden ist', () => {
    expect(setupSteps(false)).not.toContain('news');
    expect(setupSteps(true)).toContain('news');
  });

  it('stellt die Frage unmittelbar hinter den Schritt, der sie auslöst', () => {
    const steps = setupSteps(true);
    expect(steps.indexOf('news')).toBe(steps.indexOf('federation') + 1);
  });

  it('behält die Reihenfolge: Verband, Teams, Beispiele, Mitglieder', () => {
    // Der Verband zuerst, weil er die Teams mitbringt (UC-039 A1); die Teams
    // vor den Mitgliedern, weil eine Einladung ein Team benennen kann.
    expect(setupSteps(false)).toEqual(['federation', 'teams', 'samples', 'members']);
  });

  it('lässt nichts weg, was es gibt', () => {
    expect(setupSteps(true)).toEqual([...SETUP_STEPS]);
  });
});

describe('clampStep', () => {
  it('bleibt beim Schritt, solange es ihn gibt', () => {
    expect(clampStep(2, setupSteps(true))).toBe(2);
  });

  it('rutscht nicht über das Ende, wenn die Liste schrumpft', () => {
    // Der Befund, gegen den diese Klammer steht: Wer im letzten Schritt steht
    // und den Verband trennt, sähe sonst «Mitglieder» statt «Teams».
    expect(clampStep(4, setupSteps(false))).toBe(3);
  });

  it('fängt einen negativen Index ab', () => {
    expect(clampStep(-1, setupSteps(true))).toBe(0);
  });

  it('gibt bei leerer Liste den ersten Schritt zurück', () => {
    expect(clampStep(3, [])).toBe(0);
  });
});

describe('newsOffer (FR-197, BR-260)', () => {
  it('bietet den Schalter an, wo der Verband Beiträge liefert', () => {
    expect(
      newsOffer({ federation: 'swissunihockey', newsEnabled: false }, deliversNews),
    ).toBe('off');
    expect(
      newsOffer({ federation: 'swissunihockey', newsEnabled: true }, deliversNews),
    ).toBe('on');
  });

  it('nennt es beim Namen, wo es keine Beiträge gibt', () => {
    // Kein Schalter, der nichts bewirkt: Die drei übrigen Verbände haben keine
    // Schnittstelle für News, und das sagt der Schritt auch.
    for (const federation of ['swissvolley', 'swisshandball', 'swissturnverband'] as const) {
      expect(newsOffer({ federation, newsEnabled: true }, deliversNews)).toBe(
        'unavailable',
      );
    }
  });
});

describe('newsToggleMessageKey (BR-155)', () => {
  it('meldet das Abschalten', () => {
    expect(newsToggleMessageKey({ enabled: false, syncError: null })).toBe(
      'federation.newsOff',
    );
  });

  it('meldet, dass die Beiträge dastehen', () => {
    expect(newsToggleMessageKey({ enabled: true, syncError: null })).toBe(
      'federation.newsOn',
    );
  });

  it('meldet «eingeschaltet, aber noch nichts da» – und nicht «fehlgeschlagen»', () => {
    // Die Verbindung steht, nur der Abruf kam nicht durch. Ein Fehlschlag wäre
    // hier die falsche Auskunft: Der Schalter bleibt an, und der nächtliche
    // Lauf holt die Beiträge nach.
    expect(
      newsToggleMessageKey({ enabled: true, syncError: 'Der Verband antwortet mit 503' }),
    ).toBe('federation.newsPending');
  });

  it('ein abgeschalteter Schalter meldet nie einen Abgleichsfehler', () => {
    expect(
      newsToggleMessageKey({ enabled: false, syncError: 'irgendwas' }),
    ).toBe('federation.newsOff');
  });
});
