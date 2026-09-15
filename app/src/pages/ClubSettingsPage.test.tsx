import { act } from 'react';
import { fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClubSettingsPage } from './ClubSettingsPage';
import { ionProp, renderWithProviders } from '../test/utils';
import type { ClubSettings } from '../lib/database.types';

/**
 * Die Module sind kein Entwurf (FR-115).
 *
 * Der Befund, der diese Datei ausgelöst hat: Ein umgelegter Modulschalter war
 * beim nächsten Öffnen der Seite wieder aus. Nicht, weil das Speichern
 * fehlschlug – es wurde nie eines ausgelöst. Der Schalter setzte nur den
 * Entwurf, geschrieben hätte erst der Knopf am Fuss einer sehr langen Seite.
 *
 * Geprüft wird deshalb, **womit die Ansicht speichert** und **wann der
 * Entwurf stehen bleibt** (docs/TESTING.md §1.4 und §1.6). Ionic-Eingaben
 * lassen sich in jsdom nicht bedienen; der Schalter dagegen meldet sich über
 * ein `ionChange`-Ereignis, und genau daran hängt die Ansicht.
 */

let isAdmin: boolean;
let settings: ClubSettings | null;
let club: {
  id: string;
  name: string;
  season_start: string;
  settings: ClubSettings | null;
};

/**
 * Die Mitgliedschaften laden – und dabei **ein neues Objekt** liefern, wie es
 * react-query nach jedem Neuladen tut. Genau daran hing der Befund: Die
 * Ansicht füllte ihren Entwurf daraufhin erneut aus dem Verein.
 */
function loadClub() {
  club = {
    id: 'c1',
    name: 'TV Musterhausen',
    season_start: '2026-06-01',
    settings,
  };
}

const saveSettings = vi.fn();
const saveModules = vi.fn();
const success = vi.fn();
const failure = vi.fn();

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({ isAdmin, activeClub: club }),
}));

vi.mock('../hooks/useClubSettings', () => ({
  useSaveClubSettings: () => ({ mutate: saveSettings, isPending: false, error: null }),
  useSaveClubModules: () => ({ mutate: saveModules, isPending: false, error: null }),
  // UC-050: wer den Vereins-Puls unterschreibt. Diese Seite ruft es nicht auf –
  // der Mock braucht den Export trotzdem, weil er das ganze Modul ersetzt.
  useSavePulseGreetingRole: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ success, failure }),
}));

