import { useId } from 'react';
import { IonDatetime, IonDatetimeButton, IonItem, IonLabel, IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { fromPickerValue, toPickerValue, type DatePresentation } from '../lib/dateInput';

interface DateFieldProps {
  label: string;
  /** Der Wert im Format des Formulars: `YYYY-MM-DD`, `YYYY-MM-DDTHH:mm` oder `HH:mm`. */
  value: string;
  onChange: (value: string) => void;
  presentation: DatePresentation;
  /** Untere Grenze im selben Format, etwa «nicht vor dem Beginn». */
  min?: string;
  /** Ein Feld, das leer bleiben darf, zeigt «Löschen». */
  clearable?: boolean;
}

/**
 * Datum, Uhrzeit oder beides – über `IonDatetime`, nicht über ein rohes
 * `<input type="date">` (S4 der Prüfung vom 2026-09-11).
 *
 * Die rohen Felder sahen auf jeder Plattform anders aus und verhielten sich
 * anders; `datetime-local` steht als Fallstrick in CLAUDE.md. Ionic hat
 * `ion-datetime` genau dafür gebaut: dieselbe Auswahl auf iOS, Android und im
 * Browser, mit der Sprache der App statt der des Geräts (guidelines §2, §8).
 *
 * Das Muster ist das der Ionic-Dokumentation: ein `IonDatetimeButton` in der
 * Zeile, das Blatt dahinter bleibt eingehängt (`keepContentsMounted`), damit
 * der Knopf seinen Wert kennt, bevor das Blatt je offen war. Die Formulare
 * behalten ihre Zeichenketten; übersetzt wird in `lib/dateInput.ts`.
 */
export function DateField({
  label,
  value,
  onChange,
  presentation,
  min,
  clearable = false,
}: DateFieldProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const presentingElement = usePresentingElement();

  return (
    <>
      <IonItem>
        <IonLabel>{label}</IonLabel>
        <IonDatetimeButton datetime={id} slot="end" />
      </IonItem>

      <IonModal keepContentsMounted presentingElement={presentingElement}>
        <IonDatetime
          id={id}
          presentation={presentation}
          value={toPickerValue(value)}
          min={min ? toPickerValue(min) : undefined}
          locale={i18n.resolvedLanguage ?? i18n.language}
          firstDayOfWeek={1}
          minuteValues="0,5,10,15,20,25,30,35,40,45,50,55"
          showDefaultButtons
          showClearButton={clearable}
          doneText={t('common.ok')}
          cancelText={t('common.cancel')}
          clearText={t('common.clear')}
          onIonChange={(event) => onChange(fromPickerValue(event.detail.value, presentation))}
        />
      </IonModal>
    </>
  );
}
