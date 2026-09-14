import { useId, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useRetractNews } from '../hooks/useNews';
import { useToast } from '../hooks/useToast';
import { ManageSection } from './ManageSection';
import { NewsCard } from './NewsCard';
import { isEditable } from '../lib/news';
import type { News } from '../lib/database.types';

interface NewsDetailModalProps {
  entry: News | null;
  fallbackAuthor: string;
  isTrainer: boolean;
  onShare: (entry: News) => void;
  /** Bearbeiten läuft über das Formular der Seite – das Blatt schliesst vorher. */
  onEdit: (entry: News) => void;
  onDismiss: () => void;
}

/**
 * Das News-Detail als Blatt über der Startseite – wie `news-detail` der
 * bestehenden myclub-App: Schliessen links, die Karte mit Bild und Volltext,
 * und für Trainer:innen unter der Karte der Abschnitt «Verwalten» – an
 * derselben Stelle wie im Termin- und im Amt-Detail (guidelines §2), nicht
 * mehr hinter einem Dreipunkt in der Kopfzeile.
 *
 * Bearbeiten und Zurückziehen stehen als Zeilen unter der Karte, nicht als
 * Knöpfe in ihr: Wer liest, soll lesen. Das Zurückziehen ist die rote Zeile,
 * und die Rückfrage davor stellt ein `IonAlert`.
 */
export function NewsDetailModal({
  entry,
  fallbackAuthor,
  isTrainer,
  onShare,
  onEdit,
  onDismiss,
}: NewsDetailModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const retract = useRetractNews();
  const presentingElement = usePresentingElement();
  const [askRetract, setAskRetract] = useState(false);
  // Das Blatt ist ein `role="dialog"` und braucht einen Namen; der Titel in
  // der Kopfzeile ist er (ion-modal, Accessibility).
  const titleId = useId();

  // A3/A4 (UC-026): Übernommene News der Website werden nicht zum Bearbeiten
  // angeboten – die Änderung ginge beim nächsten Abgleich verloren (UC-038).
  const editable = entry !== null && isEditable(entry);

  function retractEntry() {
    if (!entry) return;
    retract.mutate(entry.id, {
      onSuccess: () => {
        onDismiss();
        toast.success(t('newsForm.retracted'));
      },
      onError: (cause) => toast.failure(cause.message),
    });
  }

  return (
    <>
      <IonModal
        isOpen={entry !== null}
        onDidDismiss={onDismiss}
        presentingElement={presentingElement}
        aria-labelledby={titleId}
      >
        <IonHeader translucent>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss}>{t('common.close')}</IonButton>
            </IonButtons>
            <IonTitle id={titleId} role="heading" aria-level={2}>
              {t('common.details')}
            </IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          {entry && (
            <NewsCard entry={entry} fallbackAuthor={fallbackAuthor} onShare={onShare} full />
          )}
          {/* A3/A4 (UC-026): Bearbeiten führt ins Formular der Seite, das
              Blatt schliesst vorher. Zurückziehen fragt zuerst. */}
          {entry && isTrainer && (
            <ManageSection
              actions={[
                editable && {
                  label: t('newsForm.edit'),
                  onClick: () => onEdit(entry),
                  detail: true,
                },
                {
                  label: t('newsForm.retract'),
                  onClick: () => setAskRetract(true),
                  disabled: retract.isPending,
                  destructive: true,
                },
              ]}
            />
          )}
        </IonContent>
      </IonModal>

      {/* Die Rückfrage vor dem Zurückziehen (guidelines §2): Die News ist
          danach für alle weg. Neben dem Blatt, nicht darin – so überlebt sie
          dessen Schliessen. */}
      <IonAlert
        isOpen={askRetract}
        header={t('newsForm.retract')}
        message={t('newsForm.retractConfirm', { title: entry?.title ?? '' })}
        onDidDismiss={() => setAskRetract(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          { text: t('newsForm.retract'), role: 'destructive', handler: retractEntry },
        ]}
      />
    </>
  );
}
