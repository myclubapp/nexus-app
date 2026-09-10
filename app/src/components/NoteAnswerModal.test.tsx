import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteAnswer } from './NoteAnswerModal';
import { ionProp, renderWithProviders } from '../test/utils';
import type { AnonMessage, VoiceNote } from '../lib/voice';

const answerAsync = vi.fn(async () => undefined);
const convertAsync = vi.fn(async () => 'task-1');
const publishAsync = vi.fn(async () => 'news-1');
const statusMutate = vi.fn();
const flagMutate = vi.fn();
let thread: AnonMessage[] = [];

vi.mock('../hooks/useVoice', () => ({
  useNoteThread: () => ({ data: thread, isLoading: false, error: null }),
  useSetNoteStatus: () => ({ mutate: statusMutate, isPending: false, error: null }),
  useAnswerNote: () => ({ mutateAsync: answerAsync, isPending: false, error: null }),
  useConvertNoteToTask: () => ({
    mutateAsync: convertAsync,
    isPending: false,
    error: null,
  }),
  useFlagNote: () => ({ mutate: flagMutate, isPending: false, error: null }),
}));

vi.mock('../hooks/useNews', () => ({
  usePublishNews: () => ({ mutateAsync: publishAsync, isPending: false, error: null }),
}));

let isAdmin = true;

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ isAdmin }),
}));

vi.mock('../hooks/useGamification', () => ({
  usePointRules: () => ({ data: [{ code: 'task_done', points: 35 }] }),
}));

/**
 * `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md §6.5). Das
 * Blatt wird deshalb durch gewöhnliches HTML ersetzt; geprüft wird der Inhalt,
 * nicht Ionics Überblendung.
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

function toggleLabels(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll('ion-toggle')].map((element) =>
    element.textContent?.trim(),
  );
}

function note(overrides: Partial<VoiceNote> = {}): VoiceNote {
  return {
    id: 'n-1',
    kind: 'anonymous',
    transcript: 'Die Garderobe steht seit Wochen offen.',
    status: 'open',
    response: null,
    createdWeek: '2026-W37',
    createdAt: null,
    isMine: false,
    flagged: false,
    taskId: null,
    ...overrides,
  };
}

/**
 * UC-030 dreht sich um **einen** Satz: «Speak-up braucht Listen-up» (BR-128).
 *
 * Eine Ionic-Eingabe lässt sich in jsdom nicht bedienen (docs/TESTING.md §6.4);
 * die Regeln hinter dem Formular stehen deshalb in `validateAnswer()` und
 * werden dort geprüft. Hier steht, **was in einem Zustand zu sehen ist**.
 */
describe('NoteAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    thread = [];
    isAdmin = true;
  });

  function render(overrides: Partial<VoiceNote> = {}) {
    return renderWithProviders(
      <NoteAnswer note={note(overrides)} onDone={vi.fn()} onDismiss={vi.fn()} />,
    );
  }

  it('zeigt das Anliegen ungekürzt (Schritt 3)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Die Garderobe steht seit Wochen offen.');
    expect(container.textContent).toContain('2026-W37');
  });

  it('sperrt den Hauptknopf, solange keine Antwort steht (BR-128)', () => {
    const { container } = render();
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      true,
    );
    expect(container.textContent).toContain('Schreibe zuerst deine Antwort.');
  });

  it('sperrt auch die Ablehnung, solange keine Begründung steht (A4)', () => {
    // Die Ablehnung ist eine Antwort, kein Ausbleiben – sie unterliegt
    // derselben Pflicht wie die Zusage.
    const { container } = render();
    expect(ionProp<boolean>(button(container, 'Ablehnen')!, 'disabled')).toBe(true);
  });

  it('bietet als Zwischenstände nur offen und in Arbeit an (Schritt 4)', () => {
    // Ein Endstatus entsteht **nur** zusammen mit einer Antwort;
    // `set_note_status()` lehnt ihn in 0047 ab. Stünde er im Segment, böte das
    // Blatt einen Weg an, den der Server verweigert.
    //
    // Geprüft wird die Beschriftung: `value` kommt an einem
    // `ion-segment-button` in jsdom nicht an, `ionProp()` läse dort Stencils
    // eigene Kennung (docs/TESTING.md §6.1).
    const { container } = render();
    const labels = [...container.querySelectorAll('ion-segment-button')].map((element) =>
      element.textContent?.trim(),
    );
    expect(labels).toEqual(['Offen', 'In Arbeit']);
  });

  it('führt genau die beiden Folge-Artefakte aus BR-130', () => {
    const { container } = render();
    expect(toggleLabels(container)).toEqual([
      'Als News publizieren',
      'In Aufgabe umwandeln',
    ]);
  });

  it('lässt nur den Vorstand die Antwort veröffentlichen (A2)', () => {
    // Eine Antwort an alle ist eine Vereinsmitteilung. Wer ein an ihn
    // gerichtetes Anliegen beantwortet, beantwortet es – er spricht nicht für
    // den Verein.
    isAdmin = false;
    const { container } = render({ kind: 'feedback' });
    expect(toggleLabels(container)).toEqual(['In Aufgabe umwandeln']);
  });

  it('nennt den Grund, wenn die Aufgabe schon besteht (BR-130)', () => {
    // Ein gesperrter Schalter ohne Erklärung sagt das Falsche; und `disabled`
    // kommt an einem `ion-toggle` in jsdom ohnehin nicht an.
    const { container } = render({ taskId: 'task-vorher' });
    expect(container.textContent).toContain(
      'Aus diesem Anliegen ist bereits eine Aufgabe entstanden.',
    );
    expect(toggleLabels(container)).toEqual(['Als News publizieren']);
  });

  it('zeigt das Nachfassen aus dem anonymen Faden (A1, Schritt 2)', () => {
    // Ohne diese Anzeige beantwortete der Vorstand eine Rückfrage, die er nie
    // gesehen hat.
    thread = [
      { side: 'board', body: 'Wir schauen es an.', at: '2026-09-08T09:00:00Z' },
      { side: 'author', body: 'Und wann?', at: '2026-09-09T09:00:00Z' },
    ];
    const { container } = render();
    expect(container.textContent).toContain('Und wann?');
    expect(container.textContent).toContain('Einreichende Person');
  });

  it('bietet den Weg, ein Anliegen zu melden (A6)', () => {
    const { container } = render();
    expect(button(container, 'Anliegen melden')).toBeDefined();
  });

  it('zeigt ein abgeschlossenes Anliegen nur noch als Lesestück', () => {
    const { container } = render({ status: 'answered', response: 'Erledigt.' });
    expect(container.textContent).toContain('Erledigt.');
    expect(container.querySelector('ion-segment')).toBeNull();
    expect(button(container, 'Ablehnen')).toBeUndefined();
    expect(button(container, 'Anliegen melden')).toBeUndefined();
  });
});
