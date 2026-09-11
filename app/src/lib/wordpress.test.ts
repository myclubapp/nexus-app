import { describe, expect, it } from 'vitest';
import {
  categoryOptions,
  clampPostLimit,
  DEFAULT_POST_LIMIT,
  isSiteUrl,
  MAX_POST_LIMIT,
  normaliseSiteUrl,
  parseCategories,
  POST_LIMIT_OPTIONS,
  postsEndpoint,
  siteLabel,
} from './wordpress';

describe('normaliseSiteUrl', () => {
  it('ergänzt das fehlende Schema', () => {
    expect(normaliseSiteUrl('verein.ch')).toBe('https://verein.ch');
  });

  it('hebt http auf https an', () => {
    expect(normaliseSiteUrl('http://verein.ch')).toBe('https://verein.ch');
  });

  it('entfernt den Schrägstrich am Ende', () => {
    expect(normaliseSiteUrl('https://verein.ch/')).toBe('https://verein.ch');
  });

  it('behält einen Unterpfad, unter dem WordPress läuft', () => {
    expect(normaliseSiteUrl('https://verein.ch/site/')).toBe('https://verein.ch/site');
  });

  it('schneidet eine mitkopierte Schnittstellen-Adresse ab', () => {
    // Wer die Adresse aus dem Browser kopiert, bringt oft schon den REST-Pfad
    // mit; die Function hängt ihn selbst an.
    expect(normaliseSiteUrl('https://verein.ch/wp-json/wp/v2/posts?per_page=20')).toBe(
      'https://verein.ch',
    );
    expect(normaliseSiteUrl('https://verein.ch/feed')).toBe('https://verein.ch');
    expect(normaliseSiteUrl('https://verein.ch/wp-admin/')).toBe('https://verein.ch');
  });

  it('verwirft Abfrageparameter und Anker', () => {
    expect(normaliseSiteUrl('https://verein.ch/news?page=2#top')).toBe(
      'https://verein.ch/news',
    );
  });

  it('schreibt den Hostnamen klein und behält einen Port', () => {
    expect(normaliseSiteUrl('HTTPS://Verein.CH')).toBe('https://verein.ch');
    expect(normaliseSiteUrl('https://verein.ch:8443')).toBe('https://verein.ch:8443');
  });

  it('verwirft, was keine Website-Adresse ist', () => {
    expect(normaliseSiteUrl('')).toBeNull();
    expect(normaliseSiteUrl('   ')).toBeNull();
    expect(normaliseSiteUrl('kein Verein')).toBeNull();
    expect(normaliseSiteUrl('ftp://verein.ch')).toBeNull();
    expect(normaliseSiteUrl('localhost')).toBeNull();
  });

  it('erzeugt aus derselben Eingabe in jeder Schreibweise dieselbe Adresse', () => {
    // Sonst legt derselbe Verein zwei Quellen für eine Website an.
    const variants = [
      'verein.ch',
      'www.verein.ch/',
      'http://www.verein.ch',
      'https://WWW.verein.ch/wp-json',
    ].map(normaliseSiteUrl);

    expect(new Set(variants.slice(1))).toEqual(new Set(['https://www.verein.ch']));
    expect(variants[0]).toBe('https://verein.ch');
  });
});

describe('isSiteUrl', () => {
  it('trennt brauchbare von unbrauchbaren Eingaben', () => {
    expect(isSiteUrl('verein.ch')).toBe(true);
    expect(isSiteUrl('kein Verein')).toBe(false);
  });
});

describe('siteLabel', () => {
  it('zeigt den Hostnamen ohne Schema und ohne www', () => {
    expect(siteLabel('https://www.verein.ch')).toBe('verein.ch');
    expect(siteLabel('https://verein.ch/site')).toBe('verein.ch/site');
  });
});

