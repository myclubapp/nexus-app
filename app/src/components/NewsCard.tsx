import type { MouseEvent } from 'react';
import {
  IonAvatar,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonBadge,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonCol,
  IonIcon,
  IonImg,
  IonLabel,
  IonRow,
} from '@ionic/react';
import { personCircleOutline, shareOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { isSample } from '../lib/sample';
import { formatDateTime } from '../lib/format';
import type { News } from '../lib/database.types';

interface NewsCardProps {
  entry: News;
  /** Wer die News verfasst hat, wenn sie keinen eigenen Autor trägt – der Verein. */
  fallbackAuthor: string;
  /** Öffnet das Detail-Blatt. Fehlt er, ist die Karte nur Anzeige (Detail). */
  onOpen?: (entry: News) => void;
  /** Teilen – nur für News mit Verweis auf die Quelle. */
  onShare?: (entry: News) => void;
  /** Volltext statt Anriss – im Detail-Blatt. */
  full?: boolean;
}

/**
 * Eine News als Karte – der Schnitt der bestehenden myclub-App: Bild oben,
 * darunter Datum und Titel, dann der Text, am Fuss der Autor als Chip mit
 * Bild und rechts das Teilen. In der Liste ist der Text auf drei Zeilen
 * gekürzt; das Detail zeigt ihn ganz.
 */
export function NewsCard({ entry, fallbackAuthor, onOpen, onShare, full = false }: NewsCardProps) {
  const { t } = useTranslation();

  function share(event: MouseEvent) {
    // Die Karte darunter öffnet das Detail – das Teilen soll das nicht.
    event.stopPropagation();
    onShare?.(entry);
  }

  return (
    <IonCard
      className={full ? 'app-news-card app-news-card--detail' : 'app-news-card'}
      button={onOpen !== undefined}
      onClick={onOpen ? () => onOpen(entry) : undefined}
    >
      {entry.image_url && <IonImg src={entry.image_url} alt={entry.title} />}
      <IonCardHeader>
        <IonCardSubtitle>
          {formatDateTime(entry.published_at)}
          {/* BR-160: auch ein Einführungs-Beitrag ist als Beispiel erkennbar. */}
          {isSample(entry) && (
            <>
              {' · '}
              <IonBadge color="medium">{t('sample.badge')}</IonBadge>
            </>
          )}
        </IonCardSubtitle>
        <IonCardTitle>{entry.title}</IonCardTitle>
      </IonCardHeader>
      {entry.body && (
        <IonCardContent className={full ? 'app-news-card__body' : 'app-news-card__lead'}>
          {entry.body}
        </IonCardContent>
      )}
      <IonRow className="ion-align-items-center">
        <IonCol size="8">
          <IonChip>
            {entry.author_image_url ? (
              <IonAvatar>
                <img src={entry.author_image_url} alt="" />
              </IonAvatar>
            ) : (
              <IonIcon icon={personCircleOutline} />
            )}
            <IonLabel>{entry.author ?? fallbackAuthor}</IonLabel>
          </IonChip>
        </IonCol>
        <IonCol size="4" className="ion-text-end">
          {entry.external_url && onShare && (
            <IonButton fill="clear" size="small" aria-label={t('news.share')} onClick={share}>
              <IonIcon slot="icon-only" icon={shareOutline} />
            </IonButton>
          )}
        </IonCol>
      </IonRow>
    </IonCard>
  );
}
