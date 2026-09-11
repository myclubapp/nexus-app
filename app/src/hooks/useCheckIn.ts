import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, isConfigured } from '../lib/supabase';
import { useClub } from './useClub';
import {
  enqueueCheckIn,
  parseQueue,
  pruneCheckIns,
  removeCheckIn,
  type PendingCheckIn,
} from '../lib/checkInQueue';
import { checkInErrorKey, isKnownOffline, isRetryable } from '../lib/checkInError';
import { useToast } from './useToast';

const QUEUE_KEY = 'myclub.checkInQueue';

function readQueue(): PendingCheckIn[] {
  try {
    return pruneCheckIns(parseQueue(window.localStorage.getItem(QUEUE_KEY)));
  } catch {
    // Privates Fenster oder gesperrter Speicher: dann eben ohne Puffer.
    return [];
  }
}

function writeQueue(queue: PendingCheckIn[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ohne Speicher bleibt der Check-in eben nur dieser Sitzung erhalten.
  }
}

/**
 * Erledigte Einträge entfernen – und nur diese.
 *
 * Das Nachsenden dauert; wer währenddessen scannt, schreibt in denselben
 * Speicher. Ein blindes Zurückschreiben des Schnappschusses löschte den neuen
 * Eintrag, obwohl der Person die Zustellung zugesagt worden war. Deshalb wird
 * hier frisch gelesen und gezielt abgezogen.
 */
function dropFromQueue(eventIds: readonly string[]): void {
  let queue = readQueue();
  for (const eventId of eventIds) {
    queue = removeCheckIn(queue, eventId);
  }
  writeQueue(queue);
}

/**
 * Den QR-Code eines Termins anzeigen (FR-034, Schritt 1–2).
 *
 * Seit `0029` liegt das Token in einer eigenen Tabelle, deren Policy es
 * Trainer:innen und dem Vorstand vorbehält. Vorher stand es in `events` und
 * war damit für jedes Mitglied lesbar – ein Code, den alle kennen, beweist
 * keine Anwesenheit.
 */
export function useEventQrToken(eventId: string | null) {
  const { isTrainer } = useClub();

  return useQuery({
    queryKey: ['event-qr-token', eventId],
    enabled: Boolean(eventId) && isTrainer && isConfigured,
    queryFn: async (): Promise<string> => {
      const { data, error } = await supabase
        .from('event_qr_tokens')
        .select('token')
        .eq('event_id', eventId!)
        .single();
      if (error) throw new Error(error.message);
      return data.token;
    },
  });
}

export interface EventRosterEntry {
  memberId: string;
  displayName: string;
  status: string;
}

/** Die Teilnehmerliste eines Termins (A6, FR-027). */
export function useEventRoster(eventId: string | null) {
  const { isTrainer } = useClub();

  return useQuery({
    queryKey: ['event-roster', eventId],
    enabled: Boolean(eventId) && isTrainer && isConfigured,
    queryFn: async (): Promise<EventRosterEntry[]> => {
      const { data, error } = await supabase.rpc('event_roster', {
        p_event_id: eventId!,
      });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        memberId: row.member_id,
        displayName: row.display_name,
        status: row.status,
      }));
    },
  });
}

/**
 * A6: Anwesenheit von Hand erfassen.
 *
 * Wer kein Smartphone dabei hat, war deswegen nicht weniger anwesend. Gebucht
 * wird über dieselbe Datenbankfunktion wie beim Scan.
 */
export function useMarkAttendance(eventId: string | null) {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      present: boolean;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc('mark_attendance', {
        p_event_id: eventId!,
        p_member_id: input.memberId,
        p_present: input.present,
      });
      if (error) throw new Error(error.message);
      return data ?? 0;
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-roster', eventId] });
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    },
  });
}

export interface CheckInOutcome {
  points: number;
  alreadyCheckedIn: boolean;
  /** A5: gepuffert statt gebucht – der Server hat ihn noch nicht gesehen. */
  queued: boolean;
  /** Übersetzungsschlüssel des Fehlers, falls einer auftrat. */
  errorKey: ReturnType<typeof checkInErrorKey> | null;
}

