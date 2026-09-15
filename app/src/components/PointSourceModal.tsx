import { useId, useRef } from 'react';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { checkmark } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { usePresentingElement } from '../hooks/usePresentingElement';
import { ListSection } from './ListSection';
import {
  ALL_POINTS,
  sourceGroups,
  sourceKey,
  type ClubPillar,
  type PointSource,
} from '../lib/leaderboard';

interface SourceChipProps {
  label: string;
  ariaLabel?: string;
  selected: boolean;
  onSelect: () => void;
}

function SourceChip({ label, ariaLabel, selected, onSelect }: SourceChipProps) {
  return (
    <IonChip
      role="radio"
      aria-checked={selected ? 'true' : 'false'}
      aria-label={ariaLabel}
      color={selected ? 'primary' : 'medium'}
      outline={!selected}
      onClick={onSelect}
    >
      {selected && <IonIcon icon={checkmark} aria-hidden="true" />}
      {label}
    </IonChip>
  );
}

interface PointSourceFieldsProps {
  value: PointSource;
  /** Die Säulen dieses Vereins mit ihrer Dimension (`club_pillars`, `0092`). */
  pillars: readonly ClubPillar[];
  onChange: (next: PointSource) => void;
}

/**
 * Die Auswahl selbst: je Wertdimension eine Gruppe, darin ihre Säulen.
 *
 * Die Gruppen tragen die Namen aus «Meine Stärken» – damit steht die
 * Zugehörigkeit beim Auswählen da, statt nur im Erklärtext des Netzdiagramms.
 * Die Säule bleibt einzeln wählbar: FR-048 meint die Helferpunkte aus Säule 3,
 * und «Ehrenamt» enthält zusätzlich den Marktplatz.
 *
 * Wie im Agenda-Filter heisst nichts gewählt: alles. Ein erneuter Tipp auf die
 * geltende Wahl hebt sie auf – so kommt man ohne Umweg zurück zur ganzen
 * Rangliste.
 */
export function PointSourceFields({ value, pillars, onChange }: PointSourceFieldsProps) {
  const { t } = useTranslation();
  const groups = sourceGroups(pillars);
  const current = sourceKey(value);

  function choose(next: PointSource) {
    onChange(sourceKey(next) === current ? ALL_POINTS : next);
  }

  return (
    <>
      {groups.map((group) => {
        const title = group.dimension
          ? t(`dimensions.${group.dimension}.title`)
          : t('leaderboard.otherPillars');

        return (
          <ListSection key={group.dimension ?? 'other'} title={title}>
            <div className="app-chip-group" role="radiogroup" aria-label={title}>
              {group.selectable && group.dimension && (
                <SourceChip
                  label={t('leaderboard.wholeDimension')}
                  ariaLabel={t('leaderboard.wholeDimensionAria', { name: title })}
                  selected={current === sourceKey({ kind: 'dimension', dimension: group.dimension })}
                  onSelect={() => choose({ kind: 'dimension', dimension: group.dimension! })}
                />
              )}
              {group.pillars.map((pillar) => (
                <SourceChip
                  key={pillar}
                  label={t(`pointRules.pillar.${pillar}`)}
                  selected={current === sourceKey({ kind: 'pillar', pillar })}
                  onSelect={() => choose({ kind: 'pillar', pillar })}
                />
              ))}
            </div>
          </ListSection>
        );
      })}
    </>
  );
}

interface PointSourceModalProps {
  isOpen: boolean;
  value: PointSource;
  pillars: readonly ClubPillar[];
  onChange: (next: PointSource) => void;
  onDismiss: () => void;
}

/**
 * Das Blatt «Punktequelle» der Rangliste.
 *
 * Eine Einfachauswahl wirkt sofort und schliesst das Blatt – dasselbe
 * Verhalten wie bei einem `IonSelect`, nur mit Überschriften, die ein
 * `IonSelect` nicht kann. Kein `FormModal`: Hier wird nichts gespeichert, und
 * der Entwurfswächter hätte bei einem Filter nichts zu bewachen.
 */
export function PointSourceModal({
  isOpen,
  value,
  pillars,
  onChange,
  onDismiss,
}: PointSourceModalProps) {
  const { t } = useTranslation();
  const presentingElement = usePresentingElement();
  const modal = useRef<HTMLIonModalElement>(null);
  const titleId = useId();

  function dismiss() {
    if (modal.current?.dismiss) void modal.current.dismiss();
    else onDismiss();
  }

  function select(next: PointSource) {
    onChange(next);
    dismiss();
  }

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      presentingElement={presentingElement}
      aria-labelledby={titleId}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={dismiss}>{t('common.close')}</IonButton>
          </IonButtons>
          <IonTitle id={titleId} role="heading" aria-level={2}>
            {t('leaderboard.source')}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton
              disabled={value.kind === 'all'}
              onClick={() => select(ALL_POINTS)}
            >
              {t('common.reset')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent color="light">
        <IonNote className="app-hint">{t('leaderboard.sourceHint')}</IonNote>
        <PointSourceFields value={value} pillars={pillars} onChange={select} />
      </IonContent>
    </IonModal>
  );
}
