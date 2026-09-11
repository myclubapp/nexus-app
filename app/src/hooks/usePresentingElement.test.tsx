import { readFileSync } from 'node:fs';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { sourceFiles } from '../test/source';
import { usePresentingElement } from './usePresentingElement';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('usePresentingElement', () => {
  it('findet das äussere Router-Outlet', () => {
    const outlet = document.createElement('ion-router-outlet');
    outlet.id = 'main';
    document.body.append(outlet);

    const { result } = renderHook(() => usePresentingElement());

    expect(result.current).toBe(outlet);
  });

  it('nimmt nicht das verschachtelte Outlet der Tabs', () => {
    // Das innere Outlet trägt keine Kennung. Nähme das Blatt es als Bezug,
    // bliebe der Tab-Balken vor der zurückgefahrenen Seite stehen.
    const inner = document.createElement('ion-router-outlet');
    document.body.append(inner);

    const { result } = renderHook(() => usePresentingElement());

    expect(result.current).toBeUndefined();
  });

  it('gibt ohne Outlet undefined zurück', () => {
    // Ionic fällt dann auf die Vollbild-Darstellung zurück, statt zu brechen.
    const { result } = renderHook(() => usePresentingElement());

    expect(result.current).toBeUndefined();
  });

  it('gilt für jedes Blatt in der App', () => {
    // Ein IonModal ohne presentierendes Element steht als Vollbild über der
    // App – guidelines.md §2. Die Regel lässt sich nur an der Quelle prüfen:
    // IonModal rendert seinen Inhalt in jsdom nicht (docs/TESTING.md).
    const withModal = sourceFiles('src').filter((path) =>
      readFileSync(path, 'utf8').includes('<IonModal'),
    );

    expect(withModal.length).toBeGreaterThan(0);
    for (const path of withModal) {
      expect(
        readFileSync(path, 'utf8'),
        `${path} öffnet ein Blatt ohne presentingElement`,
      ).toContain('presentingElement={presentingElement}');
    }
  });
});
