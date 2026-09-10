import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckinPrompt } from './CheckinPromptModal';
import { ionProp, renderWithProviders } from '../test/utils';
import type { CheckinContext, CheckinInvitation, CheckinPrompt as Prompt } from '../lib/contextCheckin';

const submitMutate = vi.fn();
const skipMutate = vi.fn();
let prompts: Prompt[] = [];

vi.mock('../hooks/useContextCheckin', () => ({
  useCheckinPrompts: () => ({ data: prompts, isLoading: false, error: null }),
  useSubmitCheckin: () => ({ mutate: submitMutate, isPending: false, error: null }),
  useSkipCheckin: () => ({ mutate: skipMutate, isPending: false, error: null }),
}));

/** `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md §6.5). */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    submitLabel,
    canSubmit,
  }: {
    children: ReactNode;
    submitLabel?: string;
    canSubmit?: boolean;
  }) => (
    <div>
      <button type="button" id="modal-submit" disabled={canSubmit === false}>
        {submitLabel}
      </button>
      {children}
    </div>
  ),
}));

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §6.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

function prompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'p-1',
    question: 'Wie ging es dir heute damit?',
    scale: 'emoji5',
    sort: 0,
    ...overrides,
  };
}

function invitation(context: CheckinContext = 'training_attended'): CheckinInvitation {
  return {
    id: 'i-1',
    context,
    eventTitle: 'Training Dienstag',
    askedOn: '2026-09-10',
  };
}

const source = (file: string) => readFileSync(`${process.cwd()}/src/${file}`, 'utf8');

/**
 * UC-032 sammelt Befinden. Vier der sechs Regeln sind Verzichte, und genau die
 * prüft dieser Test: Es gibt keine Punkte (BR-138), privat ist die Vorgabe
 * (BR-139), und die Sichtbarkeit steht **vor** der Frage (FR-104).
 *
 * Eine Ionic-Eingabe lässt sich in jsdom nicht bedienen (docs/TESTING.md §6.4);
 * die Regeln hinter dem Formular stehen deshalb in `lib/contextCheckin.ts` und
 * werden dort geprüft.
 */
describe('CheckinPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prompts = [prompt()];
  });

  function render(context: CheckinContext = 'training_attended') {
    return renderWithProviders(
      <CheckinPrompt
        invitation={invitation(context)}
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
  }

  it('sagt ausdrücklich, dass es dafür keine Punkte gibt (Schritt 7, BR-138)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Dafür gibt es keine Punkte');
  });

  it('führt keinen Weg zu einer Punktebuchung', () => {
    // Die Regel steht in der Datenbank; hier wird festgehalten, dass die
    // Ansicht sie nicht umgeht – kein Aufruf, keine Ungültigmachung, nichts.
    const modal = source('components/CheckinPromptModal.tsx');
    const hook = source('hooks/useContextCheckin.ts');
    for (const file of [modal, hook]) {
      expect(file).not.toMatch(/award_points|point_transactions|useAwardPoints/);
      expect(file).not.toMatch(/queryKey: \['points'/);
    }
  });

  it('zeigt die Sichtbarkeit **vor** der Frage (FR-104)', () => {
    // Wer erst nach dem Antippen erfährt, wer mitliest, hat nicht gewählt.
    const { container } = render();
    const headers = [...container.querySelectorAll('ion-list-header')].map((element) =>
      element.textContent?.trim(),
    );
    expect(headers.indexOf('Wer sieht das?')).toBeGreaterThanOrEqual(0);
    expect(headers.indexOf('Wer sieht das?')).toBeLessThan(
      headers.indexOf('Wie ging es dir heute damit?'),
    );
  });

  it('beginnt bei «Nur du» (BR-139)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Niemand sonst liest das');
  });

  it('bietet nach einem Termin das Teilen mit der Trainer:in an (A5)', () => {
    const { container } = render();
    const options = [...container.querySelectorAll('ion-select-option')].map(
      (element) => element.textContent?.trim(),
    );
    expect(options).toEqual(['Nur du', 'Du und deine Trainer:in']);
  });

  it('bietet nach einem Einsatz die organisierende Person an (A4)', () => {
    const { container } = render('helper_shift');
    const options = [...container.querySelectorAll('ion-select-option')].map(
      (element) => element.textContent?.trim(),
    );
    expect(options).toEqual(['Nur du', 'Du und die organisierende Person']);
  });

  it('lässt beim Entlastungs-Index gar keine Wahl (FR-109)', () => {
    // Ein Auswahlfeld mit einem Eintrag wäre ein Versprechen auf eine
    // Entscheidung, die es nicht gibt.
    prompts = [prompt({ scale: 'stars5' })];
    const { container } = render('office_load');
    expect(container.querySelector('ion-select')).toBeNull();
    expect(container.textContent).toContain('Nur du');
  });

  it('zeigt fünf Stufen mit Mitte', () => {
    const { container } = render();
    const steps = [...container.querySelectorAll('ion-segment-button')];
    expect(steps).toHaveLength(5);
  });

  it('zeigt für eine Freitextfrage kein Segment', () => {
    prompts = [prompt({ scale: 'freetext', question: 'Was lief gut, was nicht?' })];
    const { container } = render();
    expect(container.querySelector('ion-segment')).toBeNull();
    expect(container.querySelector('ion-textarea')).not.toBeNull();
  });

  it('sperrt das Absenden, solange nichts beantwortet ist', () => {
    const { container } = render();
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      true,
    );
    expect(container.textContent).toContain('Beantworte mindestens eine Frage.');
  });

  it('bietet das Überspringen als gleichwertigen Ausgang an (A1)', () => {
    const { container } = render();
    const skip = button(container, 'Überspringen');
    expect(skip).toBeDefined();
    // Es ist nie gesperrt: Überspringen ist kein Abbruch, sondern ein Weg.
    expect(ionProp<boolean>(skip!, 'disabled')).toBe(false);
  });

  it('überspringt genau dieses Check-in', () => {
    const { container } = render();
    button(container, 'Überspringen')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    );
    expect(skipMutate).toHaveBeenCalledWith('i-1', expect.anything());
  });
});
