import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useCheckIn } from '../hooks/useCheckIn';
import { InlineError, InlineSuccess } from './StateViews';
import { checkInErrorKey, type CheckInErrorKey } from '../lib/checkInError';

const SCANNER_ELEMENT_ID = 'myclub-qr-scanner';

interface CheckInScannerProps {
  eventId: string;
  onDismiss: () => void;
}

/**
 * QR-Check-in (UC-014, Schritte 3–8).
 *
 * Der Scan läuft über `html5-qrcode` im WebView, ohne native Google-Komponente
 * (BR-058, C-005). Das Token wird nur weitergereicht: Geprüft und verbucht
 * wird es serverseitig (BR-056), und der Client könnte die Prüfung ohnehin
 * nicht ersetzen – er kennt das Token des Termins gar nicht.
 *
 * Eigene Komponente ohne Blatt-Hülle, weil `IonModal` seinen Inhalt im Test
 * nicht rendert (docs/TESTING.md).
 */
export function CheckInScanner({ eventId, onDismiss }: CheckInScannerProps) {
  const { t } = useTranslation();
  const checkIn = useCheckIn();
  const runCheckIn = checkIn.mutate;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  // Getrennt von `cancelled`: Der Riegel gegen Mehrfach-Erkennung darf nicht
  // derselbe sein wie das Aufräum-Signal, sonst bleibt der Scanner nach einem
  // abgewiesenen Code taub – A2 verlangt aber, dass es weitergeht.
  const busyRef = useRef(false);
  const [errorKey, setErrorKey] = useState<CheckInErrorKey | null>(null);
  const [result, setResult] = useState<{
    points: number;
    already: boolean;
    queued: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    busyRef.current = false;
    setErrorKey(null);
    setResult(null);

    // Die Scanner-Bibliothek wird erst geladen, wenn jemand tatsächlich
    // eincheckt; sie legte sonst ein paar hundert Kilobyte auf das Startbündel.
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (cancelled) return;
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;

        scanner
          .start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decodedText) => {
              if (cancelled || busyRef.current) return;
              busyRef.current = true;
              runCheckIn(
                { eventId, qrToken: decodedText },
                {
                  onSuccess: (outcome) =>
                    setResult({
                      points: outcome.points,
                      already: outcome.alreadyCheckedIn,
                      queued: outcome.queued,
                    }),
                  onError: (cause) => {
                    setErrorKey(checkInErrorKey(cause.message));
                    // A2: «Use case continues at step 4» – wer den falschen
                    // Code erwischt hat, hält gleich den richtigen hin.
                    busyRef.current = false;
                  },
                },
              );
            },
            () => {
              // Nicht erkannte Einzelbilder sind der Normalfall, kein Fehler.
            },
          )
          .then(() => {
            // Wurde das Blatt geschlossen, während die Kamera startete, greift
            // die Aufräumfunktion zu früh: `isScanning` steht dort noch auf
            // `false`, und der Videostream liefe samt Kamera-Anzeige weiter.
            if (cancelled) {
              void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
            }
          })
          .catch(() => {
            // `html5-qrcode` lehnt teils mit einer Zeichenkette statt einem
            // `Error` ab. Der Grund ist hier ohnehin immer die Kamera – die
            // Meldung soll das sagen und nicht «Check-in fehlgeschlagen».
            setErrorKey('camera');
          });
      });
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner?.isScanning) {
        void scanner.stop().then(() => scanner.clear()).catch(() => undefined);
      }
    };
  }, [eventId, runCheckIn]);

  return (
    <>
      <div id={SCANNER_ELEMENT_ID} className="app-scanner" />

      {/* Schritt 7: die Bestätigung nennt die Zahl, um die es geht. */}
      {result && (
        <InlineSuccess
          message={
            result.queued
              ? t('checkIn.queued')
              : result.already
                ? t('checkIn.already')
                : result.points > 0
                  ? t('checkIn.awarded', { points: result.points })
                  : t('checkIn.done')
          }
        />
      )}

      {/* A1–A3: der Grund in der Sprache der Person, nicht der Datenbank. */}
      {errorKey && <InlineError message={t(`checkIn.error.${errorKey}`)} />}

      <div className="app-actions">
        <IonButton expand="block" fill="clear" onClick={onDismiss}>
          {t('common.close')}
        </IonButton>
      </div>
    </>
  );
}

interface CheckInModalProps {
  eventId: string | null;
  onDismiss: () => void;
}

/** Blatt-Hülle; die Kamera startet erst beim Öffnen. */
export function CheckInModal({ eventId, onDismiss }: CheckInModalProps) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();

  return (
    <IonModal
      isOpen={Boolean(eventId)}
      onDidDismiss={onDismiss}
      presentingElement={presentingElement}
    >
      <IonHeader translucent>
        <IonToolbar>
          <IonTitle>{t('agenda.scanQr')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="ion-padding">
        {eventId && <CheckInScanner eventId={eventId} onDismiss={onDismiss} />}
      </IonContent>
    </IonModal>
  );
}