/**
 * Einchecken (Schritte 5–8, A1–A5).
 *
 * Bei einem Netzfehler wandert der Scan in den Puffer und wird beim nächsten
 * Verbindungsaufbau nachgesendet (A5, NFR-010). Geprüft wird er auch dann
 * vollständig auf dem Server – der Puffer verschiebt die Zustellung, nicht die
 * Prüfung.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  const { activeClub, activeMembership } = useClub();

  return useMutation({
    mutationFn: async (input: {
      eventId: string;
      qrToken: string;
    }): Promise<CheckInOutcome> => {
      const { data, error } = await supabase.rpc('check_in', {
        p_event_id: input.eventId,
        p_qr_token: input.qrToken,
      });

      if (error) {
        const key = checkInErrorKey(error.message);
        // Ein Browser, der sich selbst offline nennt, hat recht – auch wenn
        // die Fehlermeldung nach etwas anderem aussieht.
        if (isRetryable(key) || isKnownOffline()) {
          writeQueue(
            enqueueCheckIn(readQueue(), {
              eventId: input.eventId,
              qrToken: input.qrToken,
              scannedAt: Date.now(),
            }),
          );
          return {
            points: 0,
            alreadyCheckedIn: false,
            queued: true,
            errorKey: 'offline',
          };
        }
        throw new Error(error.message);
      }

      const row = data?.[0];
      return {
        points: row?.points_awarded ?? 0,
        alreadyCheckedIn: row?.already_checked_in ?? false,
        queued: false,
        errorKey: null,
      };
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
      // Schritt 8: `['points', …]` ist das Präfix, unter dem das Dashboard
      // seinen Punktestand hält – es aktualisiert damit unmittelbar mit.
      void queryClient.invalidateQueries({ queryKey: ['points', activeMembership?.id] });
    },
  });
}

/**
 * Gepufferte Check-ins nachsenden (A5).
 *
 * Ausgelöst beim Start, vom `online`-Ereignis und bei der Rückkehr in den
 * Vordergrund – ein Gerät, das die App im Flugmodus geschlossen hat, feuert
 * `online` sonst nie, und WKWebView meldet es ohnehin unzuverlässig.
 *
 * Ein endgültig abgewiesener Eintrag verschwindet, aber nicht stumm: Der
 * Person wurde die Zustellung zugesagt, also erfährt sie auch, wenn daraus
 * nichts wurde.
 */
export function useCheckInQueue() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { t } = useTranslation();
  const { activeClub, activeMembership } = useClub();

  const flush = useCallback(async () => {
    const queue = readQueue();
    if (queue.length === 0 || !isConfigured) return;

    const done: string[] = [];
    const rejected: string[] = [];

    for (const item of queue) {
      const { error } = await supabase.rpc('check_in', {
        p_event_id: item.eventId,
        p_qr_token: item.qrToken,
      });

      if (error) {
        const key = checkInErrorKey(error.message);
        if (isRetryable(key) || isKnownOffline()) {
          // Noch immer kein Netz: Der Eintrag bleibt für den nächsten Versuch.
          continue;
        }
        // Endgültig abgewiesen – etwa, weil das Zeitfenster inzwischen zu ist.
        rejected.push(item.eventId);
        done.push(item.eventId);
        continue;
      }
      done.push(item.eventId);
    }

    if (done.length === 0) return;
    dropFromQueue(done);

    // Der Person wurde die Zustellung zugesagt. Scheitert sie endgültig, muss
    // sie das erfahren – sonst glaubt sie, eingecheckt zu sein, und hat weder
    // Anwesenheit noch Punkte (Failure-Postcondition von UC-014).
    if (rejected.length > 0) {
      toast.failure(t('checkIn.queueRejected', { count: rejected.length }));
    }

    void queryClient.invalidateQueries({ queryKey: ['agenda', activeClub?.id] });
    void queryClient.invalidateQueries({ queryKey: ['points', activeMembership?.id] });
  }, [queryClient, toast, t, activeClub?.id, activeMembership?.id]);

  useEffect(() => {
    // Dieselbe Referenz zum An- und Abmelden: Zwei Pfeilfunktionen sind zwei
    // verschiedene Zuhörer, und das Abmelden entfernte nichts.
    const onOnline = () => void flush();
    void flush();
    window.addEventListener('online', onOnline);
    // WKWebView meldet `online` unzuverlässig. Die Rückkehr in den Vordergrund
    // ist der Moment, in dem ein iPhone typischerweise wieder Netz hat.
    document.addEventListener('visibilitychange', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onOnline);
    };
  }, [flush]);

  return { flush };
}
