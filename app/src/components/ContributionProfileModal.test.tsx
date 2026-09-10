import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContributionProfileForm } from './ContributionProfileModal';
import { renderWithProviders } from '../test/utils';
import type { ContributionProfile } from '../lib/contribution';

const saveMutate = vi.fn();

vi.mock('../hooks/useContribution', () => ({
  useSaveContributionProfile: () => ({
    mutate: saveMutate,
    isPending: false,
    error: null,
  }),
}));

/** `IonModal` rendert seinen Inhalt in jsdom nicht (docs/TESTING.md §6.5). */
vi.mock('./FormModal', () => ({
  FormModal: ({
    children,
    submitLabel,
    canSubmit,
    onSubmit,
  }: {
    children: ReactNode;
    submitLabel?: string;
    canSubmit?: boolean;
    onSubmit: () => void;
  }) => (
    <div>
      <button
        type="button"
        id="modal-submit"
        disabled={canSubmit === false}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
      {children}
    </div>
  ),
}));

function profile(overrides: Partial<ContributionProfile> = {}): ContributionProfile {
  return {
    interests: [],
    strengths: '',
    timeBudget: null,
    updatedAt: null,
    ...overrides,
  };
}

const source = (file: string) => readFileSync(`${process.cwd()}/src/${file}`, 'utf8');

/**
 * UC-033 dreht die Richtung um: **«Anfragen statt abfragen»** (BR-142).
 *
 * Das ist im Blatt daran ablesbar, dass die Frage nach dem Menschen **vor** der
 * Kategorienliste steht – genau das prüft dieser Test. Eine Ionic-Eingabe lässt
 * sich in jsdom nicht bedienen (docs/TESTING.md §6.4); die Regeln stehen in
 * `lib/contribution.ts` und werden dort geprüft.
 */
describe('ContributionProfileForm', () => {
  beforeEach(() => vi.clearAllMocks());

  function render(existing: ContributionProfile | null = null) {
    return renderWithProviders(
      <ContributionProfileForm
        profile={existing}
        onDone={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
  }

  it('fragt zuerst nach dem Menschen, dann nach der Kategorie (BR-142)', () => {
    const { container } = render();
    const headers = [...container.querySelectorAll('ion-list-header')].map((element) =>
      element.textContent?.trim(),
    );
    const person = headers.indexOf('Was wäre für dich ein sinnvoller Beitrag?');
    const categories = headers.indexOf('Womit trägst du gern bei?');

    expect(person).toBeGreaterThanOrEqual(0);
    expect(person).toBeLessThan(categories);
  });

  it('nennt die Freiwilligkeit im Blatt, nicht nur in der Spezifikation (BR-143)', () => {
    const { container } = render();
    expect(container.textContent).toContain('Alles freiwillig');
    expect(container.textContent).toContain('niemand erfährt, wer keines führt');
  });

  it('lässt ein leeres Profil speichern (A1)', () => {
    // «Später ausfüllen» darf kein Abbruch sein. Wäre der Knopf gesperrt,
    // bliebe nur das Wegwischen – und dann wüsste niemand, dass gefragt wurde.
    const { container } = render();
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      false,
    );
  });

  it('sperrt ein ausgefülltes Profil ohne Zeitbudget (BR-144)', () => {
    const { container } = render(profile({ interests: ['catering'] }));
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      true,
    );
    expect(container.textContent).toContain('Wähle dein Zeitbudget');
  });

  it('übernimmt ein bestehendes Profil zum Ändern (A2)', () => {
    const { container } = render(
      profile({ strengths: 'Ich koche gern für viele.', timeBudget: 'monthly' }),
    );
    expect(container.querySelector<HTMLButtonElement>('#modal-submit')!.disabled).toBe(
      false,
    );
  });

  it('bietet die acht Kategorien des Marktplatzes an', () => {
    const { container } = render();
    const options = [...container.querySelectorAll('ion-select-option')];
    expect(options).toHaveLength(8);
  });

  it('bietet genau drei Zeitbudgets an', () => {
    const { container } = render();
    const steps = [...container.querySelectorAll('ion-segment-button')].map((element) =>
      element.textContent?.trim(),
    );
    expect(steps).toEqual(['Einmalig', 'Monatlich', 'Saisonal']);
  });

  it('führt keinen Weg in die Führungssicht (BR-145)', () => {
    // Das Profil erscheint nicht in Gesundheitsansichten und löst kein Signal
    // aus. Hier wird festgehalten, dass weder Blatt noch Hook einen solchen
    // Weg kennen – die Policy in `0051` ist die eigentliche Sperre.
    const modal = source('components/ContributionProfileModal.tsx');
    const hook = source('hooks/useContribution.ts');
    for (const file of [modal, hook]) {
      expect(file).not.toMatch(/health_signal|useHealth|detect_health/);
    }
  });
});
