import { useMemo, useState } from 'react';
import {
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useTeams } from '../hooks/useInvites';
import { usePointRules } from '../hooks/useGamification';
import { useAnnounceEvent, useCreateEvent } from '../hooks/useEvents';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import {
  MAX_SERIES_EVENTS,
  SERIES_RHYTHMS,
  durationInMinutes,
  expandSeries,
  requiresWhy,
  suggestedRuleCode,
  validateEventDraft,
  type SeriesRhythm,
} from '../lib/eventSeries';
import { formatDateTime } from '../lib/format';
import type { EventType } from '../lib/database.types';

/**
 * Reihenfolge wie im check-Constraint auf `events.type`, **ohne** `helper`.
 *
 * Ein Helferaufruf braucht Schichten und sein Warum (UC-011, BR-041, BR-043).
 * Stünde er hier zur Auswahl, entstünde über diesen Weg ein sofort
 * ausgeschriebenes Helfer-Event ohne eine einzige Schicht – ein Aufruf, dem
 * niemand folgen kann. Er hat sein eigenes Formular.
 */
const EVENT_TYPES: EventType[] = [
  'training',
  'match',
  'cup',
  'tournament',
  'gv',
  'social',
];

interface EventFormProps {
  onDone: () => void;
  onDismiss: () => void;
}

/**
 * Termin erfassen (UC-009).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md). Die Prüfung des Entwurfs liegt in
 * `validateEventDraft()` – auch das, damit sie prüfbar bleibt.
 */
