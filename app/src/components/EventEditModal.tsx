import { useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonInput,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { usePointRules } from '../hooks/useGamification';
import { useCancelEvent, useUpdateEvent } from '../hooks/useEvents';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import {
  canCancelEvent,
  hasSeriesChoice,
  requiresWhy,
  validateCancel,
} from '../lib/eventSeries';
import { useOffices } from '../hooks/useOffices';
import { readRoleIds, sortOffices } from '../lib/office';
import type { AppEvent } from '../lib/database.types';

interface EventEditProps {
  event: AppEvent;
  onDone: (outcome: 'changed' | 'cancelled') => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Einen Termin ändern und absagen (UC-009, A2 und FR-023).
 *
 * Beides steht in **einem** Blatt, weil es dieselbe Frage beantwortet: Was
 * wird aus diesem Termin? Zwei getrennte Wege hätten die Serienfrage zweimal
 * gestellt – und wer absagen will, öffnet nicht erst das Bearbeiten.
 *
 * **A2: nur dieser Termin oder die ganze Serie?** Die Frage erscheint nur bei
 * einem Termin mit Serie; sonst wäre sie eine Auswahl mit einer Möglichkeit.
 * Geändert werden dabei nur künftige Termine – vergangene bleiben, wie sie
 * stattgefunden haben.
 *
 * Zeiten bleiben aussen vor: Sie unterscheiden die Termine einer Serie gerade
 * voneinander und lassen sich nicht gemeinsam setzen.
 */
export function EventEdit({ event, onDone, onDismiss, isOpen = true }: EventEditProps) {
  const { t } = useTranslation();
  const rules = usePointRules();
  const offices = useOffices();
  const update = useUpdateEvent();
  const cancelEvent = useCancelEvent();

  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location ?? '');
  const [why, setWhy] = useState(event.why ?? '');
  const [ruleCode, setRuleCode] = useState<string | null>(event.point_rule_code);
  // FR-096: Das Gremium einer Sitzung lässt sich korrigieren – sonst bliebe
  // als Weg nur, die Sitzung zu löschen und neu anzulegen.
  const isMeeting = event.type === 'meeting';
  const [committee, setCommittee] = useState<string[]>(
    readRoleIds(event.audience_role_ids),
  );
  const [scope, setScope] = useState<'single' | 'series'>('single');
  const [reason, setReason] = useState('');
  const [askCancel, setAskCancel] = useState(false);

  const editable = {
    cancelledAt: event.cancelled_at,
    startsAt: event.starts_at,
    seriesId: event.series_id,
  };
  const canCancel = canCancelEvent(editable);
  const cancelProblems = validateCancel(reason);

  const isBusy = update.isPending || cancelEvent.isPending;
  const error =
    (update.error as Error | null)?.message ??
    (cancelEvent.error as Error | null)?.message ??
    null;

  // BR-036 gilt auch beim Ändern: Ein Aufruf ohne Warum bliebe ein Aufruf.
  const whyMissing = requiresWhy(event.type) && why.trim().length === 0;
  // BR-237: Eine Sitzung ohne Gremium weist auch die Tabelle ab (`0095`).
  const committeeMissing = isMeeting && committee.length === 0;

  function save() {
    update.mutate(
      {
        eventId: event.id,
        seriesId: event.series_id,
        scope,
        title,
        location: location || null,
        why: why || null,
        pointRuleCode: ruleCode,
        committeeRoleIds: isMeeting ? committee : undefined,
      },
      { onSuccess: () => onDone('changed') },
    );
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t('eventEdit.title')}
      submitLabel={t('common.save')}
      canSubmit={title.trim().length >= 2 && !whyMissing && !committeeMissing && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={save}
    >
      <ListSection>
        <IonItem>
          <IonInput
            label={t('eventForm.eventTitle')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>

        <IonItem>
          <IonInput
            label={t('eventForm.location')}
            labelPlacement="stacked"
            enterkeyhint={requiresWhy(event.type) ? 'next' : 'done'}
            value={location}
            onIonInput={(e) => setLocation(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* BR-036: Aufrufe tragen ihren Sinnzusammenhang – auch nach einer
          Änderung. */}
      {requiresWhy(event.type) && (
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

      {isMeeting && (
        <ListSection footnote={t('eventForm.committeeHint')}>
          <IonItem>
            <IonSelect
              multiple
              label={t('eventForm.committee')}
              labelPlacement="stacked"
              value={committee}
              onIonChange={(e) => setCommittee((e.detail.value as string[] | null) ?? [])}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              {sortOffices(offices.data ?? []).map((office) => (
                <IonSelectOption key={office.id} value={office.id}>
                  {office.title}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>
      )}

      <ListSection footnote={t('eventForm.ruleHint')}>
        <IonItem>
          <IonSelect
            label={t('eventForm.rule')}
            labelPlacement="stacked"
            value={ruleCode}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => setRuleCode((e.detail.value as string | null) ?? null)}
          >
            <IonSelectOption value={null}>{t('eventForm.noRule')}</IonSelectOption>
            {(rules.data ?? []).map((rule) => (
              <IonSelectOption key={rule.code} value={rule.code}>
                {rule.label}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* A2: Diese Frage stellt sich nur bei einer Serie. */}
      {hasSeriesChoice(editable) && (
        <ListSection title={t('eventEdit.scope')} footnote={t('eventEdit.scopeHint')}>
          <IonItem>
            <IonSelect
              label={t('eventEdit.scopeLabel')}
              labelPlacement="stacked"
              value={scope}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => setScope(e.detail.value as 'single' | 'series')}
            >
              <IonSelectOption value="single">{t('eventEdit.onlyThis')}</IonSelectOption>
              <IonSelectOption value="series">{t('eventEdit.wholeSeries')}</IonSelectOption>
            </IonSelect>
          </IonItem>
        </ListSection>
      )}

      {whyMissing && <InlineError message={t('eventForm.whyMissing')} />}

      {/* FR-023 und BR-035: Absage mit Grund. Der Grund steht **vor** dem
          Knopf, nicht in einem zweiten Dialog: Er ist die Bedingung, nicht die
          Bestätigung. */}
      {canCancel && (
        <ListSection title={t('eventEdit.cancelTitle')} footnote={t('eventEdit.cancelHint')}>
          <IonItem>
            <IonTextarea
              label={t('eventEdit.reason')}
              labelPlacement="stacked"
              autoGrow
              rows={2}
              value={reason}
              onIonInput={(e) => setReason(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {canCancel && (
        <div className="app-actions">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            disabled={cancelProblems.length > 0 || isBusy}
            onClick={() => setAskCancel(true)}
          >
            {t('eventEdit.cancelEvent')}
          </IonButton>
          {cancelProblems.length > 0 && (
            <InlineError message={t('eventEdit.reasonMissing')} />
          )}
        </div>
      )}

      {/* Die Absage erreicht alle Betroffenen und lässt sich nicht
          zurücknehmen – deshalb eine Rückfrage. */}
      <IonAlert
        isOpen={askCancel}
        header={t('eventEdit.cancelEvent')}
        message={t('eventEdit.cancelConfirm')}
        onDidDismiss={() => setAskCancel(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('eventEdit.cancelEvent'),
            // Die Absage nimmt allen Betroffenen den Termin – ein Wegwerf-
            // Knopf, und der trägt die rote Rolle (guidelines §2).
            role: 'destructive',
            handler: () => {
              cancelEvent.mutate(
                { eventId: event.id, reason },
                { onSuccess: () => onDone('cancelled') },
              );
            },
          },
        ]}
      />
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function EventEditModal({
  event,
  ...props
}: Omit<EventEditProps, 'event'> & { event: AppEvent | null }) {
  const sheet = useSheetProps(event ? { event, ...props } : null);
  return sheet && <EventEdit {...sheet} />;
}
