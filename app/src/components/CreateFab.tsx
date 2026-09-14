import { IonFab, IonFabButton, IonFabList, IonIcon } from '@ionic/react';
import { add } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';

export interface CreateAction {
  /**
   * Symbol der Aktion, sobald mehrere nebeneinander stehen. Die Hauptaktion
   * trägt immer das Plus – dieses Symbol erscheint erst in der aufgeklappten
   * Liste, wo es die Aktionen voneinander unterscheidet.
   */
  icon: string;
  /** Übersetzter Name; er beschriftet den Knopf für Bedienhilfen und Tests. */
  label: string;
  onClick: () => void;
}

interface CreateFabProps {
  actions: CreateAction[];
}

/**
 * Der Erstellen-Knopf einer Seite: rund, in der Vereinsfarbe, unten rechts
 * über dem Inhalt.
 *
 * Neues entsteht überall in der App an derselben Stelle und mit demselben
 * Zeichen – ein Plus unten rechts, in Daumenreichweite. Ein Symbol in der
 * Kopfzeile wäre am oberen Bildschirmrand, wechselte je Seite die Bedeutung
 * (Stift, Plus, Leute) und stünde gleichrangig neben Nebensächlichem.
 *
 * Eingehängt wird der Knopf nicht von der Seite selbst, sondern über
 * `AppPage`s `createActions` – nur dort landet er als direktes Kind des
 * `IonContent` und damit im `fixed`-Slot, der ihn beim Scrollen stehen lässt.
 *
 * Mehrere Erstellen-Wege einer Seite klappen aus demselben Plus nach oben
 * auf (`IonFabList`), statt sich die Kopfzeile zu teilen.
 */
export function CreateFab({ actions }: CreateFabProps) {
  const { t } = useTranslation();

  if (actions.length === 0) return null;

  // Ein einzelner Weg braucht kein Aufklappen: Das Plus löst ihn direkt aus
  // und trägt dessen Namen.
  const single = actions.length === 1 ? actions[0] : null;

  return (
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton
        color="primary"
        aria-label={single ? single.label : t('common.create')}
        onClick={single ? single.onClick : undefined}
      >
        <IonIcon icon={add} aria-hidden="true" />
      </IonFabButton>
      {!single && (
        <IonFabList side="top">
          {actions.map((action) => (
            <IonFabButton
              key={action.label}
              color="primary"
              aria-label={action.label}
              onClick={action.onClick}
            >
              <IonIcon icon={action.icon} aria-hidden="true" />
            </IonFabButton>
          ))}
        </IonFabList>
      )}
    </IonFab>
  );
}
