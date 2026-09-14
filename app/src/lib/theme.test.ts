import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adaptForDark,
  BASE_THEME,
  contrastRatio,
  DARK_SURFACE,
  hasEnoughContrast,
  MIN_SURFACE_CONTRAST,
  suggestContrast,
} from './theme';

const stylesheet = readFileSync('src/theme/variables.css', 'utf8');

describe('BASE_THEME', () => {
  it('stimmt mit den Farb-Tokens in variables.css überein', () => {
    // Laufen beide auseinander, zeigt der Farbwähler in den
    // Vereinseinstellungen eine andere Farbe an, als die App verwendet.
    for (const [role, hex] of Object.entries(BASE_THEME)) {
      const declared = stylesheet.match(
        new RegExp(`--ion-color-${role}:\\s*(#[0-9a-f]{6})`, 'i'),
      );
      expect(declared?.[1]?.toLowerCase(), `--ion-color-${role}`).toBe(hex);
    }
  });
});

describe('contrastRatio', () => {
  it('rechnet die Eckwerte richtig', () => {
    // Schwarz auf Weiss ist 21:1 – der höchste Wert, den es gibt.
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it('ist von der Reihenfolge unabhängig', () => {
    expect(contrastRatio('#339bde', '#ffffff')).toBe(
      contrastRatio('#ffffff', '#339bde'),
    );
  });

  it('gibt bei einer unbrauchbaren Farbe nichts zurück', () => {
    expect(contrastRatio('keine farbe', '#ffffff')).toBeNull();
  });
});

describe('hasEnoughContrast', () => {
  it('lässt einen dunklen Vereinston durch', () => {
    expect(hasEnoughContrast('#004a7c')).toBe(true);
  });

  it('meldet einen Mittelton, auf dem weder Schwarz noch Weiss trägt (A5)', () => {
    expect(hasEnoughContrast('#8fb3c9')).toBe(false);
  });

  it('hält eine unbrauchbare Eingabe nicht für einen Fehler', () => {
    // Ungültige Farben behandelt `applyClubTheme()`; hier soll kein zweiter
    // Fehlerweg entstehen.
    expect(hasEnoughContrast('kein hex')).toBe(true);
  });
});

describe('suggestContrast', () => {
  it('schlägt nichts vor, wo der Kontrast reicht', () => {
    // Ein Vorschlag ohne Anlass wäre eine Bevormundung.
    expect(suggestContrast('#004a7c')).toBeNull();
  });

  it('liefert zu einer blassen Farbe eine, die reicht (A5, Schritt 1)', () => {
    const better = suggestContrast('#8fb3c9');

    expect(better).not.toBeNull();
    expect(hasEnoughContrast(better!)).toBe(true);
  });

  it('bleibt bei der Farbfamilie', () => {
    // Abgedunkelt, nicht ersetzt: Der Verein hat seine Farbe gewählt.
    const better = suggestContrast('#8fb3c9');

    expect(better).toMatch(/^#[0-9a-f]{6}$/);
    expect(better).not.toBe('#000000');
  });
});

describe('adaptForDark', () => {
  it('lässt eine Farbe stehen, die sich vom dunklen Grund schon abhebt', () => {
    // Das Basisblau trägt auf #222428 – kein Anlass, es zu verändern.
    expect(adaptForDark('#339bde')).toBe('#339bde');
  });

  it('hellt ein dunkles Vereinsblau auf, bis es vom Grund abhebt', () => {
    const adapted = adaptForDark('#0b2a4a');

    expect(adapted).not.toBe('#0b2a4a');
    expect(contrastRatio(adapted, DARK_SURFACE)).toBeGreaterThanOrEqual(
      MIN_SURFACE_CONTRAST,
    );
  });

  it('bleibt bei der Farbfamilie', () => {
    // Aufgehellt, nicht ersetzt – und nie Weiss.
    const adapted = adaptForDark('#0b2a4a');

    expect(adapted).toMatch(/^#[0-9a-f]{6}$/);
    expect(adapted).not.toBe('#ffffff');
  });

  it('gibt eine unbrauchbare Farbe unverändert zurück', () => {
    expect(adaptForDark('kein hex')).toBe('kein hex');
  });
});
