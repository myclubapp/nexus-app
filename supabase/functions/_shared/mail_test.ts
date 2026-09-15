/**
 * Das gemeinsame Mail-Gerüst (UC-048) – `deno test` in diesem Ordner.
 */
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import {
  brandColor,
  button,
  copyLink,
  escapeHtml,
  facts,
  onBrand,
  paragraph,
  renderShell,
  safeUrl,
  whyLine,
} from './mail.ts';

Deno.test('Adressen: nur https kommt ins Blatt', () => {
  assertEquals(safeUrl('https://cdn.example.ch/logo.png'), 'https://cdn.example.ch/logo.png');
  assertEquals(safeUrl('http://cdn.example.ch/logo.png'), null);
  assertEquals(safeUrl('javascript:alert(1)'), null);
  assertEquals(safeUrl('data:text/html,<script>'), null);
  assertEquals(safeUrl('nicht mal eine Adresse'), null);
  assertEquals(safeUrl(null), null);
});

Deno.test('Farbe: sechsstellige Hexzahl, sonst die Grundfarbe', () => {
  assertEquals(brandColor('#1A73E8'), '#1a73e8');
  assertEquals(brandColor('#abc'), '#795deb');
  assertEquals(brandColor('rot'), '#795deb');
  assertEquals(brandColor(null), '#795deb');
});

Deno.test('Schrift auf dem Kopfband wechselt bei heller Vereinsfarbe', () => {
  assertEquals(onBrand('#1a237e'), '#ffffff');
  assertEquals(onBrand('#ffeb3b'), '#1a1a1a');
  assertEquals(onBrand('#ffffff'), '#1a1a1a');
  assertEquals(onBrand('#000000'), '#ffffff');
});

Deno.test('Maskierung deckt alle fünf Zeichen ab', () => {
  assertEquals(escapeHtml(`<a href="x" onclick='y'>&</a>`),
    '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});

Deno.test('Das Blatt trägt Logo und Vereinsname – auch wenn Bilder blockiert sind', () => {
  const shell = renderShell({
    brand: { clubName: 'TV Musterhausen', color: '#1a73e8', logoUrl: 'https://cdn.example.ch/l.png' },
    locale: 'de',
    subject: 'Betreff',
    preheader: 'Vorschau',
    greeting: 'Hallo Sandro',
    sections: [paragraph('Inhalt')],
    footnote: 'Darum kommt diese Mail.',
    year: 2026,
  });
  assertStringIncludes(shell.html, 'src="https://cdn.example.ch/l.png"');
  assertStringIncludes(shell.html, 'alt="TV Musterhausen"');
  // Der Name steht als Text daneben, nicht nur im alt-Attribut.
  assertStringIncludes(shell.html, '>TV Musterhausen</td>');
  assertStringIncludes(shell.html, 'bgcolor="#1a73e8"');
  assertStringIncludes(shell.html, 'Darum kommt diese Mail.');
  assertStringIncludes(shell.text, 'Darum kommt diese Mail.');
});

Deno.test('Ohne Logo bleibt das Kopfband ein Name, ohne Verein «myclub»', () => {
  const shell = renderShell({
    brand: { clubName: null, color: null, logoUrl: null },
    locale: 'en',
    subject: 'Subject',
    preheader: 'Preview',
    sections: [paragraph('Body')],
    footnote: 'Why.',
    year: 2026,
  });
  assert(!shell.html.includes('<img'));
  assertStringIncludes(shell.html, '>myclub</td>');
  assertStringIncludes(shell.html, 'bgcolor="#795deb"');
});

Deno.test('Ein Logo über http landet nicht im Blatt', () => {
  const shell = renderShell({
    brand: { clubName: 'X', color: null, logoUrl: 'http://cdn.example.ch/l.png' },
    locale: 'de',
    subject: 's',
    preheader: 'p',
    sections: [],
    footnote: 'w',
    year: 2026,
  });
  assert(!shell.html.includes('<img'));
});

Deno.test('Bausteine: Warum, Werte und Schaltfläche tragen HTML und Text', () => {
  const why = whyLine('Warum:', 'Damit die Halle offen ist.', '#1a73e8');
  assertStringIncludes(why.html, 'bgcolor="#1a73e8"');
  assertEquals(why.text, 'Warum: Damit die Halle offen ist.');

  const rows = facts([['Betrag', 'CHF 120.00'], ['Zahlbar bis', '31.10.2026']]);
  assertStringIncludes(rows.html, 'CHF 120.00');
  assertEquals(rows.text, 'Betrag: CHF 120.00\nZahlbar bis: 31.10.2026');

  assertEquals(button('Öffnen', 'http://unsicher.example', '#1a73e8'), { html: '', text: '' });
  const ok = button('Öffnen', 'https://app.example.ch/x', '#ffeb3b');
  assertStringIncludes(ok.html, 'color: #1a1a1a'); // helle Vereinsfarbe, dunkle Schrift
  assertEquals(ok.text, 'Öffnen: https://app.example.ch/x');
});

// Die Adresse zum Kopieren steht neben der Schaltfläche, weil sich eine
// Schaltfläche nicht markieren lässt (UC-005 A5).
Deno.test('Kopieradresse: ausgeschrieben im Blatt, eigene Zeile im Text', () => {
  const link = copyLink('Oder kopieren:', 'https://app.example.ch/auth/verify?token_hash=abc');
  // Ausgeschrieben – und trotzdem anklickbar.
  assertStringIncludes(link.html, 'href="https://app.example.ch/auth/verify?token_hash=abc"');
  assertStringIncludes(link.html, '>https://app.example.ch/auth/verify?token_hash=abc</a>');
  // Kein Mailprogramm soll sie am Rand abschneiden.
  assertStringIncludes(link.html, 'word-break: break-all');
  // Eigene Zeile: Hinter einem Doppelpunkt hängen manche Programme das
  // Satzzeichen an den Link.
  assertEquals(link.text, 'Oder kopieren:\nhttps://app.example.ch/auth/verify?token_hash=abc');

  assertEquals(copyLink('Oder kopieren:', 'http://unsicher.example'), { html: '', text: '' });
});
