import { describe, expect, it } from 'vitest';
import { isEditable, publishedTitle, validateNews, type NewsDraft } from './news';

function draft(overrides: Partial<NewsDraft> = {}): NewsDraft {
  return { title: 'Sommerfest', body: '', imageUrl: '', teamId: null, ...overrides };
}

describe('validateNews', () => {
  it('verlangt einen Titel – die Inbox braucht eine Überschrift', () => {
    expect(validateNews(draft({ title: 'A' }))).toContain('titleMissing');
    expect(validateNews(draft({ title: '   ' }))).toContain('titleMissing');
  });

  it('lässt eine News ohne Text zu', () => {
    // Ein Titel allein ist eine gültige Nachricht.
    expect(validateNews(draft({ body: '' }))).toEqual([]);
  });

  it('lässt das Bild weg oder verlangt einen vollständigen Link (A1)', () => {
    expect(validateNews(draft({ imageUrl: '' }))).toEqual([]);
    expect(validateNews(draft({ imageUrl: 'https://bild.example/a.jpg' }))).toEqual([]);
    expect(validateNews(draft({ imageUrl: 'bild.jpg' }))).toContain('imageNotALink');
  });

  it('weist ein Schema ab, das niemanden irgendwohin führt', () => {
    expect(validateNews(draft({ imageUrl: 'javascript:alert(1)' }))).toContain(
      'imageNotALink',
    );
  });
});

describe('isEditable', () => {
  it('lässt eigene News bearbeiten', () => {
    expect(isEditable({ source: 'club' })).toBe(true);
    expect(isEditable({ source: 'team' })).toBe(true);
  });

  it('bietet übernommene News der Website nicht zum Bearbeiten an', () => {
    // Die Änderung ginge beim nächsten Abgleich verloren (UC-038).
    expect(isEditable({ source: 'website' })).toBe(false);
  });
});

describe('publishedTitle (FR-100)', () => {
  it('gibt den Titel zurück, wenn publiziert werden soll', () => {
    expect(publishedTitle(true, false, 'Aus dem Vorstand')).toBe('Aus dem Vorstand');
  });

  it('publiziert nicht, wenn der Schalter aus ist', () => {
    expect(publishedTitle(false, false, 'Aus dem Vorstand')).toBeNull();
  });

  it('publiziert eine Ablehnung nie – auch mit eingeschaltetem Schalter', () => {
    // «Aus dem Vorstand» erzählt, was aus Vorschlägen wurde. Ein Nein an eine
    // einzelne Person ist keine Meldung an alle; der Server hält dieselbe
    // Regel ein zweites Mal (`0055`).
    expect(publishedTitle(true, true, 'Aus dem Vorstand')).toBeNull();
  });

  it('publiziert nicht ohne Titel – eine News ohne Überschrift gibt es nicht', () => {
    expect(publishedTitle(true, false, '   ')).toBeNull();
  });
});
