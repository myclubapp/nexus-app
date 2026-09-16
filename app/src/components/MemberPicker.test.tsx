import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { MemberPickerFields, MemberSelect, type PickableMember } from './MemberPicker';
import { renderWithProviders } from '../test/utils';
import { EMPTY_MEMBER_PICK_FILTER } from '../lib/member';

const MEMBERS: PickableMember[] = [
  {
    id: 'm-1',
    display_name: 'Simon Aeberhardt',
    avatar_url: null,
    role: 'member',
    status: 'active',
    teamIds: ['t-1'],
    teamNames: ['Herren 1'],
  },
  {
    id: 'm-2',
    display_name: 'Lars Sutter',
    avatar_url: null,
    role: 'trainer',
    status: 'active',
    teamIds: ['t-2'],
    teamNames: ['Junioren'],
  },
  {
    id: 'm-3',
    display_name: 'Ännu Zurbrügg',
    avatar_url: null,
    role: 'member',
    status: 'left',
    teamIds: [],
    teamNames: [],
  },
];

const TEAMS = [
  { id: 't-1', name: 'Herren 1' },
  { id: 't-2', name: 'Junioren' },
];

/**
 * Der Wähler ersetzt das Auswahl-Blatt eines `IonSelect` überall dort, wo
 * Mitglieder gewählt werden. Geprüft wird, was er dem `IonSelect` **voraus
 * hat**: die Suche, die Eingrenzung auf Teams und die Zeile «niemand» –
 * und dass die Auswahl selbst richtig herauskommt.
 *
 * Das Blatt darum herum (`MemberPickerModal`) rendert in jsdom nicht
 * (docs/TESTING.md); es deckt der manuelle Testplan ab.
 */
describe('MemberPickerFields', () => {
  function render(options: Partial<Parameters<typeof MemberPickerFields>[0]> = {}) {
    const onToggle = vi.fn();
    const onFilter = vi.fn();
    const result = renderWithProviders(
      <MemberPickerFields
        members={MEMBERS}
        teams={TEAMS}
        filter={EMPTY_MEMBER_PICK_FILTER}
        onFilter={onFilter}
        selected={[]}
        multiple={false}
        onToggle={onToggle}
        {...options}
      />,
    );
    return { ...result, onToggle, onFilter };
  }

  it('zeigt die Namen nach Alphabet, mit Umlaut an seiner Stelle', () => {
    const { container } = render();
    const names = Array.from(container.querySelectorAll('h2')).map(
      (node) => node.textContent,
    );
    // Sortiert wird nach `display_name`, und der beginnt mit dem Vornamen;
    // «Ännu» steht mit `localeCompare('de')` bei den A.
    expect(names).toEqual(['Ännu Zurbrügg', 'Lars Sutter', 'Simon Aeberhardt']);
  });

  it('grenzt auf die Suche ein – das, was ein IonSelect nicht kann', () => {
    render({ filter: { ...EMPTY_MEMBER_PICK_FILTER, search: 'sutt' } });
    expect(screen.getByText('Lars Sutter')).toBeTruthy();
    expect(screen.queryByText('Simon Aeberhardt')).toBeNull();
  });

  it('grenzt auf die gewählten Teams ein', () => {
    render({ filter: { ...EMPTY_MEMBER_PICK_FILTER, teamIds: ['t-1'] } });
    expect(screen.getByText('Simon Aeberhardt')).toBeTruthy();
    expect(screen.queryByText('Lars Sutter')).toBeNull();
  });

  it('wählt die Teams in einer Zeile, mehrere auf einmal', () => {
    // Nicht als Chips: Ein Dutzend Teams füllte sonst den ganzen Bildschirm.
    const { container, onFilter } = render();
    const selects = container.querySelectorAll('ion-select');
    expect(selects).toHaveLength(1);
    expect(container.querySelectorAll('ion-select-option')).toHaveLength(TEAMS.length);
    expect(container.querySelector('ion-chip')).toBeNull();

    act(() => {
      selects[0].dispatchEvent(
        new CustomEvent('ionChange', { detail: { value: ['t-1', 't-2'] }, bubbles: true }),
      );
    });
    expect(onFilter).toHaveBeenCalledWith({ search: '', teamIds: ['t-1', 't-2'] });
  });

  it('lässt die Team-Wahl nicht bis zum umgebenden Formular aufsteigen', () => {
    // Dessen Entwurfswächter hört auf `ionChange`; ein Filter ist kein Entwurf.
    const { container } = render();
    const outside = vi.fn();
    container.addEventListener('ionChange', outside);

    act(() => {
      container
        .querySelector('ion-select')!
        .dispatchEvent(new CustomEvent('ionChange', { detail: { value: ['t-1'] }, bubbles: true }));
    });
    expect(outside).not.toHaveBeenCalled();
  });

  it('zeigt keine Team-Zeile, solange es nur ein Team gibt', () => {
    const { container } = render({ teams: [TEAMS[0]] });
    expect(container.querySelector('ion-select')).toBeNull();
  });

  it('gibt die angetippte Person heraus', () => {
    const { onToggle } = render();
    fireEvent.click(screen.getByText('Lars Sutter'));
    expect(onToggle).toHaveBeenCalledWith('m-2');
  });

  it('stellt «niemand» zuoberst, wo die Auswahl leer bleiben darf', () => {
    const { onToggle, container } = render({ noneLabel: 'Ohne Konto' });
    // Die erste Liste ist die Team-Zeile; «niemand» führt die Namensliste an.
    const lists = container.querySelectorAll('ion-list');
    const first = lists[lists.length - 1].querySelector('ion-item');
    expect(first?.textContent).toContain('Ohne Konto');

    fireEvent.click(screen.getByText('Ohne Konto'));
    expect(onToggle).toHaveBeenCalledWith(null);
  });

  it('kennt ohne «niemand» keine solche Zeile', () => {
    render();
    expect(screen.queryByText('Ohne Konto')).toBeNull();
  });

  it('markiert die geltende Wahl in der Zeile', () => {
    const { container } = render({ selected: ['m-2'] });
    const chosen = Array.from(container.querySelectorAll('ion-item')).find(
      (item) => item.textContent?.includes('Lars Sutter'),
    );
    expect(chosen?.getAttribute('aria-current')).toBe('true');
  });

  it('sagt, wer nicht mehr dabei ist – ohne die Person zu verstecken', () => {
    // Eine Korrekturbuchung oder ein aufzulösendes Amt betrifft genau sie.
    const { container } = render();
    const row = Array.from(container.querySelectorAll('ion-item')).find(
      (item) => item.textContent?.includes('Ännu Zurbrügg'),
    );
    expect(row?.textContent).toContain('Ausgetreten');
  });

  it('schaltet bei Mehrfachauswahl auf Kästchen um', () => {
    const { container } = render({ multiple: true, selected: ['m-1'] });
    expect(container.querySelectorAll('ion-checkbox')).toHaveLength(MEMBERS.length);
  });

  it('bietet im leeren Filter den Weg zurück an', () => {
    const { onFilter } = render({
      filter: { ...EMPTY_MEMBER_PICK_FILTER, search: 'gibtesnicht' },
    });
    fireEvent.click(screen.getByText('Filter zurücksetzen'));
    expect(onFilter).toHaveBeenCalledWith(EMPTY_MEMBER_PICK_FILTER);
  });
});

