import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { elementBlocks, openingTags, sourceFiles } from '../test/source';

/**
 * Zur Karte über der Seite gehört, dass sie sich wegwischen lässt – und wo
 * dabei Eingaben verloren gingen, fängt `canDismiss` die Geste ab
 * (guidelines.md §2). Die Regel lässt sich nur an der Quelle prüfen: `IonModal`
 * rendert seinen Inhalt in jsdom nicht (docs/TESTING.md).
 */

/** Bedienelemente, deren Inhalt beim Wegwischen wirklich verloren geht. */
const TEXT_ENTRY = ['IonInput', 'IonTextarea'];

/**
 * Blätter mit Eingabefeld, die bewusst **ohne** Wächter auskommen.
 *
 * `DeleteAccountModal` verlangt ein getipptes Wort, bevor das Konto fällt.
 * Wegwischen ist dort der ungefährliche Ausgang und soll leicht bleiben; eine
 * Rückfrage stünde dem Rückzug aus einer zerstörerischen Handlung im Weg.
 */
const WITHOUT_GUARD = ['src/components/DeleteAccountModal.tsx'];

describe('Wächter gegen versehentliches Wegwischen', () => {
  it('sitzt in der Hülle jeder Erfassung', () => {
    // FormModal trägt ihn für alle Formulare der App; fiele er hier weg,
    // stünde jedes einzelne Blatt ungeschützt da.
    const tags = openingTags(readFileSync('src/components/FormModal.tsx', 'utf8'), 'IonModal');

    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('canDismiss={guard.canDismiss}');
  });

  it('gilt für jedes Blatt, in dem sich etwas eintippen lässt', () => {
    // Geprüft wird das einzelne Blatt, nicht die Datei: `InvitePage` hält ein
    // Formular in einem `FormModal` und daneben ein reines Anzeige-Blatt.
    for (const path of sourceFiles('src')) {
      if (WITHOUT_GUARD.includes(path)) continue;

      for (const block of elementBlocks(readFileSync(path, 'utf8'), 'IonModal')) {
        const takesText = TEXT_ENTRY.some(
          (element) => openingTags(block, element).length > 0,
        );
        if (!takesText) continue;

        expect(
          block,
          `${path} lässt sich mit Text darin wegwischen, ohne zu fragen`,
        ).toContain('canDismiss=');
      }
    }
  });

  it('führt auch den Abbrechen-Knopf durch den Wächter', () => {
    // Ein `onClick={onDismiss}` ginge an Ionic vorbei: Die Seite setzte
    // `isOpen={false}`, Ionic schlösse ohne Rolle – und der Entwurf wäre
    // wortlos weg, während die Wischgeste daneben noch fragt.
    const source = readFileSync('src/components/FormModal.tsx', 'utf8');

    expect(source).toContain("dismiss(undefined, 'cancel')");
    expect(source).not.toMatch(/onClick=\{onDismiss\}/);
  });

  it('trennt das Anzeige-Blatt vom Formular derselben Seite', () => {
    // Die Probe aufs Exempel für die Zerlegung oben: `InvitePage` hält beides.
    // Griffe `elementBlocks` zu weit, zöge es die Felder des `FormModal` in das
    // Anzeige-Blatt – die Regel würde dort einen Wächter verlangen, den es
    // nicht braucht, und wäre für echte Fälle sofort abgeschaltet.
    const source = readFileSync('src/pages/club/InvitePage.tsx', 'utf8');
    const blocks = elementBlocks(source, 'IonModal');

    expect(blocks).toHaveLength(1);
    expect(openingTags(source, 'IonInput').length).toBeGreaterThan(0);
    expect(openingTags(blocks[0], 'IonInput')).toHaveLength(0);
  });

  it('erkennt ein ungeschütztes Blatt', () => {
    // Ohne diese Probe liefe die Regel oben ins Leere, sobald sie kein Blatt
    // mit Eingabefeld mehr findet: ein grüner Test, der nichts mehr prüft.
    const [block] = elementBlocks(
      `<IonModal isOpen={isOpen}><IonInput value={text} /></IonModal>`,
      'IonModal',
    );

    expect(openingTags(block, 'IonInput')).toHaveLength(1);
    expect(block).not.toContain('canDismiss=');
  });

  it('nennt keine Ausnahme, die es nicht mehr gibt', () => {
    // Eine Ausnahme, deren Datei verschwunden ist, verdeckt die Regel für die
    // nächste Datei, die zufällig so heisst.
    for (const path of WITHOUT_GUARD) {
      expect(sourceFiles('src')).toContain(path);
    }
  });
});
