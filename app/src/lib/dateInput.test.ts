import { describe, expect, it } from 'vitest';
import { fromPickerValue, toPickerValue } from './dateInput';

describe('toPickerValue', () => {
  it('lässt ein leeres Feld leer – nichts gewählt ist nicht «heute»', () => {
    expect(toPickerValue('')).toBeUndefined();
    expect(toPickerValue('   ')).toBeUndefined();
  });

  it('reicht einen Wert unverändert weiter', () => {
    expect(toPickerValue('2026-09-11T18:00')).toBe('2026-09-11T18:00');
  });
});

describe('fromPickerValue', () => {
  it('kürzt ein Datum auf zehn Zeichen, auch wenn Ionic die Zeit mitschickt', () => {
    expect(fromPickerValue('2026-09-11T00:00:00', 'date')).toBe('2026-09-11');
    expect(fromPickerValue('2026-09-11', 'date')).toBe('2026-09-11');
  });

  it('kürzt Datum und Zeit auf Minuten – so wie das Formular sie hält', () => {
    expect(fromPickerValue('2026-09-11T18:30:00', 'date-time')).toBe('2026-09-11T18:30');
  });

  it('holt aus einer Zeit die fünf Zeichen, egal wie Ionic sie liefert', () => {
    expect(fromPickerValue('13:45:00', 'time')).toBe('13:45');
    expect(fromPickerValue('2026-09-11T13:45:00', 'time')).toBe('13:45');
    expect(fromPickerValue('13:45', 'time')).toBe('13:45');
  });

  it('nimmt aus einer Mehrfachauswahl den ersten Wert', () => {
    expect(fromPickerValue(['2026-09-11', '2026-09-12'], 'date')).toBe('2026-09-11');
  });

  it('macht aus gelöscht ein leeres Feld', () => {
    expect(fromPickerValue(null, 'date')).toBe('');
    expect(fromPickerValue(undefined, 'time')).toBe('');
    expect(fromPickerValue([], 'date-time')).toBe('');
  });
});
