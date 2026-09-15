import { describe, expect, it } from 'vitest';
import {
  isNameStepComplete,
  isPlaceholderName,
  isProfileStarted,
  isSetupAvailable,
  PROFILE_SETUP_ROUTE,
  PROFILE_SETUP_STEPS,
  shouldOfferSetupCard,
  shouldStartSetup,
} from './profileSetup';

const PLACEHOLDER = {
  avatarUrl: null,
  displayName: 'sandro',
  accountEmail: 'sandro@scalco.ch',
  profileSetupAt: null,
};

describe('PROFILE_SETUP_ROUTE (UC-053)', () => {
  it('liegt nicht auf dem Weg des Vereins-Assistenten', () => {
    // `/tabs/profile/setup` gehört UC-051. Zwei Assistenten auf derselben
    // Adresse wären ein stiller Fehler: Der eine überdeckte den anderen.
    expect(PROFILE_SETUP_ROUTE).not.toBe('/tabs/profile/setup');
  });

  it('führt vier Fragen', () => {
    expect(PROFILE_SETUP_STEPS).toEqual(['photo', 'name', 'contact', 'notifications']);
  });
});

describe('isPlaceholderName', () => {
  it('erkennt den Namen, den der Beitritt gesetzt hat', () => {
    // `request_join()` setzt ihn auf den Teil vor dem @ (0010).
    expect(isPlaceholderName('sandro', 'sandro@scalco.ch')).toBe(true);
  });

  it('achtet nicht auf Gross- und Kleinschreibung', () => {
    expect(isPlaceholderName('Sandro', 'sandro@scalco.ch')).toBe(true);
  });

  it('lässt einen selbst gewählten Namen in Ruhe', () => {
    expect(isPlaceholderName('Sandro Scalco', 'sandro@scalco.ch')).toBe(false);
  });

  it('nennt einen leeren Namen einen Platzhalter', () => {
    expect(isPlaceholderName('', 'sandro@scalco.ch')).toBe(true);
    expect(isPlaceholderName('   ', 'sandro@scalco.ch')).toBe(true);
    expect(isPlaceholderName(null, null)).toBe(true);
  });

  it('beanstandet ohne Adresse nichts', () => {
    // Ein Konto ohne E-Mail-Adresse gibt es (Anmeldung über Einladung); dann
    // ist jeder Name ein gewählter.
    expect(isPlaceholderName('sandro', null)).toBe(false);
  });
});

describe('isProfileStarted', () => {
  it('lässt ein Bild genügen', () => {
    // Die Schwelle ist mit Absicht niedrig: Sie entscheidet nur, wie lange
    // die Karte auf dem Dashboard steht.
    expect(
      isProfileStarted({
        avatarUrl: 'members/abc.jpg',
        displayName: 'sandro',
        accountEmail: 'sandro@scalco.ch',
      }),
    ).toBe(true);
  });

  it('lässt einen gewählten Namen genügen', () => {
    expect(
      isProfileStarted({
        avatarUrl: null,
        displayName: 'Sandro Scalco',
        accountEmail: 'sandro@scalco.ch',
      }),
    ).toBe(true);
  });

  it('nennt ein unberührtes Profil unberührt', () => {
    expect(
      isProfileStarted({
        avatarUrl: null,
        displayName: 'sandro',
        accountEmail: 'sandro@scalco.ch',
      }),
    ).toBe(false);
  });
});

describe('isSetupAvailable (das Fenster zwischen Merge und db push)', () => {
  it('erkennt die eingespielte Spalte an `null`', () => {
    expect(isSetupAvailable({ profileSetupAt: null })).toBe(true);
    expect(isSetupAvailable({ profileSetupAt: '2026-09-15T20:00:00Z' })).toBe(true);
  });

  it('erkennt die fehlende Spalte an `undefined`', () => {
    // PostgREST liefert nur Spalten, die es gibt. Solange `0105` nicht
    // eingespielt ist, darf der Assistent nicht von selbst aufgehen – sonst
    // ginge er bei **jedem** Blick aufs Dashboard erneut auf, weil «Fertig»
    // nichts festhalten kann.
    expect(isSetupAvailable({ profileSetupAt: undefined })).toBe(false);
  });
});

describe('shouldStartSetup (BR-270)', () => {
  it('geht auf, solange niemand geantwortet hat', () => {
    expect(shouldStartSetup({ profileSetupAt: null })).toBe(true);
  });

  it('geht nach dem Überspringen nicht wieder auf', () => {
    // Überspringen **ist** eine Antwort. Ein zweites ungefragtes Aufgehen
    // wäre keine Hilfe mehr, sondern eine Sperre vor dem Dashboard.
    expect(shouldStartSetup({ profileSetupAt: '2026-09-15T20:00:00Z' })).toBe(false);
  });

  it('bleibt zu, solange es die Spalte nicht gibt', () => {
    expect(shouldStartSetup({ profileSetupAt: undefined })).toBe(false);
  });
});

describe('shouldOfferSetupCard', () => {
  it('steht auf dem Dashboard, solange das Profil unberührt ist', () => {
    expect(shouldOfferSetupCard(PLACEHOLDER)).toBe(true);
  });

  it('steht auch nach dem Überspringen', () => {
    // Sie ist der einzige Weg zurück für alle, die «Später» gewählt haben.
    expect(
      shouldOfferSetupCard({ ...PLACEHOLDER, profileSetupAt: '2026-09-15T20:00:00Z' }),
    ).toBe(true);
  });

  it('verschwindet, sobald etwas gepflegt ist', () => {
    expect(shouldOfferSetupCard({ ...PLACEHOLDER, avatarUrl: 'members/abc.jpg' })).toBe(
      false,
    );
  });

  it('bleibt weg, solange es die Spalte nicht gibt', () => {
    // Sonst führte sie in einen Assistenten, dessen «Fertig» nichts schreibt.
    expect(shouldOfferSetupCard({ ...PLACEHOLDER, profileSetupAt: undefined })).toBe(false);
  });
});

describe('isNameStepComplete (BR-031, BR-208)', () => {
  it('lässt einen Anzeigenamen genügen', () => {
    expect(
      isNameStepComplete({ displayName: 'Sandro', firstName: '', lastName: '' }),
    ).toBe(true);
  });

  it('lässt Vor- und Nachnamen genügen', () => {
    // BR-208: Ohne eigenen Anzeigenamen tragen die beiden ihn.
    expect(
      isNameStepComplete({ displayName: '', firstName: 'Sandro', lastName: 'Scalco' }),
    ).toBe(true);
  });

  it('lässt einen halben Namen nicht durch', () => {
    expect(
      isNameStepComplete({ displayName: '', firstName: 'Sandro', lastName: '' }),
    ).toBe(false);
    expect(isNameStepComplete({ displayName: '  ', firstName: '', lastName: '' })).toBe(
      false,
    );
  });
});
