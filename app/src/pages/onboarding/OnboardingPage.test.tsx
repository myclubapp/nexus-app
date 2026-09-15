import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';
import { ionProp, renderWithProviders } from '../../test/utils';
import type { ClubLookup } from '../../hooks/useJoinRequests';

/**
 * Onboarding (UC-001, UC-002, UC-004).
 *
 * Zwei Dinge sind hier zu prüfen, und beide sind Zustände einer Ansicht
 * (docs/TESTING.md §1.4) – die Ionic-Eingaben selbst lassen sich in jsdom
 * nicht bedienen:
 *
 *   1. **BR-258:** Ein Verein, der keine offenen Anfragen annimmt, führt nicht
 *      in einen Knopf, den der Server abweist.
 *   2. Die Seite steht in **einer** Spalte – dieselbe wie die Anmeldung. Der
 *      Befund, gegen den das steht: Formular und Knopfleiste lagen ausserhalb
 *      der zentrierten Spalte und zogen sich auf grossen Bildschirmen über die
 *      ganze Fensterbreite.
 */

let found: ClubLookup | null = null;

const findMutate = vi.fn();
const requestMutate = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock('../../hooks/useOnboarding', () => ({
  useCreateClub: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useRedeemInvite: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../../hooks/useJoinRequests', () => ({
  useFindClub: () => ({
    mutate: (slug: string, options?: { onSuccess?: (club: ClubLookup | null) => void }) => {
      findMutate(slug);
      options?.onSuccess?.(found);
    },
    isPending: false,
    error: null,
  }),
  useRequestJoin: () => ({ mutate: requestMutate, isPending: false, error: null }),
  useWithdrawJoinRequest: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useMyJoinRequest: () => ({ data: null }),
}));

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §1.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return Array.from(container.querySelectorAll('ion-button')).find(
    (element) => element.textContent?.trim() === label,
  );
}

/**
 * Den Kurznamen suchen – über den Knopf, den die Person drückt.
 *
 * `act()` um jeden Griff: Ohne es bleibt die Zustandsänderung in der Warteslange
 * und der Test liest das DOM von vorher.
 */
function search(container: HTMLElement) {
  act(() => {
    (button(container, 'Verein suchen') as HTMLElement | undefined)?.click();
  });
}

/** Auf «Anfragen» umschalten; das Segment meldet sich über `ionChange`. */
function chooseRequestMode(container: HTMLElement) {
  act(() => {
    container
      .querySelector('ion-segment')
      ?.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'request' } }));
  });
}

describe('OnboardingPage', () => {
  beforeEach(() => {
    found = null;
    vi.clearAllMocks();
  });

  it('steht vollständig in einer zentrierten Spalte wie die Anmeldung', () => {
    const { container } = renderWithProviders(<OnboardingPage />);

    const column = container.querySelector('.app-auth');
    expect(column).not.toBeNull();
    // Das Segment war schon vorher in der Spalte – Wizard, Liste und
    // Knopfleiste lagen daneben. Sie gehören alle hinein.
    expect(column?.querySelector('ion-segment')).not.toBeNull();
    expect(column?.querySelector('ion-list')).not.toBeNull();
    expect(column?.querySelector('.app-actions')).not.toBeNull();
    // Keine Kopfzeile: Die Seite vor dem Verein hat kein Zurück und kein Menü.
    expect(container.querySelector('ion-header')).toBeNull();
  });

  it('führt durch die Gründung in drei Schritten (BR-004)', () => {
    const { container } = renderWithProviders(<OnboardingPage />);

    expect(container.querySelector('ion-progress-bar')).not.toBeNull();
    expect(container.textContent).toContain('Schritt 1 von 3');
  });

  it('bietet die Anfrage an, wo der Verein sie annimmt (UC-004)', () => {
    found = { clubId: 'c1', clubName: 'TV Musterhausen', acceptsRequests: true };
    const { container } = renderWithProviders(<OnboardingPage />);

    chooseRequestMode(container);
    search(container);

    const send = button(container, 'Anfrage senden');
    expect(send).toBeDefined();
    // `disabled` steht am Web-Component als Eigenschaft, nicht als Attribut:
    // In jsdom wird das Element nicht aufgewertet (docs/TESTING.md §1.1).
    expect(ionProp<boolean>(send!, 'disabled')).toBe(false);
  });

  it('nennt den Verein, aber verspricht keine Anfrage, wo er sie zumacht (BR-258)', () => {
    found = { clubId: 'c1', clubName: 'TV Musterhausen', acceptsRequests: false };
    const { container } = renderWithProviders(<OnboardingPage />);

    chooseRequestMode(container);
    search(container);

    // Der Verein steht da – der Kurzname war richtig, und das soll die Person
    // wissen, statt ihn für falsch zu halten.
    expect(container.textContent).toContain('TV Musterhausen');
    expect(container.textContent).toContain(
      'Dieser Verein nimmt keine offenen Anfragen entgegen.',
    );
    // Aber der Knopf verspricht nichts: Der Server wiese ihn ab (`0101`).
    expect(ionProp<boolean>(button(container, 'Anfrage senden')!, 'disabled')).toBe(true);
    expect(requestMutate).not.toHaveBeenCalled();
  });

  it('nennt den Weg, der bleibt – die Einladung', () => {
    found = { clubId: 'c1', clubName: 'TV Musterhausen', acceptsRequests: false };
    const { container } = renderWithProviders(<OnboardingPage />);

    chooseRequestMode(container);
    search(container);

    // FR-144/BR-165: kein Zustand ohne nächsten Schritt. Eine rote Meldung
    // wäre hier falsch – die Person hat nichts falsch gemacht.
    expect(container.textContent).toContain('über eine Einladung');
    expect(container.querySelector('.app-form-error')).toBeNull();
  });
});
