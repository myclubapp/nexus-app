import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { openingTags, sourceFiles } from '../test/source';

/**
 * Ein Blatt, das erst beim Öffnen entsteht, fällt erst nach dem Schliessen
 * (guidelines.md §2). Zwei Regeln lassen sich nur an der Quelle prüfen –
 * `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md):
 *
 * - Kein `FormModal` trägt ein nacktes `isOpen`. Ein Blatt, das mit `true`
 *   in den Baum kommt, kann nur noch durch Abbau verschwinden – und Ionic
 *   nimmt es dann ohne Übergang heraus, die Seite darunter bleibt in der
 *   Karten-Stellung stehen.
 * - Keine Seite hängt einen Blatt-Inhalt hinter `{x && <…>}` ein. Die Hülle
 *   mit `useSheetProps` gehört zur Komponente, nicht zur Seite.
 */
describe('Lebensdauer eines Blattes', () => {
  it('kein FormModal steht fest auf isOpen', () => {
    for (const path of sourceFiles('src')) {
      for (const tag of openingTags(readFileSync(path, 'utf8'), 'FormModal')) {
        expect(
          tag,
          `${path} öffnet ein FormModal mit nacktem isOpen – es kann dann nur noch abgebaut werden`,
        ).not.toMatch(/(?<=\s)isOpen(?=\s|>)/);
      }
    }
  });

  it('jeder Inhalt mit eigener Hülle wird nur über die Hülle eingehängt', () => {
    // Die Inhalts-Komponenten, deren Datei eine Hülle über `useSheetProps` hat.
    const contents = sourceFiles('src/components')
      .filter((path) => readFileSync(path, 'utf8').includes('useSheetProps('))
      .flatMap((path) =>
        Array.from(
          readFileSync(path, 'utf8').matchAll(/^export function (\w+)\(/gm),
          (match) => match[1],
        ).filter((name) => !name.endsWith('Modal')),
      );

    expect(contents.length).toBeGreaterThan(0);

    for (const path of sourceFiles('src/pages')) {
      const source = readFileSync(path, 'utf8');
      for (const name of contents) {
        expect(
          source,
          `${path} hängt <${name}> direkt ein statt über seine Blatt-Hülle`,
        ).not.toMatch(new RegExp(`<${name}[\\s/>]`));
      }
    }
  });
});
