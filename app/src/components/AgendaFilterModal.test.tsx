import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import {
  AgendaFilterFields,
  EMPTY_AGENDA_FILTER,
  FILTERABLE_EVENT_TYPES,
  agendaFilterFromParam,
  countActiveFilters,
  type AgendaFilterState,
} from './AgendaFilterModal';
import { renderWithProviders } from '../test/utils';

vi.mock('../hooks/useClub', () => ({
  useClub: () => ({
    eventLabel: (type: string) => `label:${type}`,
  }),
}));

/**
 * Geprüft wird, was das Blatt **entscheidet**: Mehrfachauswahl bei den Arten,
 * Einfachauswahl beim Team, kein Team-Abschnitt ohne Teams, und die Zahl,
 * die am Filterknopf und auf «Anwenden» steht. Die Bedienung des Blatts
 * selbst (Öffnen, Schliessen, Karte) deckt der manuelle Testplan ab.
 */
describe('AgendaFilterFields', () => {
  const teams = [
    { id: 't1', name: 'Herren 1' },
    { id: 't2', name: 'Junioren' },
  ];

  function render(value: AgendaFilterState = EMPTY_AGENDA_FILTER, withTeams = true) {
    const onChange = vi.fn();
    const result = renderWithProviders(
      <AgendaFilterFields value={value} onChange={onChange} teams={withTeams ? teams : []} />,
    );
    return { ...result, onChange };
  }

  it('kennt Cup und Turnier nicht mehr', () => {
    expect(FILTERABLE_EVENT_TYPES).not.toContain('cup');
    expect(FILTERABLE_EVENT_TYPES).not.toContain('tournament');
    render();
    expect(screen.queryByText('label:cup')).toBeNull();
    expect(screen.getByText('label:match')).toBeTruthy();
  });

  it('beschriftet die Arten über den Verein, nicht über ein festes Vokabular', () => {
    render();
    for (const type of FILTERABLE_EVENT_TYPES) {
      expect(screen.getByText(`label:${type}`)).toBeTruthy();
    }
  });

  it('sammelt Terminarten als Mehrfachauswahl', () => {
    const { onChange } = render({ types: ['training'], teamId: null });
    fireEvent.click(screen.getByText('label:match'));
    expect(onChange).toHaveBeenCalledWith({ types: ['training', 'match'], teamId: null });
  });

  it('nimmt eine gewählte Art beim zweiten Tippen wieder heraus', () => {
    const { onChange } = render({ types: ['training', 'match'], teamId: null });
    fireEvent.click(screen.getByText('label:training'));
    expect(onChange).toHaveBeenCalledWith({ types: ['match'], teamId: null });
  });

  it('kennt beim Team nur eines – das zweite ersetzt das erste', () => {
    const { onChange } = render({ types: [], teamId: 't1' });
    fireEvent.click(screen.getByText('Junioren'));
    expect(onChange).toHaveBeenCalledWith({ types: [], teamId: 't2' });
  });

  it('löst das Team beim zweiten Tippen wieder', () => {
    const { onChange } = render({ types: [], teamId: 't1' });
    fireEvent.click(screen.getByText('Herren 1'));
    expect(onChange).toHaveBeenCalledWith({ types: [], teamId: null });
  });

  it('zeigt ohne Teams keinen Team-Abschnitt', () => {
    render(EMPTY_AGENDA_FILTER, false);
    expect(screen.queryByText('Herren 1')).toBeNull();
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it('markiert die gewählten Chips für Bedienhilfen', () => {
    render({ types: ['gv'], teamId: 't2' });
    // Geprüft wird `aria-checked`, das als Attribut ankommt. Das `role` setzt
    // der Lit-Wrapper von Ionic 9 als Eigenschaft; jsdom ohne Stencil verliert
    // es, der Browser spiegelt es ins Attribut.
    const chip = (text: string) => screen.getByText(text).closest('ion-chip')!;
    expect(chip('label:gv').getAttribute('aria-checked')).toBe('true');
    expect(chip('label:match').getAttribute('aria-checked')).toBe('false');
    expect(chip('Junioren').getAttribute('aria-checked')).toBe('true');
    expect(chip('Herren 1').getAttribute('aria-checked')).toBe('false');
  });
});

describe('countActiveFilters', () => {
  it('zählt je Abschnitt einen Filter, nicht je Chip', () => {
    expect(countActiveFilters(EMPTY_AGENDA_FILTER)).toBe(0);
    expect(countActiveFilters({ types: ['training', 'match', 'gv'], teamId: null })).toBe(1);
    expect(countActiveFilters({ types: [], teamId: 't1' })).toBe(1);
    expect(countActiveFilters({ types: ['helper'], teamId: 't1' })).toBe(2);
  });
});

/**
 * Der Verweis aus dem Marktplatz (`/tabs/agenda?type=helper`) setzt den
 * Filter. Geprüft wird, dass er nur bekannte Arten setzt und eine bestehende
 * Auswahl nie versehentlich löscht.
 */
describe('agendaFilterFromParam', () => {
  it('macht aus der Terminart des Verweises einen Filter', () => {
    expect(agendaFilterFromParam('helper')).toEqual({ types: ['helper'], teamId: null });
  });

  it('nimmt mehrere Arten als Liste entgegen', () => {
    expect(agendaFilterFromParam('helper,social')).toEqual({
      types: ['helper', 'social'],
      teamId: null,
    });
  });

  it('lässt den gesetzten Filter in Ruhe, wenn nichts Bekanntes dasteht', () => {
    // `null` heisst «nichts anwenden» – ein verirrter Parameter darf keine
    // Auswahl löschen.
    expect(agendaFilterFromParam(null)).toBeNull();
    expect(agendaFilterFromParam('')).toBeNull();
    expect(agendaFilterFromParam('cup')).toBeNull();
  });

  it('verwirft Unbekanntes, behält aber den gültigen Teil', () => {
    expect(agendaFilterFromParam('cup,helper')).toEqual({ types: ['helper'], teamId: null });
  });
});
