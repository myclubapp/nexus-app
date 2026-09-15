import { describe, expect, it } from 'vitest';
import {
  buildClubSettings,
  isModuleOn,
  resolveLabel,
  seasonStartChanged,
} from './clubSettings';
import type { ClubSettings } from './database.types';

/** Die volle Eingabe des Formulars – jeder Test überschreibt nur, was er prüft. */
function input(overrides: Partial<Parameters<typeof buildClubSettings>[1]> = {}) {
  return {
    labels: {},
    theme: {},
    modules: {},
    dna: {},
    logoUrl: '',
    ...overrides,
  };
}

describe('buildClubSettings', () => {
  it('übernimmt gefüllte Begriffe und Farben', () => {
    const settings = buildClubSettings(
      {},
      input({
        labels: { training: { de: 'Probe' } },
        theme: { primary: '#112233' },
      }),
    );

    expect(settings.labels).toEqual({ training: { de: 'Probe' } });
    expect(settings.theme).toEqual({ primary: '#112233' });
  });

  it('legt leere Eingaben nicht ab', () => {
    const settings = buildClubSettings(
      { labels: { training: { de: 'Probe' } }, theme: { primary: '#112233' } },
      input({ labels: { training: { de: '   ' } }, theme: { primary: '' } }),
    );

    expect(settings.labels).toBeUndefined();
    expect(settings.theme).toBeUndefined();
  });

  it('behält die Sprachen, in denen etwas steht', () => {
    // Eine leere Sprache ist keine Angabe; eine Terminart ohne einzige Sprache
    // verschwindet ganz.
    const settings = buildClubSettings(
      {},
      input({
        labels: {
          training: { de: 'Probe', fr: '', it: 'Prova', en: '   ' },
          match: { de: '' },
        },
      }),
    );

    expect(settings.labels).toEqual({ training: { de: 'Probe', it: 'Prova' } });
  });

  it('legt nur eingeschaltete Module ab (BR-150)', () => {
    // Ein `false` wäre dasselbe wie ein fehlender Eintrag und machte die
    // Einstellung nur länger.
    const settings = buildClubSettings(
      {},
      input({ modules: { voice: true, meeting: false, checkin: true } }),
    );

    expect(settings.modules).toEqual({ voice: true, checkin: true });
  });

  it('entfernt die Module, wenn alle aus sind', () => {
    const settings = buildClubSettings(
      { modules: { voice: true } },
      input({ modules: { voice: false } }),
    );

    expect(settings.modules).toBeUndefined();
  });

  it('nimmt die Vereins-DNA und das Logo auf', () => {
    const settings = buildClubSettings(
      {},
      input({
        dna: { why: 'Damit alle mitmachen können.', values: '  ' },
        logoUrl: '  https://verein.example/logo.svg  ',
      }),
    );

    expect(settings.dna).toEqual({ why: 'Damit alle mitmachen können.' });
    expect(settings.logoUrl).toBe('https://verein.example/logo.svg');
  });

  it('fasst nur an, was die Seite mitschickt', () => {
    // Seit die Begriffe auf einer eigenen Seite stehen, speichert jede Seite
    // nur ihren Ausschnitt. Ein fehlendes Feld heisst «nicht angefasst» – ein
    // leerer Entwurf der Begriffsseite dürfte sonst Farben, Module, DNA und
    // Logo des Vereins löschen.
    const before: ClubSettings = {
      labels: { training: { de: 'Probe' } },
      theme: { primary: '#112233' },
      modules: { voice: true },
      dna: { why: 'Damit alle mitmachen können.' },
      logoUrl: 'https://verein.example/logo.svg',
    };

    const settings = buildClubSettings(before, {
      labels: { training: { de: 'Übung' } },
    });

    expect(settings.labels).toEqual({ training: { de: 'Übung' } });
    expect(settings.theme).toEqual({ primary: '#112233' });
    expect(settings.modules).toEqual({ voice: true });
    expect(settings.dna).toEqual({ why: 'Damit alle mitmachen können.' });
    expect(settings.logoUrl).toBe('https://verein.example/logo.svg');
  });

  it('lässt fremde Einstellungen unangetastet', () => {
    // In `settings` stehen auch Werte, die diese Seite nicht kennt.
    const settings = buildClubSettings({ newsSource: 'wordpress' } as never, input());

    expect(settings).toEqual({ newsSource: 'wordpress' });
  });
});

