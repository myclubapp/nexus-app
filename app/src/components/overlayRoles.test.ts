import { describe, expect, it } from 'vitest';
import { tagsInSources } from '../test/source';

/**
 * Die Farbe eines Knopfes in `IonAlert` und `IonActionSheet` entsteht aus
 * seiner Rolle, nicht aus einem `color`-Attribut: Ionic färbt
 * `role: 'destructive'` im iOS-Modus über `--ion-color-danger` rot und lässt
 * alles andere in der Vereinsfarbe stehen. Wer die Rolle vergisst, bekommt
 * einen Abbrechen-Knopf, der aussieht wie die Hauptaktion – und ein Löschen,
 * das aussieht wie ein Speichern (guidelines.md §2 und §6).
 */
const OVERLAYS = ['IonAlert', 'IonActionSheet'];

describe('Rollen in Alerts und Action Sheets', () => {
  for (const element of OVERLAYS) {
    it(`${element} hat genau einen Knopf mit role: 'cancel'`, () => {
      const tags = tagsInSources(element);

      expect(tags.length).toBeGreaterThan(0);
      for (const { path, tag } of tags) {
        const cancels = tag.match(/role: 'cancel'/g) ?? [];
        expect(cancels.length, path).toBe(1);
      }
    });
  }

  it('färbt Abbrechen nicht von Hand', () => {
    // Farben kommen aus Tokens, und für Overlay-Knöpfe heisst das: über die
    // Rolle. Ein eigenes `color:` im Knopf bräche das Vereins-Theming.
    for (const element of OVERLAYS) {
      for (const { path, tag } of tagsInSources(element)) {
        expect(tag, path).not.toMatch(/role: 'cancel',\s*color:/);
      }
    }
  });
});
