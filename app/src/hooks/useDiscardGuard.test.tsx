import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDiscardGuard } from './useDiscardGuard';

/** Ruft `canDismiss` so auf, wie Ionic es täte – als Funktion oder als Wert. */
async function dismissWith(
  canDismiss: ReturnType<typeof useDiscardGuard>['canDismiss'],
  role?: string,
) {
  return typeof canDismiss === 'function' ? canDismiss(undefined, role) : canDismiss;
}

describe('useDiscardGuard', () => {
  it('lässt ein unbeschriebenes Blatt ohne Rückfrage ziehen', () => {
    // Und zwar als Wert `true`, nicht als Funktion: Ionic bremst die Geste,
    // sobald `canDismiss !== true` ist – ein leeres Blatt bekäme sonst das
    // gebremste Gefühl, obwohl es nichts zu retten gibt.
    const { result } = renderHook(() => useDiscardGuard(true));

    expect(result.current.canDismiss).toBe(true);
    expect(result.current.isAsking).toBe(false);
  });

  it('fragt nach, sobald jemand etwas eingegeben hat', async () => {
    const { result } = renderHook(() => useDiscardGuard(true));

    act(() => result.current.markTouched());
    expect(typeof result.current.canDismiss).toBe('function');

    let dismissed: boolean | undefined;
    act(() => {
      void dismissWith(result.current.canDismiss, 'gesture').then((value) => {
        dismissed = value;
      });
    });

    expect(result.current.isAsking).toBe(true);
    expect(dismissed).toBeUndefined();
  });

  it('gibt das Blatt auf «verwerfen» frei', async () => {
    const { result } = renderHook(() => useDiscardGuard(true));
    act(() => result.current.markTouched());

    let decision!: Promise<boolean>;
    act(() => {
      decision = dismissWith(result.current.canDismiss, 'gesture');
    });
    await act(async () => {
      result.current.answer(true);
    });

    await expect(decision).resolves.toBe(true);
    expect(result.current.isAsking).toBe(false);
  });

  it('schnappt auf «weiter bearbeiten» zurück und fragt beim nächsten Mal erneut', async () => {
    const { result } = renderHook(() => useDiscardGuard(true));
    act(() => result.current.markTouched());

    let first!: Promise<boolean>;
    act(() => {
      first = dismissWith(result.current.canDismiss, 'gesture');
    });
    await act(async () => {
      result.current.answer(false);
    });
    await expect(first).resolves.toBe(false);

    // Der Merker bleibt stehen – das Formular ist ja weiterhin beschrieben.
    let second!: Promise<boolean>;
    act(() => {
      second = dismissWith(result.current.canDismiss, 'gesture');
    });
    expect(result.current.isAsking).toBe(true);
    await act(async () => {
      result.current.answer(true);
    });
    await expect(second).resolves.toBe(true);
  });

  it.each([
    // Auf dem Laptop ist der Hintergrund anklickbar; ohne diese Rolle wäre der
    // Wächter dort wirkungslos.
    ['backdrop', 'der Griff neben das Blatt'],
    // Abbrechen wirft denselben Entwurf genauso endgültig weg wie die Geste.
    ['cancel', 'der Abbrechen-Knopf'],
  ])('hält %s (%s) genauso auf', async (role) => {
    const { result } = renderHook(() => useDiscardGuard(true));
    act(() => result.current.markTouched());

    let decision!: Promise<boolean>;
    act(() => {
      decision = dismissWith(result.current.canDismiss, role);
    });
    expect(result.current.isAsking).toBe(true);
    await act(async () => {
      result.current.answer(true);
    });
    await expect(decision).resolves.toBe(true);
  });

  it('lässt das Schliessen nach dem Speichern durch', async () => {
    // Setzt die Seite nach erfolgreichem Speichern `isOpen={false}`, ruft Ionic
    // `dismiss()` ohne Rolle – und prüft `canDismiss` auch dort. Ein Wächter,
    // der auch diesen Weg abfängt, fragt nach dem Speichern «verwerfen?» und
    // sperrt das Blatt zu. Der gefährlichste Fehler an dieser Stelle.
    const { result } = renderHook(() => useDiscardGuard(true));
    act(() => result.current.markTouched());

    await expect(dismissWith(result.current.canDismiss, undefined)).resolves.toBe(true);
    expect(result.current.isAsking).toBe(false);
  });

  it('beginnt jedes Öffnen mit einem leeren Blatt', () => {
    const { result, rerender } = renderHook(({ open }) => useDiscardGuard(open), {
      initialProps: { open: true },
    });

    act(() => result.current.markTouched());
    expect(result.current.canDismiss).not.toBe(true);

    rerender({ open: false });
    rerender({ open: true });

    expect(result.current.canDismiss).toBe(true);
  });
});
