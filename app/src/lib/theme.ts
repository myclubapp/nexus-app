import type { ClubSettings } from './database.types';

/** Die Farbrollen, die ein Verein selbst bestimmen darf. */
export type ThemeRole = 'primary' | 'secondary' | 'tertiary';

/**
 * Die Basisfarben aus `src/theme/variables.css` – der Stand ohne eigenes
 * Vereins-Theme, übernommen aus der bestehenden myclub-App. Sie stehen hier,
 * weil die Vereinseinstellungen sie als Vorbelegung des Farbwählers brauchen:
 * ein Hex-Wert in einer Komponente wäre eine dritte Stelle. `theme.test.ts`
 * hält diese Werte und das Stylesheet zusammen.
 */
export const BASE_THEME: Record<ThemeRole, string> = {
  primary: '#339bde',
  secondary: '#795deb',
  tertiary: '#5260ff',
};

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
function setIonicColor(root: HTMLElement, role: ThemeRole, hex: string): void {
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

const MANAGED_PROPERTIES = (Object.keys(BASE_THEME) as ThemeRole[]).flatMap(
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
 * Das Kontrastverhältnis zweier Farben nach WCAG.
 *
 * Reine Rechnung, damit sie prüfbar ist: 1 heisst «nicht zu unterscheiden»,
 * 21 ist Schwarz auf Weiss.
 */
export function contrastRatio(hex: string, against: string): number | null {
  const a = hexToRgb(hex);
  const b = hexToRgb(against);
  if (!a || !b) return null;

  const light = Math.max(luminance(a), luminance(b));
  const dark = Math.min(luminance(a), luminance(b));
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

/**
 * Der Grenzwert aus A5.
 *
 * 4.5:1 ist WCAG AA für gewöhnlichen Text. Die Spezifikation nennt keinen Wert;
 * dieser ist der, an dem sich Bedienhilfen messen lassen.
 */
export const MIN_CONTRAST = 4.5;

/**
 * Reicht der Kontrast dieser Vereinsfarbe (A5)?
 *
 * Gemessen wird gegen die Schrift, die Ionic darauf setzt – dieselbe
 * Entscheidung wie in `setIonicColor()`. Eine Farbe, auf der weder Schwarz noch
 * Weiss lesbar ist, gibt es nicht; die Frage ist, ob die **gewählte** reicht.
 */
export function hasEnoughContrast(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;

  const contrast = luminance(rgb) > 0.45 ? '#000000' : '#ffffff';
  return (contrastRatio(hex, contrast) ?? MIN_CONTRAST) >= MIN_CONTRAST;
}

/**
 * Ein kontrastreicherer Vorschlag zu einer zu blassen Farbe (A5, Schritt 1).
 *
 * Abgedunkelt oder aufgehellt in Richtung der Seite, auf der mehr Kontrast
 * liegt – in Schritten, bis der Grenzwert erreicht ist. Gibt `null` zurück,
 * wenn die Farbe bereits reicht: Ein Vorschlag ohne Anlass wäre eine
 * Bevormundung.
 */
export function suggestContrast(hex: string): string | null {
  const rgb = hexToRgb(hex);
  if (!rgb || hasEnoughContrast(hex)) return null;

  // Helle Töne werden dunkler, dunkle heller – die Richtung, in der die
  // Schriftfarbe kippt, wäre die falsche.
  const target = luminance(rgb) > 0.45 ? BLACK : WHITE;

  let current = rgb;
  for (let step = 0; step < 20; step += 1) {
    current = mix(current, target, 0.08);
    const candidate = toHex(current);
    if (hasEnoughContrast(candidate)) return candidate;
  }
  return toHex(current);
}

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