export function EventForm({ onDone, onDismiss }: EventFormProps) {
  const { t } = useTranslation();
  const { eventLabel } = useClub();
  const teams = useTeams();
  const rules = usePointRules();
  const createEvent = useCreateEvent();
  const announce = useAnnounceEvent();

  const [type, setType] = useState<EventType>('training');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [why, setWhy] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [ruleCode, setRuleCode] = useState<string | null>(null);
  const [ruleTouched, setRuleTouched] = useState(false);

  const [isSeries, setSeries] = useState(false);
  const [rhythm, setRhythm] = useState<SeriesRhythm>('weekly');
  const [until, setUntil] = useState('');

  const availableCodes = useMemo(
    () => (rules.data ?? []).map((rule) => rule.code),
    [rules.data],
  );

  // Schritt 6: Der Vorschlag folgt dem Termintyp, solange niemand selbst
  // gewählt hat. Danach bleibt die Wahl stehen (Schritt 7).
  const effectiveRuleCode = ruleTouched
    ? ruleCode
    : suggestedRuleCode(type, availableCodes);

  const draft = { type, title, startsAt, endsAt, location, why, teamId, pointRuleCode: effectiveRuleCode };
  const problems = validateEventDraft(draft);

  const seriesRule = useMemo(
    () =>
      isSeries && startsAt && until
        ? {
            rhythm,
            startsAt,
            until,
            durationMinutes: durationInMinutes(startsAt, endsAt),
          }
        : null,
    [isSeries, rhythm, startsAt, until, endsAt],
  );

  // A1 Schritt 2: die Vorschau der zu erzeugenden Termine.
  const preview = useMemo(
    () => (seriesRule ? expandSeries(seriesRule) : []),
    [seriesRule],
  );

  const canSubmit =
    problems.length === 0 && (!isSeries || preview.length > 0);

  function submit() {
    createEvent.mutate(
      {
        type,
        title,
        startsAt,
        endsAt: endsAt || null,
        location: location || null,
        why: why || null,
        teamId,
        pointRuleCode: effectiveRuleCode,
        series: seriesRule ?? undefined,
      },
      {
        onSuccess: (events) => {
          // Schritt 10: Bei einer Serie wird einmal angekündigt, nicht
          // sechzigmal – sonst wäre die Inbox unbrauchbar.
          const first = events[0];
          if (first) announce.mutate(first.id);
          onDone();
        },
      },
    );
  }

  return (
    <FormModal
      isOpen
      title={t('eventForm.title')}
      submitLabel={t('eventForm.create')}
      canSubmit={canSubmit}
      isSubmitting={createEvent.isPending}
      error={createEvent.error ? (createEvent.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={submit}
    >
      <ListSection>
        <IonItem>
          <IonSelect
            label={t('eventForm.type')}
            value={type}
            onIonChange={(e) => setType(e.detail.value as EventType)}
          >
            {EVENT_TYPES.map((entry) => (
              <IonSelectOption key={entry} value={entry}>
                {/* Schritt 2: die Termintypen in der Sprache des Vereins. */}
                {eventLabel(entry)}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>

        <IonItem>
          <IonInput
            label={t('eventForm.eventTitle')}
            labelPlacement="stacked"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>

        <IonItem>
          <IonInput
            type="datetime-local"
            label={t('eventForm.startsAt')}
            labelPlacement="stacked"
            value={startsAt}
            onIonInput={(e) => setStartsAt(e.detail.value ?? '')}
          />
        </IonItem>

        <IonItem>
          <IonInput
            type="datetime-local"
            label={t('eventForm.endsAt')}
            labelPlacement="stacked"
            value={endsAt}
            onIonInput={(e) => setEndsAt(e.detail.value ?? '')}
          />
        </IonItem>

        <IonItem>
          <IonInput
            label={t('eventForm.location')}
            labelPlacement="stacked"
            value={location}
            onIonInput={(e) => setLocation(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {problems.includes('endBeforeStart') && (
        <IonNote color="danger" className="app-hint">
          {t('eventForm.endBeforeStart')}
        </IonNote>
      )}

      {/* BR-036: Aufrufe tragen ihren Sinnzusammenhang. */}
      {requiresWhy(type) && (
        <ListSection footnote={t('eventForm.whyHint')}>
          <IonItem>
            <IonInput
              label={t('eventForm.why')}
              labelPlacement="stacked"
              value={why}
              onIonInput={(e) => setWhy(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {/* Schritt 5: Team oder Vereinstermin. */}
      <ListSection footnote={t('eventForm.scopeHint')}>
        <IonItem>
          <IonSelect
            label={t('invite.scope')}
            value={teamId}
            onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
          >
            <IonSelectOption value={null}>{t('eventForm.wholeClub')}</IonSelectOption>
            {(teams.data ?? []).map((team) => (
              <IonSelectOption key={team.id} value={team.id}>
                {team.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* Schritt 6 und 7: Punkteregel vorgeschlagen, aber änderbar. */}
      <ListSection footnote={t('eventForm.ruleHint')}>
        <IonItem>
          <IonSelect
            label={t('eventForm.rule')}
            value={effectiveRuleCode}
            onIonChange={(e) => {
              setRuleTouched(true);
              setRuleCode((e.detail.value as string | null) ?? null);
            }}
          >
            <IonSelectOption value={null}>{t('eventForm.noRule')}</IonSelectOption>
            {(rules.data ?? []).map((rule) => (
              <IonSelectOption key={rule.id} value={rule.code}>
                {rule.label} (+{rule.points})
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* A1: Terminserie */}
      <ListSection footnote={t('eventForm.seriesHint')}>
        <IonItem>
          <IonToggle checked={isSeries} onIonChange={(e) => setSeries(e.detail.checked)}>
            {t('eventForm.repeats')}
          </IonToggle>
        </IonItem>

        {isSeries && (
          <>
            <IonItem>
              <IonSelect
                label={t('eventForm.rhythm')}
                value={rhythm}
                onIonChange={(e) => setRhythm(e.detail.value as SeriesRhythm)}
              >
                {SERIES_RHYTHMS.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`eventForm.rhythmValue.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonInput
                type="date"
                label={t('eventForm.until')}
                labelPlacement="stacked"
                value={until}
                onIonInput={(e) => setUntil(e.detail.value ?? '')}
              />
            </IonItem>
          </>
        )}
      </ListSection>

      {/* A1 Schritt 2: Vorschau, bevor sechzig Termine entstehen. */}
      {isSeries && preview.length > 0 && (
        <ListSection
          title={t('eventForm.previewTitle', { count: preview.length })}
          footnote={
            preview.length >= MAX_SERIES_EVENTS
              ? t('eventForm.previewCapped', { max: MAX_SERIES_EVENTS })
              : undefined
          }
        >
          {preview.slice(0, 5).map((occurrence) => (
            <IonItem key={occurrence.startsAt}>
              <IonLabel>{formatDateTime(occurrence.startsAt)}</IonLabel>
            </IonItem>
          ))}
          {preview.length > 5 && (
            <IonItem lines="none">
              <IonNote>
                {t('eventForm.previewMore', { count: preview.length - 5 })}
              </IonNote>
            </IonItem>
          )}
        </ListSection>
      )}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht erst beim Öffnen. */
export function EventFormModal({
  isOpen,
  onDone,
  onDismiss,
}: {
  isOpen: boolean;
  onDone: () => void;
  onDismiss: () => void;
}) {
  if (!isOpen) return null;
  return <EventForm onDone={onDone} onDismiss={onDismiss} />;
}
