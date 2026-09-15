import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonChip,
  IonCol,
  IonFab,
  IonFabButton,
  IonGrid,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRow,
  IonSkeletonText,
} from '@ionic/react';
import { share as shareIcon } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from './AppPage';

/**
 * Ladeansichten in der Form des erwarteten Inhalts.
 *
 * Ein Spinner sagt «warte», ein Skelett sagt «hier kommen drei Termine» – nur
 * das zweite lässt die Ansicht schon lesen, bevor sie da ist (guidelines §4).
 *
 * Die Breiten stehen als Inline-Style, wie in der Ionic-Dokumentation: Sie
 * zeichnen die Form des erwarteten Textes nach und gehören deshalb an die
 * Stelle, an der man sie liest (die benannte Ausnahme aus guidelines §1).
 */

/** Liste aus `IonItem` mit Titel- und Notizzeile – das häufigste Muster. */
export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <IonList inset>
      {Array.from({ length: rows }, (_, index) => (
        <IonItem key={index}>
          <IonLabel>
            <h2>
              <IonSkeletonText animated style={{ width: '70%' }} />
            </h2>
            <IonNote>
              <IonSkeletonText animated style={{ width: '45%' }} />
            </IonNote>
          </IonLabel>
        </IonItem>
      ))}
    </IonList>
  );
}

/** Kennzahlen-Kacheln, wie sie das Dashboard über dem Inhalt zeigt. */
export function SkeletonStats({ cards = 1 }: { cards?: number }) {
  return (
    <div className="app-stat-row">
      {Array.from({ length: cards }, (_, index) => (
        <IonCard key={index} className="app-stat">
          <IonCardContent>
            <IonSkeletonText animated style={{ width: '40%', height: '1.75rem' }} />
            <IonSkeletonText animated style={{ width: '70%' }} />
          </IonCardContent>
        </IonCard>
      ))}
    </div>
  );
}

/** Karte mit Überschrift und Textblock – der News-Feed. */
export function SkeletonCard({ cards = 2 }: { cards?: number }) {
  return (
    <>
      {Array.from({ length: cards }, (_, index) => (
        <IonCard key={index}>
          <IonCardHeader>
            <IonSkeletonText animated style={{ width: '30%' }} />
            <IonSkeletonText animated style={{ width: '80%', height: '1.2rem' }} />
          </IonCardHeader>
          <IonCardContent>
            <IonSkeletonText animated style={{ width: '100%' }} />
            <IonSkeletonText animated style={{ width: '90%' }} />
            <IonSkeletonText animated style={{ width: '60%' }} />
          </IonCardContent>
        </IonCard>
      ))}
    </>
  );
}

/**
 * Ganze Seite in der Form dessen, was danach kommt – das Zwischenbild der
 * Weichen vor der angemeldeten App (`RequireAuth`, `RequireClub`).
 *
 * Bis hierher stand dort ein Vollbild-Spinner auf weissem Grund. Der Weg in
 * die Tabs wartet aber auf einen Netzaufruf (die Mitgliedschaften), und was
 * danach folgt, steht fest: eine Seite mit Kopfzeile und Liste. Genau die
 * zeichnet dieses Skelett nach, damit der Übergang in den Tab kein Bildwechsel
 * mehr ist (guidelines §4).
 *
 * Die Liste ist bewusst der gemeinsame Nenner aller fünf Tabs: Welcher davon
 * gleich erscheint, weiss die Weiche nicht, und Kennzahlen-Kacheln hätte nur
 * das Dashboard.
 *
 * Der Titel bleibt ein Skelett statt eines Platzhalterworts – ein «myclub»,
 * das eine Zehntelsekunde später zu «Start» wird, ist eine Ankündigung, die
 * sich selbst widerruft. Die Ansage für Bedienhilfen übernimmt das
 * `role="status"` mit `aria-label`, weil ein Skelett keinen Text hat.
 */
export function SkeletonPage({
  rows = 4,
  detached = false,
}: {
  rows?: number;
  /**
   * Für Zwischenbilder einer Weiche, die im selben Route-Element stehen wie
   * die Seite danach – siehe `DetachedPage`.
   */
  detached?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <AppPage
      detached={detached}
      title={<IonSkeletonText animated style={{ width: '35%' }} />}
      largeTitle={<IonSkeletonText animated style={{ width: '55%' }} />}
    >
      <div role="status" aria-label={t('common.loading')}>
        <SkeletonList rows={rows} />
      </div>
    </AppPage>
  );
}

/**
 * News-Karten in ihrer Form – Bild, Datum, Titel, drei Textzeilen und der
 * Autoren-Chip – im selben Raster wie die echten Karten.
 */
export function SkeletonNewsCards({ cards = 2 }: { cards?: number }) {
  return (
    <IonGrid className="app-news-grid">
      <IonRow>
        {Array.from({ length: cards }, (_, index) => (
          <IonCol key={index} size="12" sizeSm="6" sizeMd="6" sizeLg="4">
            <IonCard className="app-news-card">
              {/* Platzhalter für das Teilen oben rechts – die Karte springt
                  beim Laden nicht. */}
              <IonFab vertical="top" horizontal="end">
                <IonFabButton size="small" disabled>
                  <IonIcon icon={shareIcon} size="small" />
                </IonFabButton>
              </IonFab>
              <IonSkeletonText animated className="app-news-card__image-skeleton" />
              <IonCardHeader>
                <IonSkeletonText animated style={{ width: '40%' }} />
                <IonSkeletonText animated style={{ width: '80%', height: '1.2rem' }} />
              </IonCardHeader>
              <IonCardContent>
                <IonSkeletonText animated style={{ width: '90%' }} />
                <IonSkeletonText animated style={{ width: '80%' }} />
                <IonSkeletonText animated style={{ width: '85%' }} />
              </IonCardContent>
              <div className="app-news-card__footer">
                <IonChip>
                  <IonSkeletonText animated style={{ width: '60px' }} />
                </IonChip>
              </div>
            </IonCard>
          </IonCol>
        ))}
      </IonRow>
    </IonGrid>
  );
}
