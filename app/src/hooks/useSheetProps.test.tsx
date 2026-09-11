import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSheetProps } from './useSheetProps';

interface Props {
  title: string;
  onDismiss: () => void;
}

describe('useSheetProps', () => {
  it('gibt ohne Gegenstand nichts zu rendern', () => {
    const { result } = renderHook(() => useSheetProps<Props>(null));

    expect(result.current).toBeNull();
  });

  it('reicht die Eigenschaften mit isOpen durch, solange das Blatt offen ist', () => {
    const onDismiss = vi.fn();
    const { result } = renderHook(() => useSheetProps<Props>({ title: 'A', onDismiss }));

    expect(result.current).toMatchObject({ title: 'A', isOpen: true });
  });

  it('hält den Inhalt beim Schliessen fest, bis das Blatt zu Ende gefahren ist', () => {
    // Die Seite gibt `null`, sobald sie schliesst. Fiele der Inhalt im selben
    // Moment weg, nähme Ionic das Blatt ohne Übergang heraus und die Seite
    // darunter bliebe in der Karten-Stellung stehen.
    const onDismiss = vi.fn();
    const { result, rerender } = renderHook(
      ({ props }: { props: Props | null }) => useSheetProps(props),
      { initialProps: { props: { title: 'A', onDismiss } as Props | null } },
    );

    rerender({ props: null });

    expect(result.current).toMatchObject({ title: 'A', isOpen: false });

    // Ionic meldet `onDidDismiss` – erst jetzt fällt der Inhalt weg, und die
    // Seite erfährt davon wie bisher.
    act(() => result.current?.onDismiss());

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(result.current).toBeNull();
  });

  it('folgt Änderungen, solange das Blatt offen ist', () => {
    const onDismiss = vi.fn();
    const { result, rerender } = renderHook(
      ({ props }: { props: Props | null }) => useSheetProps(props),
      { initialProps: { props: { title: 'A', onDismiss } as Props | null } },
    );

    rerender({ props: { title: 'B', onDismiss } });

    expect(result.current).toMatchObject({ title: 'B', isOpen: true });

    // Beim Schliessen bleibt der letzte Stand stehen, nicht der erste.
    rerender({ props: null });

    expect(result.current).toMatchObject({ title: 'B', isOpen: false });
  });

  it('beginnt nach dem Abbau wieder frisch', () => {
    const onDismiss = vi.fn();
    const { result, rerender } = renderHook(
      ({ props }: { props: Props | null }) => useSheetProps(props),
      { initialProps: { props: { title: 'A', onDismiss } as Props | null } },
    );

    rerender({ props: null });
    act(() => result.current?.onDismiss());
    expect(result.current).toBeNull();

    rerender({ props: { title: 'C', onDismiss } });

    expect(result.current).toMatchObject({ title: 'C', isOpen: true });
  });
});
