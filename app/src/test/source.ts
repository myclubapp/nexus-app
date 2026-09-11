/**
 * Quelltext-Helfer für Architekturtests.
 *
 * Ein Teil der Regeln aus `docs/guidelines.md` lässt sich nur an der Quelle
 * prüfen: `IonModal` rendert seinen Inhalt in jsdom nicht, und die
 * Beschriftungen, die Ionic selbst mitbringt, tauchen in keiner Sprachdatei
 * auf. Ein Test, der die Dateien liest, hält solche Regeln fest, ohne dass
 * jemand sie beim Review im Kopf haben muss.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Alle Quelldateien unter `dir`, ohne Tests. */
export function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) {
      return [];
    }
    return [path];
  });
}

/**
 * Die öffnenden Tags eines Elements in `source` – vom Namen bis zu dem `>`,
 * das den Tag schliesst.
 *
 * Geschweifte Klammern werden mitgezählt: Sonst beendete das `>` eines
 * Pfeilausdrucks in `onIonChange={(e) => …}` den Tag zu früh und die Prüfung
 * sähe die Eigenschaften dahinter nicht mehr.
 */
export function openingTags(source: string, element: string): string[] {
  const tags: string[] = [];
  const marker = `<${element}`;

  for (
    let start = source.indexOf(marker);
    start !== -1;
    start = source.indexOf(marker, start + 1)
  ) {
    // `<IonSelect` darf nicht auf `<IonSelectOption` passen.
    const after = source[start + marker.length];
    if (after !== undefined && /[A-Za-z0-9_]/.test(after)) continue;

    let depth = 0;
    for (let index = start + marker.length; index < source.length; index += 1) {
      const char = source[index];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        tags.push(source.slice(start, index + 1));
        break;
      }
    }
  }

  return tags;
}

/** Die öffnenden Tags eines Elements über alle Quelldateien, je mit Pfad. */
export function tagsInSources(element: string): { path: string; tag: string }[] {
  return sourceFiles('src').flatMap((path) =>
    openingTags(readFileSync(path, 'utf8'), element).map((tag) => ({ path, tag })),
  );
}

/**
 * Ein Element samt Inhalt – vom öffnenden bis zum passenden schliessenden Tag.
 *
 * `openingTags` sieht nur die Eigenschaften; für Regeln, die vom **Inhalt**
 * eines Blattes abhängen («steht hier ein Eingabefeld?»), reicht das nicht.
 * Verschachtelte gleichnamige Elemente werden mitgezählt, damit ein Blatt im
 * Blatt nicht am ersten schliessenden Tag endet.
 */
export function elementBlocks(source: string, element: string): string[] {
  const blocks: string[] = [];
  const open = `<${element}`;
  const close = `</${element}>`;

  for (
    let start = source.indexOf(open);
    start !== -1;
    start = source.indexOf(open, start + 1)
  ) {
    const after = source[start + open.length];
    if (after !== undefined && /[A-Za-z0-9_]/.test(after)) continue;

    let depth = 0;
    for (let index = start; index < source.length; ) {
      const nextOpen = source.indexOf(open, index);
      const nextClose = source.indexOf(close, index);
      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        index = nextOpen + open.length;
        continue;
      }

      depth -= 1;
      index = nextClose + close.length;
      if (depth === 0) {
        blocks.push(source.slice(start, index));
        break;
      }
    }
  }

  return blocks;
}
