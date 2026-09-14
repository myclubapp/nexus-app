/**
 * CSV für den Export (UC-042, UC-043).
 *
 * Bis hierher stand die Quotierung in `contributionGoal.ts` – als der Export
 * der Mitgliederliste dazukam, wäre sie ein zweites Mal dagestanden. Eine
 * Regel, die zweimal im Repository steht, läuft auseinander; deshalb hier.
 *
 * **Semikolon als Trennzeichen:** Excel liest in der Schweiz eine
 * Komma-CSV in einer einzigen Spalte.
 *
 * **Jedes Feld gequotet, enthaltene Anführungszeichen verdoppelt:** Ein
 * Mitgliedsname mit Semikolon darf die Spalten nicht verschieben, eine
 * Adresse mit Zeilenumbruch die Zeilen nicht.
 *
 * **`\r\n` als Zeilenende:** RFC 4180, und Excel unter Windows zeigt eine
 * Datei mit blossem `\n` sonst als eine einzige Zeile.
 */

/** Ein Feld: gequotet, enthaltene Anführungszeichen verdoppelt. */
export function csvCell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** Eine Zeile aus Feldern. */
export function csvRow(values: readonly (string | number | null | undefined)[]): string {
  return values.map(csvCell).join(';');
}

/** Kopfzeile und Zeilen zu einer Datei. */
export function toCsv(
  header: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  return [csvRow(header), ...rows.map(csvRow)].join('\r\n');
}

/**
 * Das Byte-Order-Mark vor der Datei.
 *
 * Ohne liest Excel eine UTF-8-CSV als Latin-1 und macht aus «Müller»
 * «MÃ¼ller». Gehört nur an die **Datei** – im Teilen-Blatt steht der Text
 * selbst, und dort wäre das BOM ein unsichtbares Zeichen am Anfang.
 */
export const CSV_BOM = '\uFEFF';

/**
 * Eine CSV herausgeben – nativ ins Teilen-Blatt, im Browser als Datei.
 *
 * Stand bis UC-043 zweimal im Code (`ContributionPage`, dann der
 * Mitglieder-Export). Der Ablauf ist in beiden Fällen derselbe, und ein
 * Abbruch im Teilen-Blatt sieht von aussen aus wie ein Fehlschlag – deshalb
 * bleibt die Zwischenablage als zweiter Weg: Ein Tippen darf nie nichts tun.
 *
 * Gibt zurück, was geschehen ist, damit die Ansicht die passende Rückmeldung
 * zeigen kann (guidelines §5: kein stiller Erfolg).
 */
export type CsvDelivery = 'shared' | 'copied' | 'downloaded' | 'failed';

export async function deliverCsv(options: {
  csv: string;
  fileName: string;
  title: string;
  canShareNatively: boolean;
  share: (input: { title: string; text: string }) => Promise<unknown>;
}): Promise<CsvDelivery> {
  const { csv, fileName, title, share } = options;

  if (options.canShareNatively) {
    try {
      await share({ title, text: csv });
      return 'shared';
    } catch {
      try {
        await navigator.clipboard?.writeText(csv);
        return 'copied';
      } catch {
        return 'failed';
      }
    }
  }

  const blob = new Blob([`${CSV_BOM}${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
