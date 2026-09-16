import { IonLabel, IonSegment, IonSegmentButton } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { NEWS_ORIGINS, type NewsOrigin } from '../lib/news';

interface NewsOriginSegmentProps {
  value: NewsOrigin;
  onChange: (origin: NewsOrigin) => void;
  /** Zahl der Beiträge je Herkunft, aus `useNewsOrigins()`. */
  counts: Record<Exclude<NewsOrigin, 'all'>, number> | undefined;
  /** In der zweiten Kopfzeile der News-Seite – dort trägt `AppPage` den Rand. */
  inToolbar?: boolean;
}

/**
 * Die Wahl der Herkunft über dem Feed – auf der Startseite wie auf der
 * News-Seite dieselbe Leiste, damit «Verband» an beiden Orten dasselbe heisst.
 *
 * **Sie zeigt nur, was es gibt.** Ein Verein, der ausschliesslich selbst
 * schreibt, sieht gar keine Leiste; einer mit Website und Verband sieht drei
 * Knöpfe statt vier. Eine Wahl, die zu einer garantiert leeren Liste führt,
 * ist keine Wahl, sondern eine Sackgasse – dasselbe Muster wie das
 * Saison-Segment in `PointHistoryPage`, das erst ab der zweiten Saison steht.
 *
 * Solange die Zahlen noch nicht da sind, steht hier nichts: Eine Leiste, die
 * eine Zeile später um einen Knopf wächst, verschöbe den Feed unter dem
 * Daumen.
 */
export function NewsOriginSegment({
  value,
  onChange,
  counts,
  inToolbar = false,
}: NewsOriginSegmentProps) {
  const { t } = useTranslation();
  const available = counts ? NEWS_ORIGINS.filter((entry) => counts[entry] > 0) : [];

  if (available.length < 2) return null;

  return (
    <IonSegment
      className={inToolbar ? undefined : 'app-news-origin'}
      value={value}
      onIonChange={(e) => onChange(e.detail.value as NewsOrigin)}
    >
      <IonSegmentButton value="all">
        <IonLabel>{t('news.origin.all')}</IonLabel>
      </IonSegmentButton>
      {available.map((entry) => (
        <IonSegmentButton key={entry} value={entry}>
          <IonLabel>{t(`news.origin.${entry}`)}</IonLabel>
        </IonSegmentButton>
      ))}
    </IonSegment>
  );
}