describe('resolveLabel', () => {
  const labels: ClubSettings['labels'] = {
    training: { de: 'Probe', fr: 'Répétition' },
    match: { de: 'Auftritt' },
  };

  it('nimmt den Begriff der gewählten Sprache (BR-148)', () => {
    expect(resolveLabel(labels, 'training', 'fr')).toBe('Répétition');
    expect(resolveLabel(labels, 'training', 'de')).toBe('Probe');
  });

  it('fällt auf eine hinterlegte Sprache zurück, nicht auf die Übersetzung', () => {
    // Wer «Auftritt» nur auf Deutsch eingetragen hat, meint ihn auch auf
    // Italienisch – sonst stünde dort plötzlich «Spiel».
    expect(resolveLabel(labels, 'match', 'it')).toBe('Auftritt');
  });

  it('gibt nichts zurück, wo der Verein nichts gesagt hat', () => {
    // Dann greift `t('agenda.type.…')` beim Aufrufer.
    expect(resolveLabel(labels, 'helper', 'de')).toBeNull();
    expect(resolveLabel(undefined, 'training', 'de')).toBeNull();
    expect(resolveLabel({ training: {} }, 'training', 'de')).toBeNull();
  });

  it('überliest eine Sprache, in der nur Leerzeichen stehen', () => {
    expect(resolveLabel({ training: { de: '  ', fr: 'Répétition' } }, 'training', 'de'))
      .toBe('Répétition');
  });
});

describe('isModuleOn', () => {
  it('ist aus, solange es nicht ausdrücklich an ist (K7, BR-150)', () => {
    // Der Unterschied zu jeder anderen Einstellung dieser App: Ein fehlender
    // Eintrag heisst **aus**, nicht «Standardwert».
    expect(isModuleOn(null, 'voice')).toBe(false);
    expect(isModuleOn({}, 'voice')).toBe(false);
    expect(isModuleOn({ modules: {} }, 'voice')).toBe(false);
    expect(isModuleOn({ modules: { meeting: true } }, 'voice')).toBe(false);
  });

  it('ist an, wenn es ausdrücklich an ist', () => {
    expect(isModuleOn({ modules: { voice: true } }, 'voice')).toBe(true);
  });

  it('nimmt nur ein echtes `true`', () => {
    expect(isModuleOn({ modules: { voice: false } }, 'voice')).toBe(false);
  });
});

describe('seasonStartChanged', () => {
  it('erkennt die Änderung (A4)', () => {
    expect(seasonStartChanged('2026-08-01', '2026-09-01')).toBe(true);
    expect(seasonStartChanged(null, '2026-09-01')).toBe(true);
    expect(seasonStartChanged('2026-08-01', '')).toBe(true);
  });

  it('fragt nicht, wo nichts anders ist', () => {
    // Wer denselben Tag erneut eingibt, ändert nichts.
    expect(seasonStartChanged('2026-08-01', '2026-08-01')).toBe(false);
    expect(seasonStartChanged(null, '')).toBe(false);
    expect(seasonStartChanged(undefined, '')).toBe(false);
  });
});

describe('buildClubSettings – Rangliste (Konzept §7.2)', () => {
  it('legt Ausschnitt und Ränge-ohne-Zahl ab und lässt Leeres weg', () => {
    const settings = buildClubSettings({}, input({ leaderboard: { topOnly: '10', hidePoints: true } }));
    expect(settings.leaderboard).toEqual({ topOnly: 10, hidePoints: true });

    const none = buildClubSettings(
      { leaderboard: { topOnly: 10 } },
      input({ leaderboard: { topOnly: '', hidePoints: false } }),
    );
    expect(none.leaderboard).toBeUndefined();
  });

  it('nimmt einen Ausschnitt unter 1 nicht an – dann gilt die Vorgabe', () => {
    const settings = buildClubSettings({}, input({ leaderboard: { topOnly: '0', hidePoints: false } }));
    expect(settings.leaderboard).toBeUndefined();
  });
});

describe('buildClubSettings – offene Anfragen (FR-196, BR-258)', () => {
  it('legt nur ein `true` ab – wie ein Modul', () => {
    const open = buildClubSettings({}, input({ join: { public: true } }));
    expect(open.join).toEqual({ public: true });
  });

  it('lässt den Eintrag verschwinden, wenn der Weg zu ist', () => {
    // Ein `false`, das dastünde, sagte dasselbe wie sein Fehlen und machte die
    // Einstellung nur länger.
    const closed = buildClubSettings(
      { join: { public: true } },
      input({ join: { public: false } }),
    );
    expect(closed.join).toBeUndefined();
  });

  it('fasst die Einstellung nicht an, wenn eine andere Seite speichert', () => {
    // Die Vereinseinstellungen und der Einrichtungs-Assistent schicken je nur
    // ihren eigenen Ausschnitt; was fehlt, bleibt stehen.
    const kept = buildClubSettings({ join: { public: true } }, input({}));
    expect(kept.join).toEqual({ public: true });
  });
});
