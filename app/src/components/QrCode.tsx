import { useEffect, useState } from 'react';
import { IonNote, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';

interface QrCodeProps {
  /** Inhalt des Codes, z.B. ein Einladungslink. */
  value: string;
  /** Kantenlänge in Pixeln. */
  size?: number;
  /** Beschreibung für Bedienhilfen – der Code selbst ist für sie wertlos. */
  label: string;
}

/**
 * QR-Code als Bild.
 *
 * `qrcode` wird erst beim Anzeigen geladen: Ein Einladungs- oder Check-in-Code
 * erscheint selten, die Bibliothek gehört deshalb nicht in das Startbündel.
 * Erzeugt wird eine Data-URL, damit das Bild ohne Netz und ohne fremden Dienst
 * entsteht (C-003 – kein Google-Chart-Dienst).
 */
export function QrCode({ value, size = 240, label }: QrCodeProps) {
  const { t } = useTranslation();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl(null);
    setFailed(false);

    void import('qrcode')
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(value, { width: size, margin: 1 }),
      )
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [value, size]);

  if (failed) {
    return (
      <div className="app-qr" role="alert">
        <IonNote color="danger">{t('invite.qrFailed')}</IonNote>
      </div>
    );
  }

  return (
    <div className="app-qr">
      {dataUrl ? (
        <img src={dataUrl} alt={label} width={size} height={size} />
      ) : (
        <IonSpinner name="crescent" />
      )}
    </div>
  );
}
