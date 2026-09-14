import { useMemo, type MouseEvent } from 'react';
import {
  IonAvatar,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonBadge,
  IonButton,
  IonCardSubtitle,
  IonCardTitle,
  IonChip,
  IonFab,
  IonFabButton,
  IonIcon,
  IonLabel,
} from '@ionic/react';
import { openOutline, personCircleOutline, share as shareIcon } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { isSample } from '../lib/sample';
import { formatDateTime } from '../lib/format';
import { sanitizeNewsHtml } from '../lib/newsHtml';
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
 * Bild. In der Liste ist der Anriss (`body`) auf drei Zeilen gekürzt; das
 * Detail zeigt den Volltext (`body_html`) mit Absätzen und den Bildern im
 * Text – wie `news-detail` der alten App, nur entschärft: `sanitizeNewsHtml`
 * lässt ausschliesslich die Elemente eines Artikels durch (BR-169). Fehlt der
 * Volltext, steht der Anriss da und ein Verweis auf die Website.
 *
 * Das Teilen liegt als kleiner runder Knopf oben rechts über dem Bild – der
 * einzige `IonFab` neben `CreateFab` (guidelines §2). Er ist nicht `fixed`,
 * sondern gehört zur Karte: `ion-card` ist `position: relative`, der Fab
 * setzt sich absolut in ihre Ecke. So stand er schon in `news.page.html` der
 * alten App, und dort suchen ihn die Mitglieder. In der Liste ist er damit
 * ein Knopf in der Karte, die selbst ein Knopf ist – bewusst so übernommen;
 * der Klick bleibt über `stopPropagation` beim Teilen.
 *
 * Das Bild ist ein natives `img` mit `loading="lazy"`: `ion-img` ist
 * abgekündigt und fällt in Ionic 10 weg.
 */
export function NewsCard({ entry, fallbackAuthor, onOpen, onShare, full = false }: NewsCardProps) {
  const { t } = useTranslation();
  const isButton = onOpen !== undefined;
  const canShare = Boolean(entry.external_url) && onShare !== undefined;
  // Nur im Detail, und nur einmal je Beitrag – das Entschärfen baut ein DOM.
  const article = useMemo(
    () => (full ? sanitizeNewsHtml(entry.body_html) : ''),
    [full, entry.body_html],
  );
  const showSourceLink = full && article === '' && Boolean(entry.external_url);

  function share(event: MouseEvent) {
    // Die Karte darunter öffnet das Detail – das Teilen soll das nicht.
    event.stopPropagation();
    onShare?.(entry);
  }

  return (
    <IonCard
      className={full ? 'app-news-card app-news-card--detail' : 'app-news-card'}
      button={isButton}
      onClick={onOpen ? () => onOpen(entry) : undefined}
    >
      {canShare && (
        <IonFab vertical="top" horizontal="end">
          <IonFabButton size="small" aria-label={t('news.share')} onClick={share}>
            <IonIcon icon={shareIcon} size="small" aria-hidden="true" />
          </IonFabButton>
        </IonFab>
      )}
      {entry.image_url && <img src={entry.image_url} alt={entry.title} loading="lazy" />}
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
      {article !== '' ? (
        <IonCardContent
          className="app-news-card__article"
          // Der einzige Weg für fremdes HTML ins DOM – und er führt durch
          // `sanitizeNewsHtml`. Kein anderer Aufruf setzt `__html`.
          dangerouslySetInnerHTML={{ __html: article }}
        />
      ) : (
        entry.body && (
          <IonCardContent className={full ? 'app-news-card__body' : 'app-news-card__lead'}>
            {entry.body}
          </IonCardContent>
        )
      )}
      <div className="app-news-card__footer">
        <IonChip>
          {entry.author_image_url ? (
            <IonAvatar aria-hidden="true">
              <img src={entry.author_image_url} alt="" />
            </IonAvatar>
          ) : (
            <IonIcon icon={personCircleOutline} aria-hidden="true" />
          )}
          <IonLabel>{entry.author ?? fallbackAuthor}</IonLabel>
        </IonChip>
        {showSourceLink && (
          /* Ein Beitrag vor dem nächsten Abgleich hat noch keinen Volltext –
             der Anriss endet mit «[…]», und hier geht es weiter. */
          <IonButton
            fill="clear"
            size="small"
            href={entry.external_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('news.readOnWebsite')}
            <IonIcon slot="end" icon={openOutline} aria-hidden="true" />
          </IonButton>
        )}
      </div>
    </IonCard>
  );
}
