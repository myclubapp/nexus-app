import { useEffect, useMemo, useState } from 'react';
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
import { parseCapacity } from '../lib/attendance';
import { usePlanningScope } from '../hooks/usePlanningScope';
import { usePointRules } from '../hooks/useGamification';
import { useAnnounceEvent, useCreateEvent } from '../hooks/useEvents';
import { FormModal } from './FormModal';
import { DateField } from './DateField';
import { clampEnd } from '../lib/dateInput';
import { useSheetProps } from '../hooks/useSheetProps';
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
  'gv',
  'social',
  // FR-095: Vorstandssitzung, Teamsitzung, GV – ein Termin wie jeder andere.
  'meeting',
];

interface EventFormProps {
  onDone: () => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Termin erfassen (UC-009).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md). Die Prüfung des Entwurfs liegt in
 * `validateEventDraft()` – auch das, damit sie prüfbar bleibt.
 */
export function EventForm({ onDone, onDismiss, isOpen = true }: EventFormProps) {
  const { t } = useTranslation();
  const { eventLabel } = useClub();
  const scope = usePlanningScope();
  const rules = usePointRules();
  const createEvent = useCreateEvent();
  const announce = useAnnounceEvent();

  const [type, setType] = useState<EventType>('training');
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [why, setWhy] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  // C-032: Eine Trainer:in plant für ihr Team, nicht für den Verein. Ihr
  // erstes Team ist die Vorgabe; «ganzer Verein» steht ihr nicht zur Wahl.
  useEffect(() => {
    if (!scope.isBoard && teamId === null && scope.teams.length > 0) {
      setTeamId(scope.teams[0].id);
    }
  }, [scope.isBoard, scope.teams, teamId]);
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
        capacityNeeded: parseCapacity(capacity),
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
      isOpen={isOpen}
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
            labelPlacement="stacked"
            value={type}
            onIonChange={(e) => setType(e.detail.value as EventType)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
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
            enterkeyhint="next"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>

        {/* Ende und «bis» folgen dem Beginn: Wer den Beginn hinter das Ende
            setzt, bekommt kein Ende vor dem Anfang – das Ende rückt nach. */}
        <DateField
          label={t('eventForm.startsAt')}
          presentation="date-time"
          value={startsAt}
          onChange={(value) => {
            setStartsAt(value);
            setEndsAt((end) => clampEnd(value, end));
            setUntil((date) => clampEnd(value, date));
          }}
        />

        <DateField
          label={t('eventForm.endsAt')}
          presentation="date-time"
          value={endsAt}
          onChange={setEndsAt}
          min={startsAt}
          clearable
        />

        <IonItem>
          <IonInput
            label={t('eventForm.location')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={location}
            onIonInput={(e) => setLocation(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* FR-029: der Teilnehmerbedarf. Freiwillig – die meisten Termine
          brauchen keine Mindestzahl, und wo keiner steht, gibt es auch keine
          Unterdeckung zu melden. */}
      <ListSection footnote={t('eventForm.capacityHint')}>
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={1}
            label={t('eventForm.capacity')}
            labelPlacement="stacked"
            enterkeyhint="done"
            value={capacity}
            onIonInput={(e) => setCapacity(e.detail.value ?? '')}
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
              enterkeyhint="done"
              value={why}
              onIonInput={(e) => setWhy(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {/* Schritt 5: Team oder Vereinstermin – Letzteres nur für den Vorstand (C-032). */}
      <ListSection
        footnote={
          !scope.isBoard && !scope.isLoading && scope.teams.length === 0
            ? t('common.noPlannableTeam')
            : t(scope.isBoard ? 'eventForm.scopeHint' : 'eventForm.scopeHintTeam')
        }
      >
        <IonItem>
          <IonSelect
            label={t('invite.scope')}
            labelPlacement="stacked"
            value={teamId}
            onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            {scope.isBoard && (
              <IonSelectOption value={null}>{t('eventForm.wholeClub')}</IonSelectOption>
            )}
            {scope.teams.map((team) => (
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
            labelPlacement="stacked"
            value={effectiveRuleCode}
            onIonChange={(e) => {
              setRuleTouched(true);
              setRuleCode((e.detail.value as string | null) ?? null);
            }}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
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
                labelPlacement="stacked"
                value={rhythm}
                onIonChange={(e) => setRhythm(e.detail.value as SeriesRhythm)}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {SERIES_RHYTHMS.map((entry) => (
                  <IonSelectOption key={entry} value={entry}>
                    {t(`eventForm.rhythmValue.${entry}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <DateField
              label={t('eventForm.until')}
              presentation="date"
              value={until}
              onChange={setUntil}
              clearable
            />
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


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function EventFormModal({
  isOpen,
  ...props
}: EventFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <EventForm {...sheet} />;
}
