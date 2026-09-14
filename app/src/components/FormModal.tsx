import { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { InlineError } from './StateViews';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { useDiscardGuard } from '../hooks/useDiscardGuard';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  /** Beschriftung der Bestätigung; Standard ist «Speichern». */
  submitLabel?: string;
  /** Deaktiviert die Bestätigung, solange Pflichtfelder fehlen. */
  canSubmit?: boolean;
  isSubmitting?: boolean;
  /** Fehlermeldung des letzten Versuchs; wird über den Feldern angezeigt. */
  error?: string | null;
  /**
   * Die Bestätigung rechts. Fehlt sie, zeigt das Blatt nur an: Dann steht
   * «Schliessen» einmal links, und rechts steht nichts (guidelines.md §2).
   */
  onSubmit?: () => void;
  /**
   * Wo die Bestätigung steht. `toolbar` (Standard): rechts in der Kopfzeile,
   * für ein Wort wie «Speichern» oder «Erstellen». `content`: als Block-Knopf
   * am Ende des Inhalts – für eine Beschriftung, die in der Kopfzeile
   * umbricht («Absage senden», «Envoyer le refus»), und wenn der Knopf erst
   * nach dem letzten Hinweis kommen soll, den die Person gelesen haben sollte.
   */
  submitPlacement?: 'toolbar' | 'content';
  onDismiss: () => void;
  children: ReactNode;
}

/**
 * Formular als Blatt über der Seite – das iOS-Muster für «etwas erfassen».
 *
 * Abbrechen links, Bestätigen rechts: dieselbe Anordnung wie in den
 * Systemdialogen, damit der Daumen sie nicht suchen muss. Der Fehler des
 * letzten Versuchs steht im Formular und nicht in einem Toast, weil er sich
 * auf ein Feld bezieht, das die Person gerade korrigieren soll.
 *
 * Die Kopfzeile trägt ein Wort. Braucht die Bestätigung mehr – «Absage
 * senden» –, bricht sie dort um und drängt den Titel zusammen; dann steht sie
 * mit `submitPlacement="content"` als Block-Knopf am Ende des Inhalts, wo ein
 * Knopf, der etwas tut, ohnehin stehen darf (guidelines.md §2). Abbrechen
 * bleibt links in der Kopfzeile, rechts steht dann nichts.
 *
 * Ohne `onSubmit` ist es ein Blatt, das **anzeigt** – ein Detail, eine Liste,
 * eine Erklärung, allenfalls mit Knöpfen im Inhalt, die etwas tun. Dann trägt
 * die Kopfzeile genau einen Knopf, «Schliessen», an der Stelle von Abbrechen.
 * Ein «Schliessen» rechts neben einem «Abbrechen» links wären zwei Wege für
 * dieselbe Handlung.
 *
 * Ein beschriebenes Blatt wirft seinen Entwurf nicht mehr wortlos weg: Der
 * erste Tastendruck im Formular schaltet den Wächter aus `useDiscardGuard`
 * scharf, und jeder Weg, der den Entwurf verliert – Wischgeste, Griff daneben,
 * Abbrechen –, fragt danach über ein `IonActionSheet` nach (guidelines.md §2).
 * Nur das Schliessen nach dem Speichern läuft durch.
 *
 * Welche Felder das Formular mitbringt, muss die Hülle dafür nicht wissen –
 * sie hört auf die `ionInput`- und `ionChange`-Ereignisse, die jedes
 * Ionic-Bedienelement bei einer **Benutzereingabe** auslöst. Ein vorausgefülltes
 * Feld löst keines aus, ein Blatt ohne Eingabefelder auch nicht; beide
 * schliessen weiterhin ohne Rückfrage.
 */
export function FormModal({
  isOpen,
  title,
  submitLabel,
  canSubmit = true,
  isSubmitting = false,
  error,
  onSubmit,
  submitPlacement = 'toolbar',
  onDismiss,
  children,
}: FormModalProps) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  const guard = useDiscardGuard(isOpen);
  const modal = useRef<HTMLIonModalElement>(null);
  // Das Blatt ist ein `role="dialog"`; Ionic verlangt, dass es beschriftet
  // wird. Der Titel in der Kopfzeile ist die Beschriftung.
  const titleId = useId();

  useEffect(() => {
    const element = modal.current;
    if (!element) return;

    // `ionInput` und `ionChange` sind zusammengesetzte Ereignisse und steigen
    // aus jedem Feld bis zum Blatt auf; ein Zuhörer genügt für das ganze
    // Formular. React kennt die beiden Namen nicht, deshalb von Hand.
    element.addEventListener('ionInput', guard.markTouched);
    element.addEventListener('ionChange', guard.markTouched);
    return () => {
      element.removeEventListener('ionInput', guard.markTouched);
      element.removeEventListener('ionChange', guard.markTouched);
    };
  }, [guard.markTouched]);

  /**
   * Abbrechen geht über Ionic und nicht direkt an `onDismiss`: Nur so läuft
   * der Knopf durch denselben Wächter wie die Wischgeste – der Entwurf ist
   * hier so endgültig weg wie dort. Ionic meldet danach `onDidDismiss`, und
   * die Seite schliesst das Blatt wie sonst auch.
   */
  const requestDismiss = () => {
    // Ohne geladenes Ionic – in jsdom – gibt es kein `dismiss`; dann bleibt der
    // gerade Weg, damit der Knopf nirgends tot ist.
    if (modal.current?.dismiss) void modal.current.dismiss(undefined, 'cancel');
    else onDismiss();
  };

  const submitContent = isSubmitting ? (
    <IonSpinner name="crescent" />
  ) : (
    (submitLabel ?? t('common.save'))
  );

  return (
    <>
      <IonModal
        ref={modal}
        isOpen={isOpen}
        onDidDismiss={onDismiss}
        presentingElement={presentingElement}
        canDismiss={guard.canDismiss}
        aria-labelledby={titleId}
      >
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={requestDismiss}>
                {onSubmit ? t('common.cancel') : t('common.close')}
              </IonButton>
            </IonButtons>
            <IonTitle id={titleId} role="heading" aria-level={2}>
              {title}
            </IonTitle>
            {onSubmit && submitPlacement === 'toolbar' && (
              <IonButtons slot="end">
                <IonButton
                  strong
                  disabled={!canSubmit || isSubmitting}
                  onClick={onSubmit}
                >
                  {submitContent}
                </IonButton>
              </IonButtons>
            )}
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {error && <InlineError message={error} />}
          {children}
          {onSubmit && submitPlacement === 'content' && (
            <div className="app-actions">
              <IonButton
                expand="block"
                disabled={!canSubmit || isSubmitting}
                onClick={onSubmit}
              >
                {submitContent}
              </IonButton>
            </div>
          )}
        </IonContent>
      </IonModal>

      {/* Neben dem Blatt, nicht darin: Ein Overlay im Blatt ginge mit ihm
          unter, bevor jemand geantwortet hat. */}
      <IonActionSheet
        isOpen={guard.isAsking}
        onDidDismiss={() => guard.answer(false)}
        header={t('common.discardTitle')}
        buttons={[
          {
            text: t('common.discardChanges'),
            role: 'destructive',
            handler: () => guard.answer(true),
          },
          { text: t('common.keepEditing'), role: 'cancel' },
        ]}
      />
    </>
  );
}
