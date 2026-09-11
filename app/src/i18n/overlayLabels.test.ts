import { describe, expect, it } from 'vitest';
import { tagsInSources } from '../test/source';

/**
 * Ionic beschriftet einige Bedienelemente selbst – und zwar englisch.
 * `ion-select` setzt `cancelText: 'Cancel'` und `okText: 'OK'` als Vorgabe; in
 * einer viersprachigen App steht dann mitten im deutschen Blatt «Cancel».
 *
 * `npm run i18n:check` sieht das nicht: Diese Vorgaben stecken in Ionic, nicht
 * in unseren Sprachdateien. Die Regel hängt deshalb hier (guidelines.md §8).
 */
const REQUIRED_LABELS: { element: string; props: string[]; onlyIf?: string }[] = [
  // Das Alert-Blatt einer Auswahl: links Abbrechen, rechts OK.
  { element: 'IonSelect', props: ['cancelText', 'okText'] },
  // Nur mit sichtbarem Abbrechen-Knopf trägt die Beschriftung überhaupt.
  { element: 'IonSearchbar', props: ['cancelButtonText'], onlyIf: 'showCancelButton' },
  // Ohne `text` steht im iOS-Modus «Back» in der Kopfzeile.
  { element: 'IonBackButton', props: ['text'] },
];

describe('Beschriftungen, die Ionic mitbringt', () => {
  for (const { element, props, onlyIf } of REQUIRED_LABELS) {
    for (const prop of props) {
      it(`${element} setzt ${prop}`, () => {
        const missing = tagsInSources(element)
          .filter(({ tag }) => (onlyIf ? tag.includes(onlyIf) : true))
          .filter(({ tag }) => !tag.includes(`${prop}=`))
          .map(({ path }) => path);

        expect(missing).toEqual([]);
      });
    }
  }

  it('nimmt die Beschriftung der Auswahl-Blätter aus den Sprachdateien', () => {
    // Gegenprobe: Ein hart gesetztes «OK» wäre genauso falsch wie gar keine
    // Beschriftung – es bliebe in allen vier Sprachen stehen.
    const tags = tagsInSources('IonSelect');

    expect(tags.length).toBeGreaterThan(0);
    for (const { path, tag } of tags) {
      expect(tag, path).toContain("cancelText={t('common.cancel')}");
      expect(tag, path).toContain("okText={t('common.ok')}");
    }
  });
});
