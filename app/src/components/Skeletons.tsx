import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSkeletonText,
} from '@ionic/react';

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
