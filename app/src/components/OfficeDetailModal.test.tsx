import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { OfficeDetail } from './OfficeDetailModal';
import { renderWithProviders } from '../test/utils';
import type { Office } from '../lib/office';

const club = { isAdmin: false };
const factsheet: { data: string | undefined; error: Error | null } = { data: undefined, error: null };

vi.mock('../hooks/useClub', () => ({
  useClub: () => club,
}));

vi.mock('../hooks/useOffices', () => ({
  useFactsheetUrl: () => factsheet,
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert
 * (docs/TESTING.md). Der Ersatz zeichnet die Kopfzeile nach.
 */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    title,
    onSubmit,
    onDismiss,
  }: {
    children: ReactNode;
    title: string;
    onSubmit?: () => void;
    onDismiss: () => void;
  }) => (
    <div>
      <h1>{title}</h1>
      {children}
      {onSubmit ? (
        <button type="button" onClick={onSubmit}>
          Bestätigen
        </button>
      ) : (
        <button type="button" onClick={onDismiss}>
          Schliessen
        </button>
      )}
    </div>
  ),
}));

function office(overrides: Partial<Office> = {}): Office {
  return {
    id: 'o-1',
    title: 'Schiedsrichter:in',
    holderMemberId: null,
    holderName: null,
    heldSince: null,
    why: null,
    duties: [
      { title: 'Leitung von Spielen', detail: 'Gemäss den Reglementen von swiss unihockey.' },
      { title: 'Vorbildliches Auftreten', detail: null },
    ],
    hoursPerSeason: '60h+',
    pointsLabel: '3 + Lohn + Spesen',
    maxHolders: 6,
    contactMemberId: null,
    contactName: 'Sandro Ehrbar',
    factsheetPath: null,
    holders: [
      { id: 'h-1', memberId: null, displayName: 'Andrin Vollenweider', interim: false, since: null },
      { id: 'h-2', memberId: null, displayName: 'Patrick Koch', interim: true, since: '2025-08-01' },
    ],
    ...overrides,
  };
}

/** `ion-item` trägt den Text, `ion-label` in jsdom nicht (docs/TESTING.md §6.1). */
function row(container: HTMLElement, text: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-item')).find(
    (element) => element.textContent?.trim() === text,
  );
}

describe('OfficeDetail', () => {
  beforeEach(() => {
    club.isAdmin = false;
    factsheet.data = undefined;
    factsheet.error = null;
  });

  it('zeigt das Factsheet: Pflichten, Eckdaten, Belegung, Ansprechperson (FR-126)', () => {
    renderWithProviders(<OfficeDetail office={office()} onDismiss={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Schiedsrichter:in' })).toBeInTheDocument();
    expect(screen.getByText('Leitung von Spielen')).toBeInTheDocument();
    expect(screen.getByText('Gemäss den Reglementen von swiss unihockey.')).toBeInTheDocument();
    expect(screen.getByText('60h+')).toBeInTheDocument();
    expect(screen.getByText('3 + Lohn + Spesen')).toBeInTheDocument();
    expect(screen.getByText('Sandro Ehrbar')).toBeInTheDocument();
    expect(screen.getByText('Andrin Vollenweider')).toBeInTheDocument();
    expect(screen.getByText('Patrick Koch')).toBeInTheDocument();
    expect(screen.getByText('ad interim')).toBeInTheDocument();
  });

  it('rechnet die Vakanz aus Sitzen und Belegung – ad interim zählt nicht (BR-183)', () => {
    renderWithProviders(<OfficeDetail office={office()} onDismiss={() => undefined} />);
    // Sechs Sitze, eine ordentliche Inhaberin: fünf frei, «1 von 6 besetzt».
    // guidelines §11 Nr. 18: im Badge nur die Zahl, der Wortlaut als aria-label.
    expect(screen.getByLabelText('5 Sitze frei')).toHaveTextContent('5');
    expect(screen.getByText('1 von 6 besetzt')).toBeInTheDocument();
  });

  it('nennt ein voll besetztes Amt besetzt', () => {
    renderWithProviders(
      <OfficeDetail
        office={office({
          maxHolders: 1,
          holders: [{ id: 'h-1', memberId: null, displayName: 'Kevin Gysel', interim: false, since: null }],
        })}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByText('Besetzt')).toBeInTheDocument();
    expect(screen.queryByText(/Sitz frei|Sitze frei/)).not.toBeInTheDocument();
  });

  it('bietet das PDF nur an, wenn eines hinterlegt ist (BR-186)', () => {
    const { unmount } = renderWithProviders(
      <OfficeDetail office={office()} onDismiss={() => undefined} />,
    );
    expect(screen.queryByText('Factsheet öffnen (PDF)')).not.toBeInTheDocument();
    unmount();

    factsheet.data = 'https://example.test/signed.pdf';
    renderWithProviders(
      <OfficeDetail office={office({ factsheetPath: 'club/o-1.pdf' })} onDismiss={() => undefined} />,
    );
    expect(screen.getByText('Factsheet öffnen (PDF)')).toBeInTheDocument();
  });

  it('zeigt nur anzeigend: «Schliessen» einmal, kein Bestätigen', () => {
    renderWithProviders(<OfficeDetail office={office()} onDismiss={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Schliessen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bestätigen' })).not.toBeInTheDocument();
  });

  it('gibt nur dem Vorstand «Bearbeiten»', () => {
    const onEdit = vi.fn();
    const { unmount, container } = renderWithProviders(
      <OfficeDetail office={office()} onEdit={onEdit} onDismiss={() => undefined} />,
    );
    expect(container.textContent).not.toContain('Verwalten');
    expect(row(container, 'Amt bearbeiten')).toBeUndefined();
    unmount();

    club.isAdmin = true;
    const admin = renderWithProviders(
      <OfficeDetail office={office()} onEdit={onEdit} onDismiss={() => undefined} />,
    );
    fireEvent.click(row(admin.container, 'Amt bearbeiten')!);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'o-1' }));
  });

  it('führt Bearbeiten und Auflösen als Zeilen unter «Verwalten», Auflösen zuletzt', () => {
    club.isAdmin = true;
    const onEdit = vi.fn();
    const onDissolve = vi.fn();
    const { container } = renderWithProviders(
      <OfficeDetail
        office={office()}
        onEdit={onEdit}
        onDissolve={onDissolve}
        onDismiss={() => undefined}
      />,
    );
    expect(container.textContent).toContain('Verwalten');
    const edit = row(container, 'Amt bearbeiten')!;
    const remove = row(container, 'Auflösen')!;
    expect(edit.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(remove);
    expect(onDissolve).toHaveBeenCalledWith(expect.objectContaining({ id: 'o-1' }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('sagt, wenn niemand das Amt trägt', () => {
    renderWithProviders(
      <OfficeDetail office={office({ holders: [] })} onDismiss={() => undefined} />,
    );
    expect(screen.getByText('Niemand trägt dieses Amt.')).toBeInTheDocument();
  });
});
