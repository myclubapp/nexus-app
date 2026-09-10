/**
 * Das lokale Ticket – der Rückweg zu etwas, das anonym eingereicht wurde.
 *
 * Zwei Wege verwenden dasselbe Verfahren: das anonyme Anliegen (UC-029/030) und
 * der anonyme Sitzungs-Input (UC-031, A1). Deshalb steht es hier und nicht
 * zweimal: Zwei Verfahren für dieselbe Zusage wären zwei Angriffsflächen, und
 * eine davon würde irgendwann anders repariert als die andere.
 *
 * Das Ticket entsteht **auf dem Gerät** und bleibt dort; der Server bekommt nur
 * seinen Prüfwert. Wer den Speicher löscht, verliert den Rückweg – das ist der
 * Preis echter Anonymität, und er ist gewollt.
 */

/** Die Tickets aus einem gespeicherten Text lesen. */
export function readTickets(raw: string | null): string[] {
  try {
    const parsed = JSON.parse(raw ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Die Tickets dieses Geräts, ohne dass ein gesperrter Speicher die Seite umbringt. */
export function readStoredTickets(key: string): string[] {
  try {
    return readTickets(window.localStorage.getItem(key));
  } catch {
    // Privates Fenster oder gesperrter Speicher: kein Rückkanal, kein Absturz.
    return [];
  }
}

/**
 * Ein Ticket ablegen. Der Rückgabewert sagt, ob der Rückweg besteht.
 *
 * Wo der Speicher gesperrt ist, geht die Einreichung trotzdem raus – nur die
 * Antwort erreicht niemanden mehr. Das muss die Person erfahren, statt es
 * später zu bemerken.
 */
export function storeTicket(key: string, ticket: string): boolean {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify([...readStoredTickets(key), ticket]),
    );
    return true;
  } catch {
    return false;
  }
}

/** Ein neues Ticket. */
export function createAnonTicket(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Der Prüfwert, den der Server sieht – nie das Ticket selbst. */
export async function hashTicket(ticket: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ticket),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
