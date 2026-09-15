import type { ReactNode } from 'react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { OfficeImportReview } from './OfficeImportModal';
import { renderWithProviders } from '../test/utils';
import { officeToMarkdown } from '../lib/officeMarkdown';
import type { Office } from '../lib/office';

const saveOffice = vi.fn();
const success = vi.fn();
const failure = vi.fn();

let offices: Office[] = [];

vi.mock('../hooks/useOffices', () => ({
  useOffices: () => ({ data: offices }),
  useSaveOffice: () => ({ mutateAsync: saveOffice, isPending: false, error: null }),
}));

vi.mock('../hooks/useMembers', () => ({
  useMembers: () => ({ data: [{ id: 'm-1', display_name: 'Anna Beispiel' }] }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success, failure }),
}));

/**
 * `FormModal` steckt in einem `IonModal`, das in jsdom nichts rendert
 * (docs/TESTING.md). Der Ersatz zeichnet die Bestätigung samt Beschriftung
 * und Sperre nach – beide sind hier Teil des geprüften Verhaltens.
 */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    submitLabel,
    canSubmit,
    onSubmit,
  }: {
    children: ReactNode;
    submitLabel: string;
    canSubmit: boolean;
    onSubmit: () => void;
  }) => (
    <div>
      {children}
      <button type="button" disabled={!canSubmit} onClick={onSubmit}>
        {submitLabel}
      </button>
    </div>
  ),
}));

function office(overrides: Partial<Office> = {}): Office {
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    title: 'Kassier:in',
    holderMemberId: null,
    holderName: null,
    heldSince: null,
    why: 'Damit die Kasse stimmt.',
    duties: [{ title: 'Buchhaltung führen', detail: null }],
    hoursPerSeason: null,
    pointsLabel: null,
    seasonPoints: null,
    maxHolders: 1,
    isBoard: false,
    contactMemberId: null,
    contactName: null,
    factsheetPath: null,
    holders: [],
    ...overrides,
  };
}

/** Die Kästchen der Liste – eines je gefundenem Amt. */
function boxes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll('ion-checkbox')] as HTMLElement[];
}

function check(box: HTMLElement, checked: boolean) {
  act(() => {
    box.dispatchEvent(new CustomEvent('ionChange', { detail: { checked } }));
  });
}

describe('OfficeImportReview', () => {
  beforeEach(() => {
    offices = [office()];
    vi.clearAllMocks();
    saveOffice.mockResolvedValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });

  it('sagt je Amt, ob es angelegt oder geändert wird', () => {
    const text = `${officeToMarkdown(office(), 'de').replace('- Sitze: 1', '- Sitze: 3')}\n# Neues Amt\n\n## Eckdaten\n\n- Sitze: 1\n`;
    const { container } = renderWithProviders(
      <OfficeImportReview text={text} fileName="aemter.md" onDone={vi.fn()} onDismiss={vi.fn()} />,
    );

    expect(container.textContent).toContain('Kassier:in');
    expect(container.textContent).toContain('Ändern');
    expect(container.textContent).toContain('Sitze');
    expect(container.textContent).toContain('Neues Amt');
    expect(container.textContent).toContain('Wird als neues Amt angelegt.');
  });

  it('nennt eine Datei, die dem gespeicherten Stand entspricht, unverändert', () => {
    const { container } = renderWithProviders(
      <OfficeImportReview
        text={officeToMarkdown(office(), 'de')}
        fileName="amt.md"
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('Keine Änderung');
  });

  it('speichert jedes gewählte Amt über denselben Weg wie das Formular', async () => {
    const text = `${officeToMarkdown(office(), 'de').replace('Damit die Kasse stimmt.', 'Neuer Satz.')}\n# Neues Amt\n\n## Eckdaten\n\n- Sitze: 2\n`;
    const onDone = vi.fn();
    renderWithProviders(
      <OfficeImportReview text={text} fileName="aemter.md" onDone={onDone} onDismiss={vi.fn()} />,
    );

    screen.getByRole('button', { name: '2 übernehmen' }).click();

    await waitFor(() => expect(saveOffice).toHaveBeenCalledTimes(2));
    expect(saveOffice.mock.calls[0][0].id).toBe('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(saveOffice.mock.calls[0][0].draft.why).toBe('Neuer Satz.');
    // Das zweite Amt kennt die App noch nicht: Es entsteht neu.
    expect(saveOffice.mock.calls[1][0].id).toBeNull();
    expect(saveOffice.mock.calls[1][0].draft.maxHolders).toBe(2);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(success).toHaveBeenCalled();
  });

  it('lässt ein abgewähltes Amt liegen', async () => {
    const text = `# Neues Amt\n\n## Eckdaten\n\n- Sitze: 1\n`;
    const { container } = renderWithProviders(
      <OfficeImportReview text={text} fileName="amt.md" onDone={vi.fn()} onDismiss={vi.fn()} />,
    );

    check(boxes(container)[0], false);

    expect(screen.getByRole('button', { name: '0 übernehmen' })).toBeDisabled();
  });

  it('bietet zwei gleichnamige Ämter nicht zum Raten an', () => {
    offices = [
      office({ id: 'aaaaaaaa-0000-0000-0000-000000000001', title: 'Co-Präsidium' }),
      office({ id: 'aaaaaaaa-0000-0000-0000-000000000002', title: 'Co-Präsidium' }),
    ];
    const { container } = renderWithProviders(
      <OfficeImportReview
        text={'# Co-Präsidium\n\n## Eckdaten\n\n- Sitze: 1\n'}
        fileName="amt.md"
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    // `@lit/react` setzt `disabled` als **Eigenschaft** am Element, nicht als
    // Attribut: In jsdom ist `hasAttribute('disabled')` deshalb falsch, auch
    // wenn das Kästchen gesperrt ist.
    expect((boxes(container)[0] as unknown as { disabled?: boolean }).disabled).toBe(true);
    expect(container.textContent).toContain('Zwei Ämter tragen diese Bezeichnung');
    expect(screen.getByRole('button', { name: '0 übernehmen' })).toBeDisabled();
  });

  it('sagt es, wenn in der Datei kein Amt steht', () => {
    const { container } = renderWithProviders(
      <OfficeImportReview
        text={'Nur eine Notiz aus dem Vorstandsordner.'}
        fileName="notiz.md"
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(container.textContent).toContain('keine Ämterbeschreibung');
    expect(screen.getByRole('button', { name: '0 übernehmen' })).toBeDisabled();
  });

  it('bleibt ehrlich, wenn der Server mitten in der Reihe abbricht', async () => {
    const text = `${officeToMarkdown(office(), 'de').replace('Damit die Kasse stimmt.', 'Neuer Satz.')}\n# Neues Amt\n\n## Eckdaten\n\n- Sitze: 2\n`;
    saveOffice
      .mockResolvedValueOnce('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
      .mockRejectedValueOnce(new Error('Nur der Vorstand pflegt die Ämter'));
    const onDone = vi.fn();
    const { container } = renderWithProviders(
      <OfficeImportReview text={text} fileName="aemter.md" onDone={onDone} onDismiss={vi.fn()} />,
    );

    screen.getByRole('button', { name: '2 übernehmen' }).click();

    // Was geschrieben ist, bleibt geschrieben – das Blatt sagt, wie weit es kam.
    await waitFor(() => expect(container.textContent).toContain('1 übernommen, dann abgebrochen'));
    expect(container.textContent).toContain('Nur der Vorstand pflegt die Ämter');
    expect(onDone).not.toHaveBeenCalled();
  });
});
