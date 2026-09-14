import type { MouseEvent } from 'react';

/**
 * Die Wischleiste fährt nach der Wahl von selbst zu, wie in der alten App.
 *
 * Ionic lässt sie sonst offen stehen: Die Zeile bliebe verschoben, während
 * die Antwort schon unterwegs ist. Steht hier und nicht in der Ansicht,
 * damit Agenda und Schichtenblatt dieselbe Geste gleich beenden.
 */
export function closeSliding(event: MouseEvent) {
  const sliding = (event.currentTarget as HTMLElement).closest('ion-item-sliding');
  void (sliding as HTMLIonItemSlidingElement | null)?.close();
}
