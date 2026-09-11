import { useState } from 'react';
import {
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useBookPoints, useReversePoints } from '../hooks/useGamification';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { formatDateTime } from '../lib/format';
import { canCorrect, validateManualBooking } from '../lib/points';
import { PILLARS, type Pillar } from '../lib/pointRule';
import type { PointTransaction } from '../lib/database.types';

export interface BookableMember {
  id: string;
  displayName: string;
}

interface BookPointsProps {
  /** Auswahl für die Buchung; die vorausgewählten Ids stehen in `preselected`. */
  members: readonly BookableMember[];
  preselected?: readonly string[];
  /** Ist gesetzt, wird korrigiert statt gebucht (A1). */
  correcting?: PointTransaction | null;
  correctingLabel?: string;
  onDone: (count: number, corrected: boolean) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Punkte von Hand buchen und Buchungen ausgleichen (UC-021).
 *
 * **Ein** Blatt für beide Wege: Sie teilen das Wesentliche – die Notiz, die
 * jede Buchung von Hand tragen muss (BR-086). Zwei Bauteile hiessen zwei
 * Stellen, an denen diese Pflicht steht.
 *
 * «Korrigieren» ändert nichts: Die ursprüngliche Buchung bleibt stehen,
 * daneben entsteht eine Gegenbuchung (BR-085). Das Blatt sagt das auch.
 */
export function BookPoints({
  members,
  preselected = [],
  correcting = null,
  correctingLabel,
  onDone,
  onDismiss,
  isOpen = true,
}: BookPointsProps) {
  const { t } = useTranslation();
  const book = useBookPoints();
  const reverse = useReversePoints();

  const [memberIds, setMemberIds] = useState<string[]>([...preselected]);
  const [pillar, setPillar] = useState<Pillar>(7);
  const [points, setPoints] = useState(10);
  const [note, setNote] = useState('');

  const isCorrection = correcting !== null;
  const problems = isCorrection
    ? []
    : validateManualBooking({ memberIds, points, note });
  const canSubmit = isCorrection ? canCorrect(note) : problems.length === 0;

  const isBusy = book.isPending || reverse.isPending;
  const error =
    (book.error as Error | null)?.message ??
    (reverse.error as Error | null)?.message ??
    null;

  function submit() {
    if (isCorrection) {
      reverse.mutate(
        { transactionId: correcting.id, note },
        { onSuccess: () => onDone(1, true) },
      );
      return;
    }
    book.mutate(
      { memberIds, pillar, points, note },
      { onSuccess: (count) => onDone(count, false) },
    );
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={isCorrection ? t('bookPoints.correctTitle') : t('bookPoints.title')}
      submitLabel={isCorrection ? t('bookPoints.correct') : t('bookPoints.book')}
      canSubmit={canSubmit && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={submit}
    >
      {isCorrection ? (
        /* A1: Was ausgeglichen wird, und mit welchem Wert. */
        <ListSection title={t('bookPoints.original')} footnote={t('bookPoints.ledgerHint')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <h2>{correctingLabel}</h2>
              <IonNote>{formatDateTime(correcting.created_at)}</IonNote>
            </IonLabel>
            <IonNote slot="end">{correcting.points}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>{t('bookPoints.counterBooking')}</IonLabel>
            <IonNote slot="end" color="danger">
              {-correcting.points}
            </IonNote>
          </IonItem>
        </ListSection>
      ) : (
        <>
          {/* A3: derselbe Wert und dieselbe Notiz für mehrere Personen. */}
          <ListSection title={t('bookPoints.who')} footnote={t('bookPoints.whoHint')}>
            <IonItem>
              <IonSelect
                multiple
                label={t('bookPoints.members')}
                labelPlacement="stacked"
                value={memberIds}
                onIonChange={(e) => setMemberIds((e.detail.value as string[]) ?? [])}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {members.map((member) => (
                  <IonSelectOption key={member.id} value={member.id}>
                    {member.displayName}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          <ListSection title={t('bookPoints.what')} footnote={t('bookPoints.pointsHint')}>
            <IonItem>
              <IonSelect
                label={t('bookPoints.pillar')}
                labelPlacement="stacked"
                value={pillar}
                onIonChange={(e) => setPillar(e.detail.value as Pillar)}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {PILLARS.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`pointRules.pillar.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonInput
                type="number"
                inputmode="numeric"
                min={1}
                label={t('bookPoints.points')}
                labelPlacement="stacked"
                value={String(points)}
                onIonInput={(e) => setPoints(Number(e.detail.value ?? '0'))}
              />
            </IonItem>
          </ListSection>
        </>
      )}

      {/* BR-086: Der Anlass ist Pflicht – deshalb ein eigener Abschnitt. */}
      <ListSection
        title={isCorrection ? t('bookPoints.reason') : t('bookPoints.noteTitle')}
        footnote={t('bookPoints.noteHint')}
      >
        <IonItem>
          <IonTextarea
            label={isCorrection ? t('bookPoints.reason') : t('bookPoints.note')}
            labelPlacement="stacked"
            autoGrow
            value={note}
            onIonInput={(e) => setNote(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {isCorrection && !canCorrect(note) && (
        <InlineError message={t('bookPoints.problem.reasonMissing')} />
      )}
      {problems.map((problem) => (
        <InlineError key={problem} message={t(`bookPoints.problem.${problem}`)} />
      ))}
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function BookPointsModal({
  isOpen,
  ...props
}: BookPointsProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <BookPoints {...sheet} />;
}
