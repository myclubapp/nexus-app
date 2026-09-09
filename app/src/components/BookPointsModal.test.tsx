import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { BookPoints } from './BookPointsModal';
import { renderWithProviders } from '../test/utils';
import type { PointTransaction } from '../lib/database.types';

const bookMutate = vi.fn();
const reverseMutate = vi.fn();

vi.mock('../hooks/useGamification', () => ({
  useBookPoints: () => ({ mutate: bookMutate, isPending: false, error: null }),
  useReversePoints: () => ({ mutate: reverseMutate, isPending: false, error: null }),
}));

vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    title,
    submitLabel,
    canSubmit,
    onSubmit,
  }: {
    children: ReactNode;
    title: string;
    submitLabel?: string;
    canSubmit?: boolean;
    onSubmit: () => void;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
      <button type="button" disabled={canSubmit === false} onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  ),
}));

const MEMBERS = [
  { id: 'm-1', displayName: 'Anna Beispiel' },
  { id: 'm-2', displayName: 'Bea Muster' },
];

const original = {
  id: 'tx-1',
  club_id: 'c-1',
  member_id: 'm-1',
  rule_code: null,
  pillar: 7,
  points: 25,
  season: '2026/27',
  source_type: 'manual',
  source_id: null,
  note: 'Kuchen für den Elternabend',
  created_by: 'm-9',
  created_at: '2026-09-01T10:00:00Z',
} as PointTransaction;

/**
 * UC-021: Ein Blatt, zwei Wege. Die Tests halten fest, was das Blatt
 * **verlangt** – die Notiz (BR-086) und die Begründung (A1) – und was es über
 * die Unveränderlichkeit des Ledgers sagt (BR-085).
 */
describe('BookPoints', () => {
  beforeEach(() => vi.clearAllMocks());

  function renderBooking(preselected: string[] = []) {
    return renderWithProviders(
      <BookPoints
        members={MEMBERS}
        preselected={preselected}
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
  }

  function renderCorrection() {
    return renderWithProviders(
      <BookPoints
        members={MEMBERS}
        correcting={original}
        correctingLabel="Kuchen für den Elternabend"
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
  }

  it('sperrt die Buchung, solange niemand gewählt und nichts geschrieben ist', () => {
    renderBooking();
    expect(screen.getByRole('button', { name: 'Buchen' })).toBeDisabled();
  });

  it('erklärt beide Sperren, statt nur auszugrauen (A2, BR-086)', () => {
    const { container } = renderBooking();
    expect(container.textContent).toContain('mindestens eine Person');
    expect(container.textContent).toContain('nennt ihren Anlass');
  });

  it('bietet alle Mitglieder zur Auswahl an (A3)', () => {
    const { container } = renderBooking();
    expect(container.textContent).toContain('Anna Beispiel');
    expect(container.textContent).toContain('Bea Muster');
  });

  it('sagt, dass ein Abzug nicht hier entsteht (BR-087)', () => {
    const { container } = renderBooking();
    expect(container.textContent).toContain('als Korrektur einer bestehenden Buchung');
  });

  it('zeigt beim Korrigieren das Original und die Gegenbuchung (A1)', () => {
    const { container } = renderCorrection();
    expect(container.textContent).toContain('Kuchen für den Elternabend');
    expect(container.textContent).toContain('Gegenbuchung');
    expect(container.textContent).toContain('-25');
  });

  it('sagt, dass die ursprüngliche Buchung stehen bleibt (BR-085)', () => {
    const { container } = renderCorrection();
    expect(container.textContent).toContain('nie geändert oder gelöscht');
  });

  it('verlangt für die Korrektur eine Begründung (A1)', () => {
    const { container } = renderCorrection();
    expect(screen.getByRole('button', { name: 'Korrigieren' })).toBeDisabled();
    expect(container.textContent).toContain('gehört ihre Begründung');
  });

  it('fragt beim Korrigieren weder nach Personen noch nach einer Säule', () => {
    // Beides steht schon fest: Die Gegenbuchung erbt es von der Buchung.
    const { container } = renderCorrection();
    expect(container.textContent).not.toContain('Für wen');
    expect(container.textContent).not.toContain('Anna Beispiel');
  });

  it('schreibt beim Öffnen nichts in die Datenbank', () => {
    renderBooking(['m-1']);
    expect(bookMutate).not.toHaveBeenCalled();
    expect(reverseMutate).not.toHaveBeenCalled();
  });
});
