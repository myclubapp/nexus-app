import type { ReactNode } from 'react';
import { IonLabel, IonList, IonListHeader, IonNote } from '@ionic/react';

interface ListSectionProps {
  /** Überschrift der Gruppe. Ohne Titel entfällt der `IonListHeader`. */
  title?: string;
  /** Aktion rechts in der Überschrift, üblicherweise ein `IonButton`. */
  action?: ReactNode;
  /** Erklärender Text unter der Liste, wie in den iOS-Einstellungen. */
  footnote?: string;
  /** Gruppierte Liste mit abgerundeten Ecken (iOS-Standard). */
  inset?: boolean;
  children: ReactNode;
}

/**
 * Gruppierter Listenabschnitt – das Grundmuster jeder Ansicht.
 *
 * `IonListHeader` und `IonList inset` sind die Ionic-Entsprechung der
 * gruppierten iOS-Tabellenansicht; die abgerundeten Ecken kommen im
 * iOS-Modus von `inset` selbst, nicht aus eigenem CSS.
 */
export function ListSection({
  title,
  action,
  footnote,
  inset = true,
  children,
}: ListSectionProps) {
  return (
    <>
      {title && (
        <IonListHeader>
          <IonLabel>{title}</IonLabel>
          {action}
        </IonListHeader>
      )}
      <IonList inset={inset}>{children}</IonList>
      {footnote && (
        <IonNote className="app-footnote">{footnote}</IonNote>
      )}
    </>
  );
}
