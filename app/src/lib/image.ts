/**
 * Bilder für den Vereinsspeicher (UC-045).
 *
 * Was vom Gerät kommt, ist zu gross: Ein Foto einer heutigen Handykamera wiegt
 * drei bis zwölf Megabyte und misst viertausend Pixel. Als Avatar in einer
 * Listenzeile werden daraus vierzig Pixel. Wer das ungerechnet hochlädt,
 * bezahlt es dreimal – beim Hochladen, im Speicher und bei jedem Laden der
 * Liste, auf einem Vereinsausflug womöglich über Edge.
 *
 * Deshalb verkleinert die App **vor** dem Hochladen. Die Rechnung dazu steht
 * hier als reine Funktion; das Zeichnen auf ein `canvas` ist der einzige
 * Teil, der einen Browser braucht.
 */

/** Wofür ein Bild steht – bestimmt Pfad und Kantenlänge. */
export type MediaKind = 'logo' | 'teams' | 'members';

/**
 * Die längste Kante nach dem Verkleinern.
 *
 * Ein Logo steht im Menü und auf der Einladung, ein Teambild füllt die Breite
 * eines Blattes, ein Profilbild ist ein Kreis von vierzig bis achtzig Pixeln.
 * 512 reicht dafür auf jedem Retina-Bildschirm – und ein Verein mit
 * zweihundert Mitgliedern bleibt damit unter zwanzig Megabyte.
 */
export const MEDIA_MAX_EDGE: Record<MediaKind, number> = {
  logo: 512,
  teams: 1024,
  members: 512,
};

/** Was der Bucket annimmt (`0083`). SVG fehlt mit Absicht: Es kann Skript tragen. */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Die Grenze des Buckets – 5 MiB je Datei (`0083`). */
export const MEDIA_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Die neuen Kantenlängen: seitenverhältnistreu, höchstens `max` an der langen
 * Kante – und **nie vergrössert**. Ein Logo mit 64 Pixeln bleibt bei 64; es
 * auf 512 zu blasen macht es nur unscharf und die Datei grösser.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const factor = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

/**
 * Der Pfad im Bucket – dieselbe Form, die `can_write_club_media()` in `0083`
 * prüft. Läuft die Form hier und dort auseinander, lehnt die Policy den
 * Upload ab, ohne zu sagen warum.
 *
 * Der Zufallsname am Ende ist Absicht: Ein fester Name («logo.jpg») bliebe im
 * Zwischenspeicher jedes Browsers stehen, und das neue Bild erschiene erst
 * nach Tagen.
 */
export function mediaPath(
  kind: MediaKind,
  clubId: string,
  ownerId: string | null,
  fileName: string,
): string {
  const ext = extensionFor(fileName);
  const unique = randomName();
  return kind === 'logo'
    ? `${clubId}/logo/${unique}.${ext}`
    : `${clubId}/${kind}/${ownerId}/${unique}.${ext}`;
}

/**
 * Die Endung zum Dateinamen – kleingeschrieben und auf das eingegrenzt, was
 * der Bucket annimmt. Alles andere wird `jpg`, weil die Verkleinerung ohnehin
 * ein JPEG erzeugt.
 */
export function extensionFor(fileName: string): string {
  const raw = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (raw === 'png') return 'png';
  if (raw === 'webp') return 'webp';
  return 'jpg';
}

/**
 * Zeigt diese Adresse auf **diese** Art Bild im Speicher **dieses** Vereins?
 *
 * Gebraucht wird das an genau einer Stelle: bevor eine ersetzte Datei gelöscht
 * wird. Deshalb so eng wie möglich – ein Logo darf nur ein Logo wegräumen.
 * Wäre die Frage bloss «irgendwo im Verein?», löschte das Ersetzen des Logos
 * ein Teambild, dessen Adresse jemand von Hand ins Adressfeld getippt hat.
 *
 * Der Riegel gegen fremde Adressen bleibt der Server (`set_member_avatar()`,
 * `set_team_photo()`, BR-216); diese Funktion entscheidet nur über das
 * Aufräumen.
 */
export function isClubMediaUrl(url: string, clubId: string, kind: MediaKind): boolean {
  // Nur das Logo hat überhaupt eine gespeicherte Adresse (sein Bucket ist
  // öffentlich); Team- und Profilbild führen einen Pfad und werden bei jedem
  // Anzeigen frisch signiert.
  return url.includes(`/club-logo/${clubId}/${kind}/`);
}

/** Der Dateiname im Bucket: Zufall, damit kein Zwischenspeicher hängen bleibt. */
function randomName(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Womit das verkleinerte Bild herauskommt.
 *
 * JPEG, nicht das Ursprungsformat: Ein Foto als PNG ist um ein Vielfaches
 * grösser, und Durchsichtigkeit braucht keines dieser drei Bilder. Ein Logo
 * mit durchsichtigem Hintergrund ist die Ausnahme – dort bleibt PNG.
 *
 * Eigene Funktion, weil Endung und Inhaltstyp **zusammenpassen müssen**: Ein
 * HEIC vom iPhone bekam über `extensionFor()` den Namen `.jpg`, während der
 * Inhaltstyp `image/heic` blieb – zwei Angaben, die auseinanderliefen.
 */
export function targetType(sourceType: string): { type: string; ext: string } {
  return sourceType === 'image/png'
    ? { type: 'image/png', ext: 'png' }
    : { type: 'image/jpeg', ext: 'jpg' };
}

/** Nimmt der Vereinsspeicher diesen Inhaltstyp an (`0083`)? */
export function isSupportedImage(type: string): boolean {
  return (MEDIA_MIME_TYPES as readonly string[]).includes(type);
}

/**
 * Ein Bild verkleinern und als JPEG zurückgeben.
 *
 * JPEG, nicht das Ursprungsformat: Ein Foto als PNG ist um ein Vielfaches
 * grösser, und Durchsichtigkeit braucht keines dieser drei Bilder. Ein Logo
 * mit durchsichtigem Hintergrund ist die Ausnahme – dort bleibt PNG.
 *
 * Schlägt das Verkleinern fehl (ein Format, das der Browser nicht zeichnen
 * kann), kommt die Ursprungsdatei zurück. Die Grenze des Buckets fängt sie
 * dann ab, mit einer Meldung statt mit einem stillen Fehlschlag.
 */
export async function shrinkImage(file: File, kind: MediaKind): Promise<File> {
  const max = MEDIA_MAX_EDGE[kind];
  const { type, ext } = targetType(file.type);

  try {
    // `imageOrientation: 'from-image'` richtet das Bild nach seinem
    // EXIF-Eintrag auf. Ohne die Angabe hängt es am Standardwert der Engine,
    // und ein Hochformatfoto vom Telefon liegt im Avatar quer.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, 0.85),
    );
    if (!blob) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '')}.${ext}`;
    return new File([blob], name, { type });
  } catch {
    // Ein Format, das der Browser nicht zeichnen kann (HEIC in den meisten
    // Engines). Die Ursprungsdatei kommt zurück; **ob** der Speicher sie
    // annimmt, entscheidet `isSupportedImage()` beim Aufrufer – nicht eine
    // englische Meldung aus der Storage-API.
    return file;
  }
}
