import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, setLanguage } from '../test/utils';
import { DateField } from './DateField';

/**
 * Wie in `AgendaCalendar.test.tsx`: `IonDatetime` nimmt in jsdom keine
 * Eigenschaft an (docs/TESTING.md). Der Stub zeichnet auf, was `DateField`
 * dem Wähler übergibt – das ist der Vertrag, um den es hier geht.
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
      return <div />;
    },
  };
});

type ChangeHandler = (event: { detail: { value: string | string[] | null } }) => void;

function renderField(props: Partial<Parameters<typeof DateField>[0]> = {}) {
  const onChange = vi.fn();
  renderWithProviders(
    <DateField
      label="Beginn"
      value="2026-09-13T19:00"
      presentation="date-time"
      onChange={onChange}
      {...props}
    />,
  );
  const datetime = datetimeProps[datetimeProps.length - 1];
  if (!datetime) throw new Error('IonDatetime wurde nicht gerendert');
  return { datetime, onChange };
}

beforeEach(() => {
  datetimeProps.length = 0;
});

afterEach(async () => {
  await setLanguage('de');
});

describe('DateField', () => {
  it('belegt jeden Wähler gleich vor: Montag, 00–23, Schweizer Sprache', () => {
    const { datetime } = renderField();
    expect(datetime).toMatchObject({
      presentation: 'date-time',
      value: '2026-09-13T19:00',
      locale: 'de-CH',
      firstDayOfWeek: 1,
      hourCycle: 'h23',
    });
  });

  it('folgt der Sprache der App', async () => {
    await setLanguage('fr');
    const { datetime } = renderField();
    expect(datetime.locale).toBe('fr-CH');
  });

  it('lässt ohne Angabe jeden Tag zu – Spiele fallen auf Wochenenden', () => {
    const { datetime } = renderField();
    expect(datetime.isDateEnabled).toBeUndefined();
  });

  it('reicht eine Tagesregel an Ionic weiter', () => {
    const isDateEnabled = (iso: string) => !iso.startsWith('2026-09-13');
    const { datetime } = renderField({ isDateEnabled });
    expect(datetime.isDateEnabled).toBe(isDateEnabled);
  });

  it('gibt dem Formular sein Format zurück, nicht das von Ionic', () => {
    const { datetime, onChange } = renderField();
    (datetime.onIonChange as ChangeHandler)({ detail: { value: '2026-09-14T18:30:00' } });
    expect(onChange).toHaveBeenCalledWith('2026-09-14T18:30');
  });

  it('übersetzt die Knöpfe, die Ionic sonst englisch beschriftet', () => {
    const { datetime } = renderField();
    expect(datetime).toMatchObject({ doneText: 'OK', cancelText: 'Abbrechen' });
  });
});
