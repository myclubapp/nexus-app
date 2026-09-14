import { IonItem, IonLabel } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';

export interface ManageAction {
  label: string;
  onClick: () => void;
  /** Führt in ein anderes Blatt – dann steht der Pfeil rechts. */
  detail?: boolean;
  disabled?: boolean;
  /** Löschen, Auflösen, Zurückziehen: die rote Zeile, immer die letzte. */
  destructive?: boolean;
}

interface ManageSectionProps {
  /** Ohne Einträge entfällt der Abschnitt ganz. */
  actions: readonly (ManageAction | false | null | undefined)[];
  footnote?: string;
}

/**
 * Der Abschnitt «Verwalten» am Ende eines Blattes (guidelines §2).
 *
 * Jede Verwaltungshandlung eines Details – Bearbeiten, Ausschreiben,
 * Erinnern, Löschen – steht hier als Zeile, an derselben Stelle in jedem
 * Blatt: nicht hinter einem Dreipunkt in der Kopfzeile, nicht als Knopf
 * irgendwo im Inhalt. Wer den Abschnitt einmal gefunden hat, findet ihn
 * überall. Die Wischoptionen der Listen bleiben der kurze Weg für die, die
 * ihn kennen; der Abschnitt ist der Weg für Tastatur, Bedienhilfen und Geräte
 * ohne Wischgeste.
 *
 * Die zerstörerische Zeile steht rot und zuletzt. Die Rückfrage davor
 * («Bist du sicher …») stellt das aufrufende Blatt über ein `IonAlert`.
 */
export function ManageSection({ actions, footnote }: ManageSectionProps) {
  const { t } = useTranslation();
  const rows = actions.filter((action): action is ManageAction => Boolean(action));
  if (rows.length === 0) return null;

  // Rot zuletzt, unabhängig davon, in welcher Reihenfolge das Blatt die
  // Zeilen hereinreicht.
  const ordered = [...rows.filter((row) => !row.destructive), ...rows.filter((row) => row.destructive)];

  return (
    <ListSection title={t('common.manage')} footnote={footnote}>
      {ordered.map((row) => (
        <IonItem
          key={row.label}
          button
          detail={row.detail ?? false}
          disabled={row.disabled}
          onClick={row.onClick}
        >
          <IonLabel color={row.destructive ? 'danger' : undefined}>{row.label}</IonLabel>
        </IonItem>
      ))}
    </ListSection>
  );
}
