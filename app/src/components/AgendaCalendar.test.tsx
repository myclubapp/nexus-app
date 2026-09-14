import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/utils';
import { AgendaCalendar } from './AgendaCalendar';
import { MARK_ACTIVE } from '../lib/agendaCalendar';

/**
 * `IonDatetime` bekommt seine Eigenschaften in jsdom nicht – keine einzige,
 * nicht einmal `presentation` (docs/TESTING.md, «Was Ionic in jsdom anders
 * macht»). Geprüft wird deshalb der Vertrag: was das Bauteil dem Wähler
 * übergibt. Der Stub zeichnet die Props auf und lässt `onIonChange` als
 * Funktion aufrufen.
 */
const { datetimeProps } = vi.hoisted(() => ({
  datetimeProps: [] as Array<Record<string, unknown>>,
}));

vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...actual,
    IonDatetime: (props: Record<string, unknown>) => {
      datetimeProps.push(props);
      return <div aria-label={props['aria-label'] as string} />;
    },
  };
});

type ChangeHandler = (event: { detail: { value: string | string[] | null } }) => void;

function renderCalendar(onChange = vi.fn(), marks = [{ date: '2026-09-20', ...MARK_ACTIVE }]) {
  renderWithProviders(<AgendaCalendar value="2026-09-13" onChange={onChange} marks={marks} />);
  const props = datetimeProps[datetimeProps.length - 1];
  if (!props) throw new Error('IonDatetime wurde nicht gerendert');
  return { props, onChange, marks };
}

beforeEach(() => {
  datetimeProps.length = 0;
});

describe('AgendaCalendar', () => {
  it('teilt Sprache, Wochenstart und Stundenzählung mit den Datumsfeldern', () => {
    const { props } = renderCalendar();
    expect(props).toMatchObject({
      presentation: 'date',
      size: 'cover',
      value: '2026-09-13',
      locale: 'de-CH',
      firstDayOfWeek: 1,
      hourCycle: 'h23',
    });
  });

  it('gibt die Markierungen als Array weiter (Ionic-Doku «Using Array»)', () => {
    const { props, marks } = renderCalendar();
    expect(props.highlightedDates).toBe(marks);
  });

  it('meldet den gewählten Tag als YYYY-MM-DD', () => {
    const { props, onChange } = renderCalendar();
    (props.onIonChange as ChangeHandler)({ detail: { value: '2026-09-14T00:00:00' } });
    expect(onChange).toHaveBeenCalledWith('2026-09-14');
  });

  it('meldet nichts, wenn die Auswahl gelöscht wurde', () => {
    const { props, onChange } = renderCalendar();
    (props.onIonChange as ChangeHandler)({ detail: { value: null } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ist für Bedienhilfen beschriftet', () => {
    const { props } = renderCalendar();
    expect(props['aria-label']).toBe('Monatskalender');
  });
});
