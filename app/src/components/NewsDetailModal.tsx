import { useState } from 'react';
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { ellipsisHorizontal, ellipsisVertical } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useRetractNews } from '../hooks/useNews';
import { useToast } from '../hooks/useToast';
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
 * und für Trainer:innen die Verwaltungswege hinter dem Dreipunkt rechts.
 *
 * Bearbeiten und Zurückziehen stehen im Action Sheet, nicht als Knöpfe in der
 * Karte: Wer liest, soll lesen. Das Zurückziehen ist der eine rote Knopf im
 * Blatt (guidelines §2), und das Sheet ist zugleich die Rückfrage davor.
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
  const [isActionsOpen, setActionsOpen] = useState(false);

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
      >
        <IonHeader translucent>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onDismiss}>{t('common.close')}</IonButton>
            </IonButtons>
            <IonTitle>{t('common.details')}</IonTitle>
            {isTrainer && (
              <IonButtons slot="end">
                <IonButton aria-label={t('common.more')} onClick={() => setActionsOpen(true)}>
                  <IonIcon slot="icon-only" ios={ellipsisHorizontal} md={ellipsisVertical} />
                </IonButton>
              </IonButtons>
            )}
          </IonToolbar>
        </IonHeader>
        <IonContent fullscreen>
          {entry && (
            <NewsCard entry={entry} fallbackAuthor={fallbackAuthor} onShare={onShare} full />
          )}
        </IonContent>
      </IonModal>

      {/* Neben dem Blatt, nicht darin: Es überlebt so das Schliessen. */}
      <IonActionSheet
        isOpen={isActionsOpen}
        onDidDismiss={() => setActionsOpen(false)}
        buttons={[
          ...(editable
            ? [
                {
                  text: t('newsForm.edit'),
                  handler: () => {
                    if (entry) onEdit(entry);
                  },
                },
              ]
            : []),
          {
            text: t('newsForm.retract'),
            role: 'destructive',
            handler: retractEntry,
          },
          { text: t('common.cancel'), role: 'cancel' },
        ]}
      />
    </>
  );
}
