import type { ReactNode } from 'react';
import { IonLabel, IonListHeader, IonText } from '@ionic/react';

interface TextSectionProps {
  /** Überschrift, im selben Stil wie die eines Listenabschnitts. */
  title?: string;
  /** Behält Zeilenumbrüche des Textes (Transkripte, mehrzeilige Antworten). */
  preserveLines?: boolean;
  children: ReactNode;
}

/**
 * Fliesstext neben einer Liste – eine Beschreibung, eine Erklärung, ein
 * Transkript.
 *
 * Die Item-Richtlinien von Ionic wollen kurze Zeilen: «Keep text labels
 * concise … Don't attempt to fit extensive text inline within items.» Ein
 * `IonItem lines="none"` mit einem Absatz darin ist deshalb kein Textfeld,
 * sondern eine Zeile, die ihr Format verloren hat. Dieser Baustein trägt den
 * Text ausserhalb der Liste, mit derselben Überschrift wie `ListSection`,
 * damit beide im selben Raster stehen.
 */
export function TextSection({ title, preserveLines = false, children }: TextSectionProps) {
  return (
    <>
      {title && (
        <IonListHeader>
          <IonLabel>{title}</IonLabel>
        </IonListHeader>
      )}
      <div className={preserveLines ? 'app-text app-text--pre' : 'app-text'}>
        <IonText>{children}</IonText>
      </div>
    </>
  );
}
