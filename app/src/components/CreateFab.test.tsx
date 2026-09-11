import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { addOutline, peopleOutline } from 'ionicons/icons';
import { CreateFab } from './CreateFab';
import { renderWithProviders } from '../test/utils';
import { openingTags, sourceFiles } from '../test/source';

/**
 * `ion-fab-button` hat in jsdom keine ARIA-Rolle (docs/TESTING.md §1).
 * Gesucht wird deshalb über die Beschriftung für Bedienhilfen – die zugleich
 * das ist, was ein Screenreader vorliest.
 */
function fabButton(container: HTMLElement, label: string): Element | null {
  return container.querySelector(`ion-fab-button[aria-label="${label}"]`);
}

describe('CreateFab', () => {
  it('löst einen einzelnen Weg direkt aus', () => {
    const onClick = vi.fn();
    const { container } = renderWithProviders(
      <CreateFab actions={[{ icon: addOutline, label: 'Neuer Termin', onClick }]} />,
    );

    // Kein Aufklappen: ein Knopf, und er trägt den Namen der Aktion.
    expect(container.querySelectorAll('ion-fab-button')).toHaveLength(1);
    expect(container.querySelector('ion-fab-list')).toBeNull();

    fireEvent.click(fabButton(container, 'Neuer Termin')!);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('klappt mehrere Wege aus demselben Plus auf', () => {
    const event = vi.fn();
    const helper = vi.fn();
    const { container } = renderWithProviders(
      <CreateFab
        actions={[
          { icon: addOutline, label: 'Neuer Termin', onClick: event },
          { icon: peopleOutline, label: 'Helferaufruf', onClick: helper },
        ]}
      />,
    );

    // Das Plus heisst dann nicht mehr nach einer Aktion, sondern öffnet die
    // Liste; die Wege stehen darin.
    const list = container.querySelector('ion-fab-list');
    expect(list?.querySelectorAll('ion-fab-button')).toHaveLength(2);
    expect(fabButton(container, 'Erstellen')).not.toBeNull();

    fireEvent.click(fabButton(container, 'Helferaufruf')!);
    expect(helper).toHaveBeenCalledTimes(1);
    expect(event).not.toHaveBeenCalled();
  });

  it('rendert ohne Aktion nichts', () => {
    const { container } = renderWithProviders(<CreateFab actions={[]} />);

    expect(container.querySelector('ion-fab')).toBeNull();
  });
});

/**
 * Neues entsteht überall an derselben Stelle: als Plus unten rechts, nie als
 * Symbol in der Kopfzeile (guidelines.md §2). Die Regel ist nur so viel wert,
 * wie sie beim nächsten Bildschirm noch gilt – deshalb prüft sie ein Test und
 * nicht das Gedächtnis der Reviewerin.
 *
 * Geprüft wird an der Quelle, nicht am DOM: `IonFab` und `IonFabList` sind in
 * Ionic 9 über `@lit/react` gebaut, und dessen Node-Variante setzt die
 * Eigenschaften gar nicht erst (docs/TESTING.md §1). `vertical` bliebe in
 * jsdom `undefined`, `side` läse Stencils Vorgabe `bottom` – beides sagt
 * nichts über die App aus.
 */
describe('Erstellen-Aktionen', () => {
  /** Der Inhalt von `prop={…}` im Tag, mit ausgeglichenen Klammern. */
  function propValue(tag: string, prop: string): string | null {
    const start = tag.indexOf(`${prop}={`);
    if (start === -1) return null;

    const from = tag.indexOf('{', start);
    let depth = 0;
    for (let index = from; index < tag.length; index += 1) {
      if (tag[index] === '{') depth += 1;
      else if (tag[index] === '}') {
        depth -= 1;
        if (depth === 0) return tag.slice(from + 1, index);
      }
    }
    return null;
  }

  const fabSources = sourceFiles('src').filter(
    (path) => openingTags(readFileSync(path, 'utf8'), 'IonFab').length > 0,
  );

  it('baut den runden Knopf nur an einer Stelle', () => {
    expect(fabSources).toEqual(['src/components/CreateFab.tsx']);
  });

  it('setzt ihn unten rechts über den Inhalt', () => {
    const source = readFileSync('src/components/CreateFab.tsx', 'utf8');
    const [fab] = openingTags(source, 'IonFab');
    const [list] = openingTags(source, 'IonFabList');

    expect(fab).toContain('slot="fixed"');
    expect(fab).toContain('vertical="bottom"');
    expect(fab).toContain('horizontal="end"');
    // Nach oben, sonst schöbe sich die Liste unter den Bildschirmrand.
    expect(list).toContain('side="top"');
  });

  it('hält kein Plus und keinen Stift in der Kopfzeile', () => {
    for (const path of sourceFiles('src')) {
      for (const tag of openingTags(readFileSync(path, 'utf8'), 'AppPage')) {
        const toolbarEnd = propValue(tag, 'toolbarEnd');
        if (toolbarEnd === null) continue;

        expect(toolbarEnd, path).not.toMatch(/\badd(Outline|Circle)?\b|\bcreateOutline\b/);
      }
    }
  });
});
