import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deliverFile, fileDateStamp, slugify } from './fileExport';

describe('deliverFile()', () => {
  beforeEach(() => {
    // jsdom kennt weder `createObjectURL` noch einen Download: Ein Klick auf
    // `<a download>` meldet «Not implemented: navigation to another
    // Document». Geprüft wird, **dass** es zum Herausgeben kommt.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const file = {
    text: '# Kassier:in\n',
    fileName: 'amt.md',
    title: 'amt.md',
    mimeType: 'text/markdown;charset=utf-8',
  };

  it('geht nativ ins Teilen-Blatt', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(deliverFile({ ...file, canShareNatively: true, share })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'amt.md', text: '# Kassier:in\n' });
  });

  it('nimmt die Zwischenablage, wenn das Teilen-Blatt abbricht', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const share = vi.fn().mockRejectedValue(new Error('abgebrochen'));

    await expect(deliverFile({ ...file, canShareNatively: true, share })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('# Kassier:in\n');
  });

  it('behauptet nichts, wenn es gar keine Zwischenablage gibt', async () => {
    // In einem unsicheren Kontext fehlt `navigator.clipboard` ganz. Ein
    // optionales `?.` liefe hier still durch und meldete «kopiert».
    vi.stubGlobal('navigator', {});
    const share = vi.fn().mockRejectedValue(new Error('abgebrochen'));

    await expect(deliverFile({ ...file, canShareNatively: true, share })).resolves.toBe('failed');
  });

  it('meldet den Fehlschlag, wenn auch das Kopieren scheitert', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('verweigert')) },
    });
    const share = vi.fn().mockRejectedValue(new Error('abgebrochen'));

    await expect(deliverFile({ ...file, canShareNatively: true, share })).resolves.toBe('failed');
  });

  it('lädt im Browser herunter – mit dem Vorspann nur in der Datei', async () => {
    const share = vi.fn();
    let written: unknown[] = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      written = [blob];
      return 'blob:test';
    });

    await expect(
      deliverFile({ ...file, filePrefix: '﻿', canShareNatively: false, share }),
    ).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    // In den **Bytes** geprüft: `Blob.text()` dekodiert nach UTF-8 und
    // entfernt ein führendes BOM dabei – der Test sähe es nie.
    const bytes = new Uint8Array(await (written[0] as Blob).arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('# Kassier:in\n');
  });
});

describe('Dateinamen', () => {
  it('löst Umlaute auf und lässt keinen Pfad zu', () => {
    expect(slugify('Halle / BBC')).toBe('halle-bbc');
    expect(slugify('Ämter für Grössere')).toBe('amter-fur-grossere');
    expect(slugify('../etc/passwd')).toBe('etc-passwd');
    expect(slugify(null)).toBe('');
  });

  it('datiert nach ISO, damit eine Ablage von selbst sortiert', () => {
    expect(fileDateStamp(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});
