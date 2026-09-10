import { useState } from 'react';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useSaveContributionProfile } from '../hooks/useContribution';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { formatDate } from '../lib/format';
import {
  TASK_CATEGORIES,
  TIME_BUDGETS,
  budgetCap,
  validateProfile,
  type ContributionInterest,
  type ContributionProfile,
  type TimeBudget,
} from '../lib/contribution';

interface ContributionProfileProps {
  profile: ContributionProfile | null;
  onDone: () => void;
  onDismiss: () => void;
}

/**
 * Das Beitrags-Profil erfassen (UC-033, Schritte 1–5).
 *
 * Die Reihenfolge ist die der Spezifikation, und sie ist der Punkt: **Zuerst
 * steht die Frage**, was für diese Person ein sinnvoller Beitrag wäre – dann
 * erst die Kategorien. Umgekehrt wäre es wieder eine Abfrage von Bedarf statt
 * eine Frage nach dem Menschen (BR-142).
 *
 * Speichern ist auch **leer** möglich. Das ist A1 und BR-143: Das Profil ist
 * freiwillig, und «später» muss ein Weg sein, kein Abbruch.
 */
export function ContributionProfileForm({
  profile,
  onDone,
  onDismiss,
}: ContributionProfileProps) {
  const { t } = useTranslation();
  const save = useSaveContributionProfile();

  const [interests, setInterests] = useState<ContributionInterest[]>(
    profile?.interests ?? [],
  );
  const [strengths, setStrengths] = useState(profile?.strengths ?? '');
  const [timeBudget, setTimeBudget] = useState<TimeBudget | null>(
    profile?.timeBudget ?? null,
  );

  const problems = validateProfile({ interests, strengths, timeBudget });

  return (
    <FormModal
      isOpen
      title={t('contribution.title')}
      submitLabel={t('common.save')}
      canSubmit={problems.length === 0 && !save.isPending}
      isSubmitting={save.isPending}
      error={save.error ? (save.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() =>
        save.mutate({ interests, strengths, timeBudget }, { onSuccess: onDone })
      }
    >
      {/* Schritt 3, und er steht zuerst: die Frage nach dem Menschen. */}
      <ListSection title={t('contribution.strengthsTitle')} footnote={t('contribution.strengthsHint')}>
        <IonItem>
          <IonTextarea
            label={t('contribution.strengthsLabel')}
            labelPlacement="stacked"
            autoGrow
            rows={3}
            value={strengths}
            onIonInput={(e) => setStrengths(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* Schritt 2: die Kategorien – dieselbe Liste wie am Marktplatz. */}
      <ListSection title={t('contribution.interestsTitle')} footnote={t('contribution.interestsHint')}>
        <IonItem>
          <IonSelect
            multiple
            label={t('contribution.interestsLabel')}
            labelPlacement="stacked"
            value={interests}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => setInterests(e.detail.value as ContributionInterest[])}
          >
            {TASK_CATEGORIES.map((category) => (
              <IonSelectOption key={category} value={category}>
                {t(`taskCategory.${category}`)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* Schritt 4: das Zeitbudget. Es ist keine Zusage, sondern eine Grenze –
          BR-144 hält sie ein, statt sie einzufordern. */}
      <ListSection
        title={t('contribution.budgetTitle')}
        footnote={
          timeBudget ? t(`contribution.budgetHint.${timeBudget}`) : t('contribution.budgetHintNone')
        }
      >
        <IonItem lines="none">
          <IonSegment
            value={timeBudget ?? ''}
            onIonChange={(e) => setTimeBudget((e.detail.value as TimeBudget) || null)}
          >
            {TIME_BUDGETS.map((budget) => (
              <IonSegmentButton key={budget} value={budget}>
                <IonLabel>{t(`contribution.budget.${budget}`)}</IonLabel>
              </IonSegmentButton>
            ))}
          </IonSegment>
        </IonItem>

        {/* Die Zahl kommt aus `budgetCap()` und nicht aus dem Übersetzungstext:
            Stünde sie dort, liefe sie irgendwann gegen die Zahl in
            `contribution_budget_left()` – und der Satz löge. */}
        {timeBudget && (
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <IonNote>
                {t('contribution.budgetCap', { count: budgetCap(timeBudget) })}
              </IonNote>
            </IonLabel>
          </IonItem>
        )}
      </ListSection>

      {problems.map((problem) => (
        <InlineError key={problem} message={t(`contribution.problem.${problem}`)} />
      ))}

      {/* A2: Wer sein Profil pflegt, soll sehen, wann er es zuletzt getan hat –
          gefragt wird jährlich, und ohne dieses Datum wüsste niemand, wie alt
          die Angaben sind. */}
      {profile?.updatedAt && (
        <IonNote className="app-footnote">
          {t('contribution.updatedAt', { date: formatDate(profile.updatedAt) })}
        </IonNote>
      )}

      {/* BR-143 steht im Blatt, nicht nur in der Spezifikation: Wer nichts
          angibt, verliert nichts. */}
      <IonNote className="app-footnote">{t('contribution.voluntary')}</IonNote>
    </FormModal>
  );
}
