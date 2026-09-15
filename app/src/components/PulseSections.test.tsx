import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/utils';
import { PulseSections } from './PulseSections';
import type { PulseGreeting, PulseItem, PulseSection } from '../lib/pulse';

/**
 * Der Inhalt eines Vereins-Pulses in der App (UC-027 A4, UC-050).
 *
 * Geprüft wird, was die Regeln zusagen: die Reihenfolge der drei Fragen
 * (BR-113), der Gruss am Fuss mit seinem Rückfall auf den Vorstand (A2) und
 * dass ein Beitrag von der Website als solcher erkennbar ist (A7).
 */

function item(overrides: Partial<PulseItem> = {}): PulseItem {
  return { kind: 'event', id: 'e-1', title: 'Heimspiel', at: null, detail: null, ...overrides };
}

function sections(overrides: Partial<Record<PulseSection, PulseItem[]>> = {}) {
  return {
    happening: [item()],
    workingOn: [item({ kind: 'decision', id: 'd-1', title: 'Antwort zum Hallenplan' })],
    joinIn: [item({ kind: 'shift', id: 's-1', title: 'Kuchenbuffet' })],
    ...overrides,
  } as Record<PulseSection, PulseItem[]>;
}

const greeting: PulseGreeting = {
  text: 'Herzlich, dein Vorstand',
  office: 'Präsidium',
  names: ['Anna Beispiel'],
  imageUrl: 'https://cdn.test/anna.jpg',
};

describe('PulseSections', () => {
  it('BR-113: nennt die drei Fragen in fester Reihenfolge', () => {
    const { container } = renderWithProviders(<PulseSections sections={sections()} />);
    const headings = [...container.querySelectorAll('ion-list-header')].map(
      (node) => node.textContent ?? '',
    );
    expect(headings).toEqual(['Was passiert', 'Woran wir arbeiten', 'Wo du dabei sein kannst']);
  });

  it('lässt einen leeren Abschnitt ganz weg', async () => {
    const { findByText, queryByText } = renderWithProviders(
      <PulseSections sections={sections({ workingOn: [], joinIn: [] })} />,
    );
    // `findByText` und nicht `queryByText`: Die Ionic-Elemente setzen ihren
    // Inhalt erst nach der Hydration, und die braucht einen Tick. Eine
    // synchrone Abfrage prüft sonst ein Blatt, das es noch nicht gibt.
    expect(await findByText('Was passiert')).toBeTruthy();
    expect(queryByText('Woran wir arbeiten')).toBeNull();
  });

  it('stellt die Einleitung des Vorstands vor die Abschnitte', () => {
    const { getByText } = renderWithProviders(
      <PulseSections intro="Zwei Wochen, viel zu tun." sections={sections()} />,
    );
    expect(getByText('Zwei Wochen, viel zu tun.')).toBeTruthy();
  });

  it('A7: ein Beitrag von der Website führt hinaus und sagt es', () => {
    const { container, getByText } = renderWithProviders(
      <PulseSections
        sections={sections({
          happening: [
            item({
              kind: 'news',
              id: 'n-1',
              title: 'Bericht vom Turnier',
              url: 'https://verein.test/bericht',
            }),
          ],
        })}
      />,
    );
    const link = container.querySelector('ion-item[href="https://verein.test/bericht"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(getByText(/auf der Website/)).toBeTruthy();
  });

  it('lässt einen Eintrag ohne fremde Adresse in der App', () => {
    const { container } = renderWithProviders(
      <PulseSections sections={sections({ happening: [item({ kind: 'news', id: 'n-2' })] })} />,
    );
    expect(container.querySelector('ion-item[href]')).toBeNull();
  });

  it('FR-191: zeigt den Gruss mit Name, Amt und Porträt', () => {
    const { getByText, container } = renderWithProviders(
      <PulseSections sections={sections()} greeting={greeting} />,
    );
    expect(getByText('Herzlich, dein Vorstand')).toBeTruthy();
    expect(getByText('Anna Beispiel')).toBeTruthy();
    expect(getByText(/Präsidium/)).toBeTruthy();
    expect(container.querySelector('img.app-greeting-portrait')).not.toBeNull();
  });

  it('A2: ein vakantes Amt grüsst als Vorstand, ohne Porträt', () => {
    const { getByText, container } = renderWithProviders(
      <PulseSections sections={sections()} greeting={{ ...greeting, names: [] }} />,
    );
    expect(getByText('Der Vorstand')).toBeTruthy();
    expect(container.querySelector('img.app-greeting-portrait')).toBeNull();
  });

  it('A1: ohne Hinterlegung steht kein Gruss und kein Platzhalter', () => {
    const { queryByText } = renderWithProviders(<PulseSections sections={sections()} />);
    expect(queryByText('Grussformel')).toBeNull();
    expect(queryByText('Der Vorstand')).toBeNull();
  });

  it('BR-253: eine unsichere Bildadresse kommt nicht ins Blatt', () => {
    const { container, getByText } = renderWithProviders(
      <PulseSections
        sections={sections()}
        greeting={{ ...greeting, imageUrl: 'http://cdn.test/unsicher.jpg' }}
      />,
    );
    expect(container.querySelector('img.app-greeting-portrait')).toBeNull();
    // Der Gruss selbst bleibt – nur das Bild fällt weg.
    expect(getByText('Anna Beispiel')).toBeTruthy();
  });
});
