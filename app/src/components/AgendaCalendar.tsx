import type { DatetimeHighlight } from '@ionic/core';
import { IonDatetime } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { fromPickerValue } from '../lib/dateInput';
import { DATETIME_DEFAULTS, appLocale } from '../lib/format';

interface AgendaCalendarProps {
  /** Der gewählte Tag, `YYYY-MM-DD`. */
  value: string;
  onChange: (day: string) => void;
  /** Die Tage mit Terminen – gerechnet in `lib/agendaCalendar.ts`. */
  marks: DatetimeHighlight[];
}

/**
 * Die Monatsübersicht der Agenda: ein `IonDatetime` offen in der Seite, nicht
 * hinter einem Knopf. Tage mit Terminen sind eingefärbt (`highlightedDates`,
 * Ionic-Doku «Using Array»); ein Tippen wählt den Tag, dessen Termine darunter
 * stehen. `size="cover"` füllt die Breite wie eine Inset-Liste.
 *
 * Sprache, Wochenstart und Stundenzählung teilen sich alle Wähler der App
 * (`appLocale()`, `DATETIME_DEFAULTS`). Was Ionic selbst beschriftet –
 * «Previous month», «Next month», das Jahr-Menü – lässt sich nicht
 * übersetzen; nur Tage und Monatsnamen folgen `locale`. Bekannte Grenze des
 * Bauteils, die Tagesliste darunter trägt den Inhalt.
 */
export function AgendaCalendar({ value, onChange, marks }: AgendaCalendarProps) {
  const { t } = useTranslation();

  return (
    <div className="app-calendar">
      <IonDatetime
        presentation="date"
        size="cover"
        value={value}
        locale={appLocale()}
        {...DATETIME_DEFAULTS}
        highlightedDates={marks}
        aria-label={t('agenda.calendarLabel')}
        onIonChange={(event) => {
          const day = fromPickerValue(event.detail.value, 'date');
          if (day) onChange(day);
        }}
      />
    </div>
  );
}
