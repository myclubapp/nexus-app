import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * FR-144: Ein leerer Bildschirm trägt ein Handlungsangebot.
 *
 * Auf einer Seite ist ein `EmptyState` ohne `action` eine Sackgasse – die
 * Erklärung sagt, dass nichts da ist, und lässt die Person dann stehen. In
 * einem Blatt (`components/`) ist das anders: Dort ist das Blatt selbst die
 * Unteransicht, und der Knopf, der weiterführt, ist der, der es schliesst.
 * Deshalb prüft der Test nur `pages/`.
 */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('EmptyState auf Seiten (FR-144)', () => {
  it('trägt überall ein Handlungsangebot', () => {
    const offenders: string[] = [];
    for (const file of walk(join(__dirname, '..', 'pages'))) {
      const source = readFileSync(file, 'utf8');
      const matches = source.matchAll(/<EmptyState\b([\s\S]*?)\/>/g);
      for (const match of matches) {
        if (!/\baction=/.test(match[1])) offenders.push(file.replace(/.*\/src\//, 'src/'));
      }
    }
    expect(offenders).toEqual([]);
  });
});
