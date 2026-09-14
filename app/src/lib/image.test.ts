import { describe, expect, it } from 'vitest';
import {
  MEDIA_MAX_EDGE,
  extensionFor,
  fitWithin,
  isClubMediaUrl,
  isSupportedImage,
  mediaPath,
  targetType,
} from './image';

describe('fitWithin', () => {
  it('verkleinert seitenverhältnistreu auf die lange Kante', () => {
    expect(fitWithin(4000, 3000, 512)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3000, 4000, 512)).toEqual({ width: 384, height: 512 });
  });

  it('vergrössert nie – ein kleines Logo bleibt klein', () => {
    expect(fitWithin(64, 64, 512)).toEqual({ width: 64, height: 64 });
  });

  it('lässt auch ein sehr schmales Bild mindestens einen Pixel breit', () => {
    expect(fitWithin(10000, 3, 512).height).toBeGreaterThanOrEqual(1);
  });

  it('antwortet auf ein Bild ohne Ausdehnung mit null, statt durch null zu teilen', () => {
    expect(fitWithin(0, 0, 512)).toEqual({ width: 0, height: 0 });
  });
});

describe('mediaPath', () => {
  const club = '11111111-1111-1111-1111-111111111111';
  const owner = '22222222-2222-2222-2222-222222222222';

  it('legt das Logo in den Vereinsordner ohne dritte Ebene', () => {
    // Dieselbe Form prüft `can_write_club_media()` in 0083: Segment 2 ist die
    // Art, Segment 3 gibt es beim Logo nicht.
    const path = mediaPath('logo', club, null, 'wappen.png');
    expect(path).toMatch(new RegExp(`^${club}/logo/[^/]+\\.png$`));
  });

  it('legt Team- und Profilbild unter ihre eigene Kennung', () => {
    expect(mediaPath('teams', club, owner, 'foto.jpg')).toMatch(
      new RegExp(`^${club}/teams/${owner}/[^/]+\\.jpg$`),
    );
    expect(mediaPath('members', club, owner, 'foto.jpg')).toMatch(
      new RegExp(`^${club}/members/${owner}/[^/]+\\.jpg$`),
    );
  });

  it('vergibt für jede Datei einen neuen Namen – sonst bliebe der Zwischenspeicher stehen', () => {
    expect(mediaPath('logo', club, null, 'a.png')).not.toBe(
      mediaPath('logo', club, null, 'a.png'),
    );
  });
});

describe('extensionFor', () => {
  it('behält die drei Formate, die der Bucket annimmt', () => {
    expect(extensionFor('bild.png')).toBe('png');
    expect(extensionFor('bild.webp')).toBe('webp');
    expect(extensionFor('bild.JPEG')).toBe('jpg');
  });

  it('macht aus allem anderen jpg – die Verkleinerung erzeugt ohnehin ein JPEG', () => {
    expect(extensionFor('bild.heic')).toBe('jpg');
    expect(extensionFor('ohnepunkt')).toBe('jpg');
    expect(extensionFor('bild.svg')).toBe('jpg');
  });
});

describe('isClubMediaUrl', () => {
  const club = '11111111-1111-1111-1111-111111111111';

  const base = 'https://x.supabase.co/storage/v1/object/public/club-logo';

  it('erkennt ein Logo im eigenen Vereinsordner', () => {
    expect(isClubMediaUrl(`${base}/${club}/logo/a.png`, club, 'logo')).toBe(true);
  });

  it('weist den Ordner eines anderen Vereins ab', () => {
    const other = '33333333-3333-3333-3333-333333333333';
    expect(isClubMediaUrl(`${base}/${other}/logo/a.png`, club, 'logo')).toBe(false);
  });

  it('unterscheidet die Art des Bildes', () => {
    // Sonst löschte das Ersetzen des Logos ein anderes Bild, dessen Adresse
    // jemand von Hand ins Adressfeld getippt hat.
    expect(isClubMediaUrl(`${base}/${club}/teams/t1/a.png`, club, 'logo')).toBe(false);
    expect(isClubMediaUrl(`${base}/${club}/teams/t1/a.png`, club, 'teams')).toBe(true);
  });

  it('erkennt den privaten Bucket nicht als Logo-Adresse', () => {
    // Team- und Profilbilder liegen in `club-photos` und haben gar keine
    // gespeicherte Adresse – eine, die trotzdem auftaucht, ist keine, die
    // das Logo wegräumen dürfte.
    const privat = 'https://x.supabase.co/storage/v1/object/sign/club-photos';
    expect(isClubMediaUrl(`${privat}/${club}/logo/a.png`, club, 'logo')).toBe(false);
  });

  it('weist eine fremde Adresse ab', () => {
    expect(isClubMediaUrl('https://verein.example/logo.svg', club, 'logo')).toBe(false);
  });
});

describe('MEDIA_MAX_EDGE', () => {
  it('gibt dem Teambild mehr Kante als dem Avatar', () => {
    expect(MEDIA_MAX_EDGE.teams).toBeGreaterThan(MEDIA_MAX_EDGE.members);
  });
});

describe('targetType', () => {
  it('behält PNG, damit ein Logo durchsichtig bleiben kann', () => {
    expect(targetType('image/png')).toEqual({ type: 'image/png', ext: 'png' });
  });

  it('macht aus allem anderen JPEG – und die Endung passt zum Inhaltstyp', () => {
    // Der Fehler, den das verhindert: Ein HEIC bekam den Namen `.jpg` und
    // behielt `image/heic` als Typ.
    for (const source of ['image/jpeg', 'image/webp', 'image/heic', '']) {
      const { type, ext } = targetType(source);
      expect(type).toBe('image/jpeg');
      expect(ext).toBe('jpg');
    }
  });
});

describe('isSupportedImage', () => {
  it('nimmt an, was der Bucket annimmt', () => {
    expect(isSupportedImage('image/jpeg')).toBe(true);
    expect(isSupportedImage('image/png')).toBe(true);
    expect(isSupportedImage('image/webp')).toBe(true);
  });

  it('weist ab, was der Browser nicht verkleinern konnte', () => {
    expect(isSupportedImage('image/heic')).toBe(false);
    expect(isSupportedImage('image/svg+xml')).toBe(false);
    expect(isSupportedImage('')).toBe(false);
  });
});
