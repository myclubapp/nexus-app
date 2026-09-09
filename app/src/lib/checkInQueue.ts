/**
 * Gepufferte Check-ins (UC-014 A5, NFR-010).
 *
 * Ein Check-in geschieht dort, wo das Netz am schlechtesten ist: in der Halle,
 * im Wald, im Untergeschoss. Er darf deshalb nicht am Netz scheitern – aber
 * geprüft wird er trotzdem erst auf dem Server, beim Nachsenden. Der Puffer
 * verschiebt die Zustellung, nicht die Prüfung.
 *
 * Reine Logik ohne Speicherzugriff, damit sie prüfbar ist: Was in den Puffer
 * gehört, was daraus verfällt und was als Nächstes zu senden ist, entscheidet
 * sich hier; wohin die Liste geschrieben wird, entscheidet der Aufrufer.
 */

export interface PendingCheckIn {
  eventId: string;
  qrToken: string;
  /** Zeitpunkt des Scans in Millisekunden. */
  scannedAt: number;
}

/** NFR-010: Länger als 24 Stunden wird nichts nachgesendet. */
export const CHECK_IN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Einen Scan aufnehmen.
 *
 * Zum selben Termin steht höchstens ein Eintrag: Wer dreimal scannt, weil
 * nichts passiert, soll nicht dreimal nachsenden. Der jüngere Scan gewinnt,
 * weil er den Zeitpunkt trägt, an dem die Person tatsächlich da war.
 */
export function enqueueCheckIn(
  queue: readonly PendingCheckIn[],
  entry: PendingCheckIn,
): PendingCheckIn[] {
  return [...queue.filter((item) => item.eventId !== entry.eventId), entry];
}

/**
 * Was ist noch gültig?
 *
 * Ein abgelaufener Check-in wird nicht etwa doch noch gesendet: Das
 * Zeitfenster des Termins ist längst zu, der Server wiese ihn ab, und die
 * Person bekäme einen Fehler zu einem Anlass von gestern.
 */
export function pruneCheckIns(
  queue: readonly PendingCheckIn[],
  now: number = Date.now(),
): PendingCheckIn[] {
  return queue.filter((item) => now - item.scannedAt < CHECK_IN_TTL_MS);
}

/** Einen erledigten Eintrag entfernen – gleich ob er glückte oder abgewiesen wurde. */
export function removeCheckIn(
  queue: readonly PendingCheckIn[],
  eventId: string,
): PendingCheckIn[] {
  return queue.filter((item) => item.eventId !== eventId);
}

/**
 * Aus dem gespeicherten Text eine Liste machen.
 *
 * Alles, was nicht wie ein Eintrag aussieht, fällt weg. Der Puffer liegt im
 * Gerät und kann von einer älteren Fassung der App stammen; ein unlesbarer
 * Eintrag darf den Rest nicht mitreissen.
 */
export function parseQueue(raw: string | null): PendingCheckIn[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is PendingCheckIn => {
      if (typeof item !== 'object' || item === null) return false;
      const entry = item as Record<string, unknown>;
      return (
        typeof entry.eventId === 'string' &&
        entry.eventId.length > 0 &&
        typeof entry.qrToken === 'string' &&
        entry.qrToken.length > 0 &&
        typeof entry.scannedAt === 'number' &&
        Number.isFinite(entry.scannedAt)
      );
    });
  } catch {
    return [];
  }
}
