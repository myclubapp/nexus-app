import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemberExportForm } from './MemberExportModal';
import { renderWithProviders } from '../test/utils';
import type { MemberExportRecord } from '../lib/database.types';

const exportRows = vi.fn();
const success = vi.fn();
const failure = vi.fn();

let club: { activeClub: { id: string; slug: string } | null; isAdmin: boolean };

vi.mock('../hooks/useClub', () => ({
  useClub: () => club,
}));

vi.mock('../hooks/useMembers', () => ({
  useMemberExport: () => ({
    mutateAsync: exportRows,
    isPending: false,
    error: null,
  }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success, failure }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert
 * (docs/TESTING.md). Der Ersatz macht den Bestätigen-Knopf klickbar.
 */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    onSubmit,
  }: {
    children: ReactNode;
    onSubmit: () => void;
  }) => (
    <div>
      {children}
      <button type="button" onClick={onSubmit}>
        submit
      </button>
    </div>
  ),
}));

function record(overrides: Partial<MemberExportRecord> = {}): MemberExportRecord {
  return {
    member_id: 'm1',
    first_name: 'Anna',
    last_name: 'Muster',
    display_name: 'Anna Muster',
    email: null,
    phone: null,
    birth_date: null,
    street: null,
    house_number: null,
    postal_code: null,
    city: null,
    country: null,
    role: 'member',
    status: 'active',
    member_since: '2020-01-15',
    teams: null,
    offices: null,
    ...overrides,
  };
}

describe('MemberExportForm', () => {
  beforeEach(() => {
    club = { activeClub: { id: 'c1', slug: 'sc-muster' }, isAdmin: true };
    vi.clearAllMocks();
    exportRows.mockResolvedValue([record()]);

    // jsdom kennt weder `createObjectURL` noch einen Download: Ein Klick auf
    // `<a download>` meldet «Not implemented: navigation to another
    // Document». Geprüft wird hier, **dass** es zum Herausgeben kommt – der
    // Inhalt der Datei steht in `memberExport.test.ts`.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bietet dem Vorstand alle sechs Felder an', () => {
    const { container } = renderWithProviders(
      <MemberExportForm teamId={null} teamName={null} memberIds={null} onDismiss={vi.fn()} />,
    );

    expect(container.querySelectorAll('ion-checkbox')).toHaveLength(6);
  });

  it('bietet der Trainer:in weder Adresse noch Geburtsdatum an (BR-206)', () => {
    club = { ...club, isAdmin: false };
    const { container } = renderWithProviders(
      <MemberExportForm teamId="t1" teamName="Herren 1" memberIds={null} onDismiss={vi.fn()} />,
    );

    // Ein Kästchen, das der Server ohnehin leer liefert, wäre ein Versprechen,
    // das die Datei nicht hält. Geprüft werden die Kästchen, nicht der ganze
    // Text: Die Fussnote nennt Adresse und Geburtsdatum absichtlich – sie
    // erklärt, was beim Vorstand bleibt.
    const boxes = [...container.querySelectorAll('ion-checkbox')].map(
      (box) => box.textContent,
    );
    expect(boxes).toHaveLength(4);
    expect(boxes).not.toContain('Adresse');
    expect(boxes).not.toContain('Geburtsdatum');
  });

  it('sagt der Trainer:in, was beim Vorstand bleibt', () => {
    club = { ...club, isAdmin: false };
    const { container } = renderWithProviders(
      <MemberExportForm teamId="t1" teamName="Herren 1" memberIds={null} onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('bleiben beim Vorstand');
  });

  it('holt den ganzen Verein, wenn kein Team gewählt ist (BR-205)', async () => {
    renderWithProviders(
      <MemberExportForm teamId={null} teamName={null} memberIds={null} onDismiss={vi.fn()} />,
    );

    screen.getByRole('button', { name: 'submit' }).click();

    await waitFor(() => expect(exportRows).toHaveBeenCalledWith(null));
  });

  it('holt genau das gewählte Team', async () => {
    renderWithProviders(
      <MemberExportForm teamId="t1" teamName="Herren 1" memberIds={null} onDismiss={vi.fn()} />,
    );

    screen.getByRole('button', { name: 'submit' }).click();

    await waitFor(() => expect(exportRows).toHaveBeenCalledWith('t1'));
  });

  it('meldet einen leeren Ausschnitt, statt eine leere Datei zu erzeugen (E1)', async () => {
    exportRows.mockResolvedValue([]);
    const onDismiss = vi.fn();
    renderWithProviders(
      <MemberExportForm teamId={null} teamName={null} memberIds={null} onDismiss={onDismiss} />,
    );

    screen.getByRole('button', { name: 'submit' }).click();

    await waitFor(() => expect(failure).toHaveBeenCalled());
    expect(success).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('schneidet die Serverantwort auf die gefilterte Liste (A2)', async () => {
    exportRows.mockResolvedValue([record(), record({ member_id: 'm2' })]);
    renderWithProviders(
      <MemberExportForm
        teamId={null}
        teamName={null}
        memberIds={['m2']}
        onDismiss={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: 'submit' }).click();

    // Eine Zeile bleibt übrig, also gibt es eine Datei und keinen Hinweis.
    await waitFor(() => expect(success).toHaveBeenCalled());
    expect(failure).not.toHaveBeenCalled();
  });

  it('erzeugt keine Datei, wenn der Filter alles wegschneidet (E1)', async () => {
    exportRows.mockResolvedValue([record()]);
    renderWithProviders(
      <MemberExportForm
        teamId={null}
        teamName={null}
        memberIds={['anderes-mitglied']}
        onDismiss={vi.fn()}
      />,
    );

    screen.getByRole('button', { name: 'submit' }).click();

    await waitFor(() => expect(failure).toHaveBeenCalled());
  });
});