vi.mock('../hooks/useSample', () => ({
  useSampleContent: () => ({ data: [] }),
  useDropSampleContent: () => ({ mutate: vi.fn(), isPending: false }),
  useAdoptSample: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('../hooks/useGamification', () => ({
  usePointRules: () => ({ data: [] }),
}));

vi.mock('../hooks/useMedia', () => ({
  useRemoveMediaFile: () => ({ mutate: vi.fn(), isPending: false }),
  useUploadMedia: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSignedMediaUrl: () => null,
  logoUrl: () => null,
  pickImage: vi.fn(),
  // UC-050: Logo und Grussporträt liegen öffentlich, ein Gesicht nicht
  // (BR-216, BR-253). `ImagePicker` fragt damit, ob es signieren muss.
  isPublicKind: (kind: string) => kind === 'logo' || kind === 'greeting',
}));

/** Der Schalter zu einem Modul – gefunden über seine Überschrift. */
function moduleToggle(container: HTMLElement, title: string): Element {
  const toggle = [...container.querySelectorAll('ion-toggle')].find(
    (element) => element.querySelector('h2')?.textContent?.trim() === title,
  );
  if (!toggle) throw new Error(`Kein Schalter für «${title}»`);
  return toggle;
}

/** Umlegen. `ion-toggle` meldet sich über `ionChange`, nicht über einen Klick. */
function toggle(element: Element, checked: boolean) {
  act(() => {
    element.dispatchEvent(new CustomEvent('ionChange', { detail: { checked } }));
  });
}

/** `ion-button` bekommt in jsdom keine ARIA-Rolle (docs/TESTING.md §1.1). */
function button(container: HTMLElement, label: string): Element | undefined {
  return [...container.querySelectorAll('ion-button')].find(
    (element) => element.textContent?.trim() === label,
  );
}

describe('ClubSettingsPage', () => {
  beforeEach(() => {
    // `reset`, nicht `clear`: Ein Fall unten legt dem Speichern eine
    // Ablehnung unter – die bliebe sonst für die folgenden Fälle liegen.
    vi.resetAllMocks();
    isAdmin = true;
    settings = null;
    loadClub();
  });

  it('weist ab, wer nicht im Vorstand ist', () => {
    isAdmin = false;
    const { container } = renderWithProviders(<ClubSettingsPage />);

    expect(container.textContent).toContain('Nur der Vorstand kann den Verein bearbeiten.');
    expect(container.querySelectorAll('ion-toggle')).toHaveLength(0);
  });

  it('schreibt ein eingeschaltetes Modul sofort, ohne den Speichern-Knopf', () => {
    const { container } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);

    // Die ganze Modulkarte, nicht das einzelne Modul: So kann eine zweite
    // Umlegung die erste nicht zurücknehmen.
    expect(saveModules).toHaveBeenCalledTimes(1);
    expect(saveModules.mock.calls[0][0]).toEqual({ invoice: true });
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it('nimmt das Modul zum Bestehenden dazu, statt es zu ersetzen', () => {
    settings = { modules: { meeting: true } };
    loadClub();
    const { container } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);

    expect(saveModules.mock.calls[0][0]).toEqual({ meeting: true, invoice: true });
  });

  it('meldet, was umgelegt wurde', () => {
    saveModules.mockImplementation((_modules, options) => options?.onSuccess?.());
    const { container } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);

    expect(success).toHaveBeenCalledWith('«Rechnungen» eingeschaltet.');
  });

  it('springt zurück, wenn der Server die Änderung ablehnt', () => {
    // Der Fall, den es ohne Rückmeldung gäbe: Der Schalter steht auf ein,
    // geschrieben ist nichts – und niemand erfährt es.
    saveModules.mockImplementation((_modules, options) =>
      options?.onError?.(new Error('Nicht gespeichert.')),
    );
    const { container } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);

    expect(ionProp(moduleToggle(container, 'Rechnungen'), 'checked')).toBe(false);
    expect(failure).toHaveBeenCalledWith('Nicht gespeichert.');
  });

  it('lässt den Schalter stehen, während die Mitgliedschaften neu laden', () => {
    // `activeClub` ist nach jedem Laden ein neues Objekt. Füllte die Ansicht
    // ihren Entwurf daraufhin erneut aus dem Verein, stünde der eben
    // umgelegte Schalter sofort wieder auf dem alten Wert – und zwar auch
    // jeder halb getippte Text daneben.
    const { container, rerender } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);
    expect(ionProp(moduleToggle(container, 'Rechnungen'), 'checked')).toBe(true);

    // Die Mitgliedschaften sind neu geladen – noch ohne den eben
    // geschriebenen Stand, die Antwort ist unterwegs.
    loadClub();
    rerender(<ClubSettingsPage />);

    expect(ionProp(moduleToggle(container, 'Rechnungen'), 'checked')).toBe(true);
  });

  it('schickt die Module beim Speichern mit, damit der Knopf sie nicht abräumt', () => {
    // Der Speichern-Knopf schreibt den ganzen Einstellungsblock. Kennte er
    // die eben umgelegten Module nicht, nähme er sie wieder weg – die
    // Antwort auf das sofortige Schreiben ist vielleicht noch unterwegs.
    const { container } = renderWithProviders(<ClubSettingsPage />);

    toggle(moduleToggle(container, 'Rechnungen'), true);
    fireEvent.click(button(container, 'Speichern')!);

    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(saveSettings.mock.calls[0][0].settings.modules).toEqual({ invoice: true });
  });
});
