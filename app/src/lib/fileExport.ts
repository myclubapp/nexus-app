/**
 * Eine Datei aus der App heraus (UC-042, UC-043, UC-041 A7).
 *
 * Der Weg ist für jede Ausgabe derselbe – CSV der Mitgliederliste, Markdown
 * einer Ämterbeschreibung –, und deshalb steht er einmal hier statt einmal je
 * Format: nativ ins Teilen-Blatt, im Browser als Download, und die
 * Zwischenablage als zweiter Weg, wenn das Teilen-Blatt abbricht. Ein Tippen
 * darf nie nichts tun.
 *
 * Die Dateinamen entstehen ebenfalls hier, weil sie dieselbe Falle teilen:
 * Ein Amt heisst «Halle / BBC», ein Team «Herren 1 / A» – was nicht Buchstabe,
 * Ziffer oder Bindestrich ist, darf keinen Pfad aufmachen.
 */

/** Was mit der Datei geschehen ist – die Ansicht sagt es weiter (guidelines §5). */
export type FileDelivery = 'shared' | 'copied' | 'downloaded' | 'failed';

export async function deliverFile(options: {
  /** Der Inhalt, wie ihn auch das Teilen-Blatt zeigt. */
  text: string;
  fileName: string;
  title: string;
  mimeType: string;
  /**
   * Ein Vorspann **nur für die Datei** – das Byte-Order-Mark der CSV. Im
   * Teilen-Blatt steht der Text selbst, dort wäre es ein unsichtbares
   * Zeichen am Anfang.
   */
  filePrefix?: string;
  canShareNatively: boolean;
  share: (input: { title: string; text: string }) => Promise<unknown>;
}): Promise<FileDelivery> {
  const { text, fileName, title, mimeType, filePrefix = '', share } = options;

  if (options.canShareNatively) {
    try {
      await share({ title, text });
      return 'shared';
    } catch {
      // Das Teilen-Blatt ist abgebrochen worden – oder es gibt keines. Die
      // Zwischenablage fehlt ihrerseits in unsicheren Kontexten **ganz**:
      // `navigator.clipboard?.writeText()` ergäbe dann `undefined`, das
      // `await` liefe durch, und der Toast behauptete «kopiert», ohne dass
      // etwas kopiert wurde.
      const clipboard = navigator.clipboard;
      if (!clipboard) return 'failed';
      try {
        await clipboard.writeText(text);
        return 'copied';
      } catch {
        return 'failed';
      }
    }
  }

  const blob = new Blob([`${filePrefix}${text}`], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}

/**
 * Ein Wort für den Dateinamen: klein, ohne Akzente, mit Bindestrichen.
 *
 * Umlaute werden aufgelöst («Ämter» → «aemter» wäre falsch, es wird «amter»),
 * nicht zu Unterstrichen wie in der alten App.
 */
export function slugify(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    // Kombinierende Zeichen: aus «ü» wird «u», nicht «_».
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Das Datum im Dateinamen – ISO, damit eine Ablage von selbst sortiert. */
export function fileDateStamp(today: Date = new Date()): string {
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}