vi.mock('../hooks/useMembers', () => ({
  useMembers: () => ({ data: MEMBERS, isLoading: false, error: null }),
}));

vi.mock('../hooks/useInvites', () => ({
  useTeams: () => ({ data: TEAMS, isLoading: false, error: null }),
}));

/**
 * Die Zeile, die zum Blatt führt. Sie trägt die Wahl, damit niemand das Blatt
 * öffnen muss, um zu sehen, was gewählt ist.
 */
describe('MemberSelect', () => {
  it('nennt die gewählte Person beim Namen', () => {
    renderWithProviders(
      <MemberSelect label="Mitglied" value="m-2" onChange={vi.fn()} />,
    );
    expect(screen.getByText('Lars Sutter')).toBeTruthy();
  });

  it('zeigt ohne Wahl die Beschriftung für «niemand»', () => {
    renderWithProviders(
      <MemberSelect
        label="Mitglied"
        noneLabel="Ohne Konto"
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Ohne Konto')).toBeTruthy();
  });

  it('nennt bei zwei Personen beide, bei dreien ihre Zahl', () => {
    const { rerender } = renderWithProviders(
      <MemberSelect multiple label="Mitglieder" value={['m-1', 'm-2']} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Lars Sutter, Simon Aeberhardt')).toBeTruthy();

    rerender(
      <MemberSelect
        multiple
        label="Mitglieder"
        value={['m-1', 'm-2', 'm-3']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('3 gewählt')).toBeTruthy();
  });

  it('hält den schon bekannten Namen, solange die Liste ihn nicht kennt', () => {
    // Der Fall des Amts-Blattes: Die Belegung trägt ihren Namen selbst.
    renderWithProviders(
      <MemberSelect
        label="Mitglied"
        fallbackName="Sandro Scalco"
        value="m-unbekannt"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Sandro Scalco')).toBeTruthy();
  });
});
