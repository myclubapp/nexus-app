/**
 * Schliesst die zwei Lücken, die `@capacitor/assets` offen lässt.
 *
 * Das Werkzeug erzeugt Symbole und Startbilder für iOS und Android aus
 * `resources/`. Zwei Dinge kann es nicht, und beide holt dieses Skript nach –
 * es hängt als `postassets:generate` hinter dem Lauf:
 *
 *   1. **Das dunkle App-Symbol für iOS.** Dark-Appearance für App-Symbole gibt
 *      es erst seit iOS 18, das Werkzeug ist älter. Schlimmer: Jeder Lauf
 *      schreibt `Contents.json` neu und wirft den Eintrag wieder weg.
 *
 *   2. **Die Symbole der installierten Web-Fassung.** `capacitor-assets` legt
 *      dafür `icons/*.webp` und ein eigenes `manifest.webmanifest` an – beides
 *      unbrauchbar hier, weil `vite-plugin-pwa` das Manifest selbst schreibt
 *      und dabei die Dateinamen in `vite.config.ts` erwartet. Zwei Manifeste
 *      im Bauwerk wären ein Konflikt, deshalb läuft das Werkzeug mit
 *      `--ios --android` und die Web-Symbole entstehen hier.
 *
 * Wer das Logo austauscht, ersetzt die Quellbilder in `resources/` und lässt
 * `npm run assets:generate` laufen; alles andere geschieht von selbst.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const light = join(root, 'resources/icon.png');
const dark = join(root, 'resources/icon-dark.png');
const iconSet = join(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const catalogue = join(iconSet, 'Contents.json');
const publicDir = join(root, 'public');

for (const file of [light, dark]) {
  if (!existsSync(file)) {
    console.error(`Quellbild fehlt: ${file}`);
    process.exit(1);
  }
}

// `sips` gehört zu macOS. Fehlt es, bleibt der native Teil trotzdem stehen –
// besser ein unvollständiger Satz als ein abgebrochener Lauf.
let sips;
try {
  sips = (args) => execFileSync('sips', args, { stdio: 'ignore' });
  sips(['-g', 'format', light]);
} catch {
  console.warn('sips nicht verfügbar – dunkles App-Symbol und Web-Symbole bleiben aus.');
  process.exit(0);
}

const scale = (source, size, target) =>
  sips(['-z', String(size), String(size), source, '--out', target]);

// --- 1. Dunkles App-Symbol für iOS ----------------------------------------
scale(dark, 1024, join(iconSet, 'AppIcon-512@2x-dark.png'));

const catalogueData = JSON.parse(readFileSync(catalogue, 'utf8'));
const isDark = (image) =>
  image.appearances?.some((a) => a.appearance === 'luminosity' && a.value === 'dark');

if (!catalogueData.images.some(isDark)) {
  catalogueData.images.push({
    appearances: [{ appearance: 'luminosity', value: 'dark' }],
    idiom: 'universal',
    size: '1024x1024',
    filename: 'AppIcon-512@2x-dark.png',
    platform: 'ios',
  });
  writeFileSync(catalogue, `${JSON.stringify(catalogueData, null, 2)}\n`);
}

// --- 2. Symbole der installierten Web-Fassung ------------------------------
// Die Namen stehen so in `vite.config.ts` (Manifest und `includeAssets`).
for (const [size, name] of [
  [64, 'pwa-64x64.png'],
  [192, 'pwa-192x192.png'],
  [512, 'pwa-512x512.png'],
  [180, 'apple-touch-icon-180x180.png'],
  [96, 'favicon-96x96.png'],
]) {
  scale(light, size, join(publicDir, name));
}

// Maskierbar: 80 % Bildanteil, der Rest ist Sicherheitsrand für runde,
// tropfen- und quadratförmige Masken. Das «M» reicht im Quellbild bis an den
// Rand und würde sonst angeschnitten.
const temp = mkdtempSync(join(tmpdir(), 'nexus-icons-'));
try {
  const padded = join(temp, 'maskable.png');
  scale(light, 410, padded);
  // `--padColor` meldet die Farbe auf der Fehlerausgabe; `stdio: 'ignore'`
  // schluckt sie mit.
  sips(['-p', '512', '512', '--padColor', 'FFFFFF', padded,
    '--out', join(publicDir, 'maskable-icon-512x512.png')]);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

console.log('→ dunkles App-Symbol für iOS und Web-Symbole ergänzt');