describe('clampPostLimit', () => {
  it('nimmt, was innerhalb der Grenzen liegt', () => {
    expect(clampPostLimit(1)).toBe(1);
    expect(clampPostLimit(50)).toBe(50);
    expect(clampPostLimit(MAX_POST_LIMIT)).toBe(MAX_POST_LIMIT);
  });

  it('kappt bei hundert – mehr liefert die Schnittstelle nicht (BR-174)', () => {
    // Nicht gegriffen: `per_page=101` beantwortet WordPress mit 400.
    expect(clampPostLimit(101)).toBe(MAX_POST_LIMIT);
    expect(clampPostLimit(5000)).toBe(MAX_POST_LIMIT);
  });

  it('fällt auf die Vorgabe zurück, wo keine Zahl steht', () => {
    // Eine Quelle aus der Zeit vor 0048 bringt nichts mit; die Ansicht soll
    // dann zwanzig anbieten und nicht null Beiträge holen.
    expect(clampPostLimit(null)).toBe(DEFAULT_POST_LIMIT);
    expect(clampPostLimit(undefined)).toBe(DEFAULT_POST_LIMIT);
    expect(clampPostLimit('viele')).toBe(DEFAULT_POST_LIMIT);
    expect(clampPostLimit(0)).toBe(DEFAULT_POST_LIMIT);
    expect(clampPostLimit(-20)).toBe(DEFAULT_POST_LIMIT);
  });

  it('rundet ab, statt eine Kommazahl weiterzureichen', () => {
    expect(clampPostLimit(19.7)).toBe(19);
  });

  it('bietet nur Stufen an, die die Datenbank auch annimmt', () => {
    for (const option of POST_LIMIT_OPTIONS) {
      expect(option).toBeGreaterThanOrEqual(1);
      expect(option).toBeLessThanOrEqual(MAX_POST_LIMIT);
      expect(clampPostLimit(option)).toBe(option);
    }
  });
});

describe('postsEndpoint', () => {
  it('baut beide Wege so, wie die Edge Function sie abfragt', () => {
    // Läuft das auseinander, zeigt die Ansicht eine andere Adresse an als die,
    // die tatsächlich geholt wird.
    expect(postsEndpoint('https://verein.ch', 'pretty')).toBe(
      'https://verein.ch/wp-json/wp/v2/posts',
    );
    expect(postsEndpoint('https://verein.ch', 'query')).toBe(
      'https://verein.ch/?rest_route=/wp/v2/posts',
    );
  });
});

describe('parseCategories', () => {
  it('liest die gespeicherte Auswahl', () => {
    expect(
      parseCategories([
        { id: 4, name: 'Herren 1' },
        { id: 6, name: 'Damen' },
      ]),
    ).toEqual([
      { id: 4, name: 'Herren 1' },
      { id: 6, name: 'Damen' },
    ]);
  });

  it('liest die Vorgabe «alle Kategorien» als leere Auswahl (BR-174)', () => {
    expect(parseCategories([])).toEqual([]);
    expect(parseCategories(null)).toEqual([]);
    expect(parseCategories('alle')).toEqual([]);
  });

  it('wirft weg, was keine Kategorie ist', () => {
    expect(
      parseCategories([{ id: 0 }, { id: -3, name: 'x' }, { name: 'ohne Id' }, 7, null]),
    ).toEqual([]);
  });

  it('behält eine Id ohne Namen bedienbar', () => {
    // Ohne Ersatznamen stünde im Auswahlfeld ein leerer Eintrag.
    expect(parseCategories([{ id: 9 }, { id: 10, name: '  ' }])).toEqual([
      { id: 9, name: '#9' },
      { id: 10, name: '#10' },
    ]);
  });

  it('führt dieselbe Kategorie nur einmal', () => {
    expect(parseCategories([{ id: 4, name: 'Herren 1' }, { id: 4, name: 'Herren 1' }]))
      .toEqual([{ id: 4, name: 'Herren 1' }]);
  });
});

describe('categoryOptions', () => {
  const found = [
    { id: 10, name: 'App', count: 122 },
    { id: 4, name: 'Herren 1', count: 93 },
  ];

  it('zeigt, was die Prüfung gefunden hat', () => {
    expect(categoryOptions(found, [])).toEqual(found);
  });

  it('hält eine gewählte Kategorie in der Liste, die die Website nicht mehr nennt', () => {
    // `hide_empty` blendet leergelaufene Kategorien aus. Ohne diese Ergänzung
    // stünde die Auswahl auf einer Id ohne Eintrag – im Feld sähe das aus wie
    // «nichts gewählt», und der nächste Abgleich holte plötzlich alles.
    const options = categoryOptions(found, [{ id: 6, name: 'Damen' }]);
    expect(options.map((option) => option.id)).toEqual([10, 4, 6]);
    expect(options.at(-1)).toEqual({ id: 6, name: 'Damen', count: 0 });
  });

  it('führt eine gewählte Kategorie nicht doppelt', () => {
    expect(categoryOptions(found, [{ id: 4, name: 'Herren 1' }])).toHaveLength(2);
  });

  it('kommt ohne Prüfung mit der gespeicherten Auswahl aus', () => {
    // Beim Öffnen der Ansicht ist noch nichts geprüft; was gespeichert ist,
    // muss trotzdem lesbar im Feld stehen.
    expect(categoryOptions([], [{ id: 4, name: 'Herren 1' }])).toEqual([
      { id: 4, name: 'Herren 1', count: 0 },
    ]);
  });
});
