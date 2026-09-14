import DOMPurify from 'dompurify';

/**
 * Der Volltext eines übernommenen Website-Beitrags, entschärft für die Ansicht
 * (UC-038, BR-169).
 *
 * Die Website liefert `content.rendered` als HTML, und nur so kommen Absätze,
 * Zwischentitel und die Bilder im Text mit – die bestehende myclub-App zeigte
 * genau das im Detail. Fremdes HTML ungefiltert ins DOM zu setzen wäre aber
 * eine Einladung an jede Skript-Einbettung. Deshalb geht hier **nur** durch,
 * was ein Artikel braucht: Text-Elemente, Listen, Verweise, Bilder, Tabellen.
 * Alles andere fällt weg, der Textinhalt bleibt (Skripte, Rahmen, Formulare,
 * Stile, Klassen, `on*`-Attribute, `data:`-Adressen).
 *
 * Verweise öffnen in einem neuen Fenster mit `noopener`: Auf dem Gerät reicht
 * Capacitor sie damit an den System-Browser weiter, in der PWA wird es ein
 * neuer Tab – der Artikel bleibt offen. Bilder laden träge, wie das Titelbild
 * der Karte.
 *
 * Diese Funktion ist die einzige Stelle, die `body_html` für die Ansicht
 * freigibt. Wer den Volltext anderswo zeigen will, geht hier durch.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'span',
  'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote',
  'a',
  'figure', 'figcaption', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title', 'srcset', 'sizes', 'width', 'height', 'colspan', 'rowspan',
];

let purifier: ReturnType<typeof DOMPurify> | null = null;

/**
 * Eine eigene Instanz mit eigenen Hooks – die Hooks des Standard-Exports
 * sind global und träfen jeden anderen Aufruf im selben Fenster.
 */
function newsPurifier(): ReturnType<typeof DOMPurify> {
  if (purifier) return purifier;
  const instance = DOMPurify(window);
  instance.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
    if (node.tagName === 'IMG') {
      node.setAttribute('loading', 'lazy');
    }
  });
  purifier = instance;
  return instance;
}

/**
 * Bleibt nach dem Entschärfen etwas Sichtbares übrig? Ein Beitrag, der nur aus
 * einer Einbettung bestand, ist danach leer – dann zeigt die Ansicht den
 * Anriss und den Weg zur Website, nicht eine leere Fläche.
 */
function hasVisibleContent(html: string): boolean {
  if (/<img\b/i.test(html)) return true;
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '';
}

/**
 * Den Volltext für `dangerouslySetInnerHTML` freigeben. Leer, wenn es nichts
 * zu zeigen gibt – die Ansicht fällt dann auf `body` zurück.
 */
export function sanitizeNewsHtml(html: string | null | undefined): string {
  if (!html || html.trim() === '') return '';
  const clean = newsPurifier()
    .sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
      ALLOW_ARIA_ATTR: false,
      // `data:`- und `javascript:`-Adressen fallen durch die Vorgabe von
      // DOMPurify weg; `blob:` bräuchte niemand in einem Artikel.
      ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
    })
    .trim();
  return hasVisibleContent(clean) ? clean : '';
}
