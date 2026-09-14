import { describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { ManageSection } from './ManageSection';
import { renderWithProviders } from '../test/utils';

/**
 * Der Abschnitt «Verwalten» (guidelines §2): dieselbe Stelle in jedem Blatt,
 * die rote Zeile zuletzt, und ohne Einträge gar nichts.
 */
describe('ManageSection', () => {
  it('rendert ohne Einträge nichts – auch nicht die Überschrift', () => {
    const { container } = renderWithProviders(<ManageSection actions={[false, undefined]} />);
    expect(container.textContent).not.toContain('Verwalten');
  });

  it('stellt die zerstörerische Zeile zuletzt, egal in welcher Reihenfolge sie kommt', () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    const { container } = renderWithProviders(
      <ManageSection
        actions={[
          { label: 'Löschen', onClick: onDelete, destructive: true },
          { label: 'Bearbeiten', onClick: onEdit, detail: true },
        ]}
      />,
    );
    expect(container.textContent).toContain('Verwalten');
    const rows = Array.from(container.querySelectorAll('ion-item'));
    // `ion-item` trägt den Text; `ion-label` gibt in jsdom weder Text noch
    // `color` preis (docs/TESTING.md §6.1).
    expect(rows.map((row) => row.textContent?.trim())).toEqual(['Bearbeiten', 'Löschen']);

    fireEvent.click(rows[1]);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
  });
});
