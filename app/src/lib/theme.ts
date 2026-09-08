import type { ClubSettings } from './database.types';

type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb | null {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  const part = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

function mix(color: Rgb, target: Rgb, amount: number): Rgb {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

/**
 * Relative Luminanz nach WCAG – entscheidet, ob Text auf der Vereinsfarbe
 * schwarz oder weiss sein muss. Ohne das wird ein heller Vereinston unlesbar.
 */
function luminance({ r, g, b }: Rgb): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * Schreibt eine Ionic-Farbrolle vollständig (Basis, RGB, Kontrast, Shade,
 * Tint) auf das Wurzelelement.
 */
function setIonicColor(
  root: HTMLElement,
  role: 'primary' | 'secondary' | 'tertiary',
  hex: string,
): void {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    console.warn(`[theme] "${hex}" ist keine gültige Farbe für ${role}.`);
    return;
  }
  const contrast = luminance(rgb) > 0.45 ? BLACK : WHITE;
  const shade = mix(rgb, BLACK, 0.12);
  const tint = mix(rgb, WHITE, 0.1);

  root.style.setProperty(`--ion-color-${role}`, toHex(rgb));
  root.style.setProperty(`--ion-color-${role}-rgb`, `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  root.style.setProperty(`--ion-color-${role}-contrast`, toHex(contrast));
  root.style.setProperty(
    `--ion-color-${role}-contrast-rgb`,
    `${contrast.r}, ${contrast.g}, ${contrast.b}`,
  );
  root.style.setProperty(`--ion-color-${role}-shade`, toHex(shade));
  root.style.setProperty(`--ion-color-${role}-tint`, toHex(tint));
}

const MANAGED_PROPERTIES = (['primary', 'secondary', 'tertiary'] as const).flatMap(
  (role) => [
    `--ion-color-${role}`,
    `--ion-color-${role}-rgb`,
    `--ion-color-${role}-contrast`,
    `--ion-color-${role}-contrast-rgb`,
    `--ion-color-${role}-shade`,
    `--ion-color-${role}-tint`,
  ],
);

/**
 * Wendet das Vereins-Theme zur Laufzeit an. Wird beim Vereinswechsel erneut
 * aufgerufen; vorher werden die alten Werte entfernt, damit ein Verein ohne
 * eigenes Theme wieder auf die Basisfarben aus variables.css zurückfällt.
 */
export function applyClubTheme(settings: ClubSettings | null | undefined): void {
  const root = document.documentElement;
  for (const property of MANAGED_PROPERTIES) {
    root.style.removeProperty(property);
  }

  const theme = settings?.theme;
  if (!theme) return;

  if (theme.primary) setIonicColor(root, 'primary', theme.primary);
  if (theme.secondary) setIonicColor(root, 'secondary', theme.secondary);
  if (theme.tertiary) setIonicColor(root, 'tertiary', theme.tertiary);
}
