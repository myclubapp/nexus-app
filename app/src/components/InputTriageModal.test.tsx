import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InputTriage } from './InputTriageModal';
import { ionProp, renderWithProviders } from '../test/utils';
import type { MeetingInput } from '../lib/meeting';

const assignMutate = vi.fn();
const forwardMutate = vi.fn();
const answerAsync = vi.fn(async () => undefined);

let isAdmin = true;

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ isAdmin }),
}));

vi.mock('../hooks/useMeeting', () => ({
  useMeetings: () => ({
    data: [
      { id: 'e-1', title: 'Vorstandssitzung März', starts_at: '2026-03-14T19:00:00Z' },
    ],
    isLoading: false,
    error: null,
  }),
  useOffices: () => ({
    data: [
      { id: 'o-1', title: 'Präsidium', holderMemberId: 'm-1', holderName: 'Petra', heldSince: null },
      { id: 'o-2', title: 'Kassier', holderMemberId: null, holderName: null, heldSince: null },
    ],
    isLoading: false,
    error: null,
  }),
  useAssignInput: () => ({ mutate: assignMutate, isPending: false, error: null }),
  useForwardInput: () => ({ mutate: forwardMutate, isPending: false, error: null }),
  useAnswerInput: () => ({ mutateAsync: answerAsync, isPending: false, error: null }),
}));

/**
 * `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md §6.5). Das
 * Blatt wird deshalb durch gewöhnliches HTML ersetzt.
 */
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

function input(overrides: Partial<MeetingInput> = {}): MeetingInput {
  return {
    id: 'i-1',
    body: 'Wir sollten die Garderobe streichen.',
    status: 'open',
    committeeRoleIds: ['o-1'],
    meetingEventId: null,
    response: null,
    respondedAt: null,
    isMine: false,
    isAnonymous: false,
    createdAt: '2026-09-10T10:00:00Z',
    ...overrides,
  };
}

/**
 * UC-031 dreht sich um BR-134: **Der Status ist schon eine Antwort.**
 *
 * Eine Ionic-Eingabe lässt sich in jsdom nicht bedienen (docs/TESTING.md §6.4);
 * die Regeln hinter dem Formular stehen deshalb in `lib/meeting.ts` und werden
 * dort geprüft. Hier steht, **was in einem Zustand zu sehen ist**.
 */
describe('InputTriage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAdmin = true;
  });

  function render(overrides: Partial<MeetingInput> = {}) {
    return renderWithProviders(
      <InputTriage input={input(overrides)} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('zeigt den Vorschlag ungekürzt', () => {
    const { container } = render();
    expect(container.textContent).toContain('Wir sollten die Garderobe streichen.');
  });

  it('kennt genau die zwei Entscheide aus Schritt 7', () => {
    // «Laufend bearbeiten» **oder** einer Sitzung zuordnen. Ein dritter Weg
    // wäre eine Traktandenverwaltung durch die Hintertür (BR-132).
    const { container } = render();
    const options = [...container.querySelectorAll('ion-select-option')].map(
      (element) => element.textContent?.trim(),
    );
    expect(options).toContain('Laufend bearbeiten');
    expect(options.some((label) => label?.includes('Vorstandssitzung März'))).toBe(true);
  });

  it('sperrt Antwort und Ablehnung, solange keine Begründung steht', () => {
    // Ein Vorschlag darf abgelehnt werden, aber nicht versanden (§13.3).
    const { container } = render();
    expect(
      ionProp<boolean>(button(container, 'Antworten und abschliessen')!, 'disabled'),
    ).toBe(true);
    expect(ionProp<boolean>(button(container, 'Ablehnen')!, 'disabled')).toBe(true);
    expect(container.textContent).toContain('Schreibe zuerst deine Antwort.');
  });

  it('sperrt das Weiterleiten ohne Zielgremium (A4)', () => {
    const { container } = render();
    expect(ionProp<boolean>(button(container, 'Weiterleiten')!, 'disabled')).toBe(true);
  });

  it('bietet den Übernehmen-Knopf erst mit einem Entscheid an', () => {
    // Ohne Zuordnung gibt es nichts zu übernehmen; ein offener Knopf, der
    // nichts tut, sagt das Falsche.
    const { container } = render();
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      true,
    );
  });

  it('nimmt den bestehenden Stand als Vorauswahl', () => {
    const { container } = render({ status: 'scheduled', meetingEventId: 'e-1' });
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      false,
    );
  });

  it('nennt einen anonymen Vorschlag als solchen', () => {
    // Wer antwortet, muss wissen, dass es keinen Rückkanal über die Person
    // gibt.
    const { container } = render({ isAnonymous: true });
    expect(container.textContent).toContain('Anonymer Vorschlag');
  });

  it('bietet dem Vorstand an, den Entscheid zu publizieren (FR-100)', () => {
    const { container } = render();
    expect(
      [...container.querySelectorAll('ion-toggle')].map((element) =>
        element.textContent?.trim(),
      ),
    ).toEqual(['Entscheid als News publizieren']);
  });

  it('bietet das dem Gremium ohne Vorstandsrolle nicht an', () => {
    // Eine Vereinsmitteilung ist nicht Sache des Gremiums, an das der
    // Vorschlag ging – es beantwortet ihn, es spricht nicht für den Verein.
    isAdmin = false;
    const { container } = render();
    expect(container.querySelectorAll('ion-toggle')).toHaveLength(0);
  });

  it('zeigt einen abgeschlossenen Vorschlag nur noch als Lesestück', () => {
    const { container } = render({
      status: 'answered',
      response: 'Die Garderobe wird im Mai gestrichen.',
      respondedAt: '2026-09-11T08:00:00Z',
    });

    expect(container.textContent).toContain('Die Garderobe wird im Mai gestrichen.');
    expect(button(container, 'Ablehnen')).toBeUndefined();
    expect(button(container, 'Weiterleiten')).toBeUndefined();
    expect(container.querySelector('ion-textarea')).toBeNull();
  });
});
