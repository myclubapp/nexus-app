import { useMemo, useState } from 'react';
import { IonBadge, IonCheckbox, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useMembers } from '../hooks/useMembers';
import { useOffices, useSaveOffice } from '../hooks/useOffices';
import { useSheetProps } from '../hooks/useSheetProps';
import { useToast } from '../hooks/useToast';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import {
  parseOfficeMarkdown,
  planOfficeImport,
  type OfficeImportEntry,
  type OfficeImportField,
} from '../lib/officeMarkdown';

/** Die Namen der Angaben – dieselben Wörter wie im Formular, keine zweiten. */
const FIELD_LABEL: Record<OfficeImportField, string> = {
  title: 'offices.titleField',
  why: 'offices.whyLabel',
  duties: 'offices.duties',
  hours: 'offices.hours',
  points: 'offices.points',
  compensation: 'offices.pointsExtra',
  seats: 'offices.seats',
  board: 'offices.board',
  contact: 'offices.contact',
  holders: 'offices.holders',
};

interface OfficeImportProps {
  /** Der Inhalt der gewählten Datei. */
  text: string;
  fileName: string;
  onDone: () => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Eine Ämterbeschreibung einlesen (UC-041 A8, FR-194).
 *
 * Das Blatt steht **zwischen** Datei und Datenbank, und das ist sein ganzer
 * Zweck: Eine Datei aus der Vereinsablage hat unterwegs alles Mögliche
 * erlebt – sie wurde kopiert, umbenannt, von zwei Personen bearbeitet. Wer
 * sie einliest, soll vorher lesen, welches Amt sie trifft und was sie daran
 * ändert, und einzelne Ämter abwählen können.
 *
 * Gespeichert wird über denselben Weg wie aus dem Formular (`save_office()`):
 * Der Server prüft die Vorstandsrolle und die Grenzen, nicht dieses Blatt.
 * Was hier steht, ist die Vorschau – nicht die Erlaubnis.
 */
export function OfficeImportReview({
  text,
  fileName,
  onDone,
  onDismiss,
  isOpen = true,
}: OfficeImportProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const offices = useOffices();
  const members = useMembers();
  const save = useSaveOffice();

  const entries = useMemo(
    () => planOfficeImport(parseOfficeMarkdown(text), offices.data ?? [], members.data ?? []),
    [text, offices.data, members.data],
  );

  // Abgewählt wird von Hand; was nicht übernommen werden **kann**, ist gar
  // nicht erst gewählt.
  const [skipped, setSkipped] = useState<number[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const chosen = entries.filter((entry, index) => entry.importable && !skipped.includes(index));

  /** Was mit einem Eintrag geschieht – in einem Satz, ohne Fachwort. */
  function describe(entry: OfficeImportEntry): string {
    if (!entry.office) return t('offices.markdown.createHint');
    if (entry.changes.length === 0) return t('offices.markdown.unchanged');
    return t('offices.markdown.changes', {
      fields: entry.changes.map((field) => t(FIELD_LABEL[field])).join(', '),
    });
  }

  function toggle(index: number) {
    setSkipped((current) =>
      current.includes(index) ? current.filter((entry) => entry !== index) : [...current, index],
    );
  }

  async function submit() {
    setFailure(null);
    let done = 0;
    try {
      // Nacheinander: `save_office()` schreibt je Amt eine Transaktion, und
      // eine Reihe paralleler Schreibzugriffe machte die Rückmeldung
      // unlesbar, sobald eines davon scheitert.
      for (const entry of chosen) {
        await save.mutateAsync({ id: entry.office?.id ?? null, draft: entry.draft });
        done += 1;
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : t('common.error');
      // Ehrlich bleiben: Was schon geschrieben ist, bleibt geschrieben.
      setFailure(
        done > 0 ? t('offices.markdown.partial', { count: done, error: message }) : message,
      );
      return;
    }
    toast.success(t('offices.markdown.imported', { count: done }));
    onDone();
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t('offices.markdown.reviewTitle')}
      submitLabel={t('offices.markdown.submit', { count: chosen.length })}
      canSubmit={chosen.length > 0 && !save.isPending}
      isSubmitting={save.isPending}
      onDismiss={onDismiss}
      onSubmit={() => void submit()}
    >
      {entries.length === 0 ? (
        <ListSection title={fileName} footnote={t('offices.markdown.emptyHint')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <IonNote>{t('offices.markdown.empty')}</IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      ) : (
        <ListSection title={fileName} footnote={t('offices.markdown.keeps')}>
          {entries.map((entry, index) => (
            <IonItem key={`${entry.title}-${index}`}>
              <IonCheckbox
                checked={entry.importable && !skipped.includes(index)}
                disabled={!entry.importable}
                onIonChange={() => toggle(index)}
              >
                <IonLabel className="ion-text-wrap">
                  <h2>{entry.title}</h2>
                  <p>{describe(entry)}</p>
                  {entry.note && <IonNote>{t(`offices.markdown.note.${entry.note}`)}</IonNote>}
                  {entry.problems.map((problem) => (
                    <IonNote key={problem} color="danger">
                      {t(`offices.problem.${problem}`)}
                    </IonNote>
                  ))}
                  {entry.unknownSections.length > 0 && (
                    <IonNote>
                      {t('offices.markdown.ignored', {
                        sections: entry.unknownSections.join(', '),
                      })}
                    </IonNote>
                  )}
                </IonLabel>
              </IonCheckbox>
              <IonBadge slot="end" color={entry.office ? 'medium' : 'success'}>
                {t(entry.office ? 'offices.markdown.update' : 'offices.markdown.create')}
              </IonBadge>
            </IonItem>
          ))}
        </ListSection>
      )}

      {failure && <InlineError message={failure} />}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function OfficeImportModal({
  file,
  ...props
}: Omit<OfficeImportProps, 'text' | 'fileName'> & {
  file: { text: string; name: string } | null;
}) {
  const sheet = useSheetProps(file ? { text: file.text, fileName: file.name, ...props } : null);
  return sheet && <OfficeImportReview {...sheet} />;
}
