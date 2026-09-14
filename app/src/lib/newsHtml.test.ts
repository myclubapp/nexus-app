import { describe, expect, it } from 'vitest';
import { sanitizeNewsHtml } from './newsHtml';

/**
 * Der Volltext einer Website im Detail (UC-038, BR-169): Was ein Artikel
 * braucht, kommt durch; was eine Einbettung wäre, fällt weg.
 */
describe('sanitizeNewsHtml', () => {
  it('lässt Absätze, Zwischentitel, Listen und Bilder durch', () => {
    const html =
      '<h2>Zwischentitel</h2><p>Ein <strong>starker</strong> Satz.</p>' +
      '<ul><li>eins</li><li>zwei</li></ul>' +
      '<figure><img src="https://verein.ch/bild.jpg" alt="Halle" width="800" height="600">' +
      '<figcaption>Die Halle</figcaption></figure>';

    const clean = sanitizeNewsHtml(html);

    expect(clean).toContain('<h2>Zwischentitel</h2>');
    expect(clean).toContain('<strong>starker</strong>');
    expect(clean).toContain('<li>zwei</li>');
    expect(clean).toContain('src="https://verein.ch/bild.jpg"');
    expect(clean).toContain('alt="Halle"');
    expect(clean).toContain('<figcaption>Die Halle</figcaption>');
  });

  it('entfernt Skripte, Rahmen, Formulare und Ereignis-Attribute', () => {
    const html =
      '<p onclick="steal()">Text</p><script>alert(1)</script>' +
      '<iframe src="https://evil.example"></iframe>' +
      '<form action="https://evil.example"><input name="pw"></form>' +
      '<img src="x" onerror="alert(2)">' +
      '<a href="javascript:alert(3)">Klick</a>';

    const clean = sanitizeNewsHtml(html);

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<form');
    expect(clean).not.toContain('<input');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('javascript:');
    // Der Text bleibt – nur das Element fällt.
    expect(clean).toContain('Text');
    expect(clean).toContain('Klick');
  });

  it('streift Klassen und Stile der Website ab', () => {
    const clean = sanitizeNewsHtml(
      '<p class="wp-block has-large-font" style="color:red" id="p1">Satz</p>',
    );
    expect(clean).toBe('<p>Satz</p>');
  });

  it('öffnet Verweise in einem neuen Fenster und lädt Bilder träge', () => {
    const clean = sanitizeNewsHtml(
      '<p><a href="https://verein.ch/artikel">weiter</a></p><img src="https://verein.ch/a.jpg">',
    );
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).toContain('loading="lazy"');
  });

  it('ist leer, wenn nichts Sichtbares übrig bleibt', () => {
    expect(sanitizeNewsHtml(null)).toBe('');
    expect(sanitizeNewsHtml('')).toBe('');
    expect(sanitizeNewsHtml('   ')).toBe('');
    // Nur eine Einbettung: nach dem Entschärfen steht nichts mehr da.
    expect(sanitizeNewsHtml('<iframe src="https://video.example/x"></iframe>')).toBe('');
    expect(sanitizeNewsHtml('<p>&nbsp;</p><div></div>')).toBe('');
  });

  it('behält ein Bild ohne Text als Inhalt', () => {
    expect(sanitizeNewsHtml('<img src="https://verein.ch/a.jpg">')).toContain('<img');
  });
});
