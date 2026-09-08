import { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import type { Html5Qrcode } from 'html5-qrcode';
import { useTranslation } from 'react-i18next';
import { useCheckIn } from '../hooks/useAgenda';

const SCANNER_ELEMENT_ID = 'myclub-qr-scanner';

interface CheckInModalProps {
  eventId: string | null;
  onDismiss: () => void;
}

/**
 * QR-Check-in ohne Google ML Kit: html5-qrcode nutzt die Kamera im WebView
 * (Architektur §3.1). Der Token wird nur weitergereicht – geprüft und
 * verbucht wird er serverseitig.
 */
export function CheckInModal({ eventId, onDismiss }: CheckInModalProps) {
  const { t } = useTranslation();
  const checkIn = useCheckIn();
  const runCheckIn = checkIn.mutate;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!eventId) return;

    let cancelled = false;
    setError(null);
    setDone(false);

    // The scanner library is only pulled in when someone actually checks in;
    // it would otherwise add a few hundred kilobytes to the initial bundle.
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
              if (cancelled) return;
              cancelled = true;
              runCheckIn(
                { eventId, qrToken: decodedText },
                {
                  onSuccess: () => setDone(true),
                  onError: (cause) => setError(cause.message),
                },
              );
            },
            () => {
              // Per-frame decode misses are normal; nothing to report.
            },
          )
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : String(cause));
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
    <IonModal isOpen={Boolean(eventId)} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('agenda.scanQr')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onDismiss}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div id={SCANNER_ELEMENT_ID} className="app-scanner" />

        {done && (
          <IonNote color="success">
            <p>{t('agenda.checkedIn')}</p>
          </IonNote>
        )}
        {error && (
          <IonNote color="danger">
            <p>{error}</p>
          </IonNote>
        )}
      </IonContent>
    </IonModal>
  );
}
