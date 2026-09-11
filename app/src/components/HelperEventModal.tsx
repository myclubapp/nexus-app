import { useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useCreateHelperEvent, usePublishEvent } from '../hooks/useHelperEvents';
import { FormModal } from './FormModal';
import { DateField } from './DateField';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { durationInMinutes } from '../lib/eventSeries';
import { suggestedShiftPoints, validateShift, type ShiftDraft } from '../lib/shift';
import { formatDateTime } from '../lib/format';

interface HelperEventFormProps {
  onDone: (published: boolean, muted: boolean) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Helfer-Event ausschreiben (UC-011).
 *
 * Der Ablauf der Spezifikation ist ein Formular plus eine wachsende Liste:
 * Angaben und Warum (Schritte 2–3), dann Schicht um Schicht (4–7), dann
 * publizieren oder als Entwurf sichern (8, A2).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md).
 */
export function HelperEventForm({ onDone, onDismiss, isOpen = true }: HelperEventFormProps) {
  const { t } = useTranslation();
  const createEvent = useCreateHelperEvent();
  const publish = usePublishEvent();

  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [why, setWhy] = useState('');
  // Ein Helferaufruf richtet sich an den ganzen Verein: Schritt 2 nennt Titel,
  // Datum, Ort und Warum – keinen Geltungsbereich. Wer Helfer sucht, sucht sie
  // nicht in einem Team.

  const [shifts, setShifts] = useState<ShiftDraft[]>([]);
  const [draft, setDraft] = useState<ShiftDraft>({
    title: '',
    startsAt: '',
    endsAt: '',
    needed: 2,
    points: 0,
  });
  // Schritt 6 erlaubt ausdrücklich, den Wert zu **ändern** – auch auf 0, denn
  // eine Schicht darf im Nur-Dank-Sinn punktefrei bleiben. Solange niemand
  // eingegriffen hat, steht hier `null` und der Vorschlag gilt; `0` als
  // Sentinel zu verwenden hiesse, genau diese Eingabe zu verschlucken.
  const [pointsOverride, setPointsOverride] = useState<number | null>(null);

  const draftDuration = durationInMinutes(draft.startsAt, draft.endsAt) ?? 0;
  // Schritt 5: Der Vorschlag folgt der Dauer, solange niemand selbst wählt.
  const draftPoints = pointsOverride ?? suggestedShiftPoints(draftDuration);
  const draftProblems = validateShift({ ...draft, points: draftPoints });

  // BR-043 und die Postcondition: Warum **und** mindestens eine Schicht.
  const canPublish =
    title.trim().length >= 2 &&
    startsAt !== '' &&
    why.trim().length > 0 &&
    shifts.length > 0;
  const canSaveDraft = title.trim().length >= 2 && startsAt !== '';

  const isBusy = createEvent.isPending || publish.isPending;
  const error =
    (createEvent.error as Error | null)?.message ??
    (publish.error as Error | null)?.message ??
    null;

  function addShift() {
    setShifts((current) => [...current, { ...draft, points: draftPoints }]);
    setDraft({ title: '', startsAt: '', endsAt: '', needed: 2, points: 0 });
    setPointsOverride(null);
  }

  async function submit(shouldPublish: boolean) {
    const eventId = await createEvent.mutateAsync({
      title,
      startsAt,
      endsAt: endsAt || null,
      location: location || null,
      why,
      shifts,
    });

    if (!shouldPublish) {
      onDone(false, false);
      return;
    }

    const result = await publish.mutateAsync(eventId);
    onDone(true, result.muted);
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t('helperEvent.title')}
      submitLabel={t('helperEvent.publish')}
      canSubmit={canPublish && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => void submit(true).catch(() => undefined)}
    >
      <ListSection>
        <IonItem>
          <IonInput
            label={t('eventForm.eventTitle')}
            labelPlacement="stacked"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>
        <DateField
          label={t('eventForm.startsAt')}
          presentation="date-time"
          value={startsAt}
          onChange={setStartsAt}
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
            value={location}
            onIonInput={(e) => setLocation(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* BR-043: Das Warum ist Pflicht, nicht Beiwerk – deshalb ein eigener
          Abschnitt und nicht ein Feld unter vielen. */}
      <ListSection title={t('helperEvent.whyTitle')} footnote={t('eventForm.whyHint')}>
        <IonItem>
          <IonInput
            label={t('eventForm.why')}
            labelPlacement="stacked"
            value={why}
            onIonInput={(e) => setWhy(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* Schritte 4–7: Schicht um Schicht */}
      <ListSection
        title={t('helperEvent.shifts', { count: shifts.length })}
        footnote={t('helperEvent.shiftsHint')}
      >
        {shifts.map((shift, index) => (
          <IonItemSliding key={`${shift.title}-${shift.startsAt}-${index}`}>
            <IonItem>
              <IonLabel className="ion-text-wrap">
                <h2>{shift.title}</h2>
                <IonNote>
                  {formatDateTime(shift.startsAt)} – {formatDateTime(shift.endsAt)}
                  {' · '}
                  {t('helperEvent.needed', { count: shift.needed })}
                  {' · '}+{shift.points}
                </IonNote>
              </IonLabel>
            </IonItem>
            <IonItemOptions side="end">
              <IonItemOption
                color="danger"
                onClick={() =>
                  setShifts((current) => current.filter((_, i) => i !== index))
                }
              >
                {t('helperEvent.removeShift')}
              </IonItemOption>
            </IonItemOptions>
          </IonItemSliding>
        ))}

        {shifts.length === 0 && (
          <IonItem>
            <IonNote>{t('helperEvent.noShifts')}</IonNote>
          </IonItem>
        )}
      </ListSection>

      <ListSection title={t('helperEvent.addShift')} footnote={t('helperEvent.pointsHint')}>
        <IonItem>
          <IonInput
            label={t('helperEvent.shiftTitle')}
            labelPlacement="stacked"
            value={draft.title}
            onIonInput={(e) => setDraft((d) => ({ ...d, title: e.detail.value ?? '' }))}
          />
        </IonItem>
        <DateField
          label={t('eventForm.startsAt')}
          presentation="date-time"
          value={draft.startsAt}
          onChange={(value) => setDraft((d) => ({ ...d, startsAt: value }))}
        />
        <DateField
          label={t('eventForm.endsAt')}
          presentation="date-time"
          value={draft.endsAt}
          onChange={(value) => setDraft((d) => ({ ...d, endsAt: value }))}
          min={draft.startsAt}
          clearable
        />
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={1}
            label={t('helperEvent.neededLabel')}
            labelPlacement="stacked"
            value={String(draft.needed)}
            onIonInput={(e) =>
              setDraft((d) => ({ ...d, needed: Number(e.detail.value ?? '1') }))
            }
          />
        </IonItem>
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={0}
            label={t('helperEvent.pointsLabel')}
            labelPlacement="stacked"
            value={String(draftPoints)}
            onIonInput={(e) => {
              const raw = e.detail.value ?? '';
              // Ein geleertes Feld heisst «wieder der Vorschlag», eine 0 heisst 0.
              setPointsOverride(raw === '' ? null : Number(raw));
            }}
          />
        </IonItem>
      </ListSection>

      <div className="app-actions">
        <IonButton
          expand="block"
          fill="outline"
          disabled={draftProblems.length > 0}
          onClick={addShift}
        >
          <IonIcon slot="start" icon={addOutline} aria-hidden="true" />
          {t('helperEvent.addShift')}
        </IonButton>
      </div>

      {/* A1: nicht nur sperren, sondern sagen, woran es liegt. */}
      {shifts.length === 0 && <InlineError message={t('helperEvent.needsShift')} />}
      {shifts.length > 0 && why.trim().length === 0 && (
        <InlineError message={t('helperEvent.needsWhy')} />
      )}

      {/* A2: Entwurf sichern – ohne Sichtbarkeit, ohne Zustellung. */}
      <div className="app-actions">
        <IonButton
          expand="block"
          fill="clear"
          disabled={!canSaveDraft || isBusy}
          onClick={() => void submit(false).catch(() => undefined)}
        >
          {t('helperEvent.saveDraft')}
        </IonButton>
        <IonNote>{t('helperEvent.draftHint')}</IonNote>
      </div>
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function HelperEventModal({
  isOpen,
  ...props
}: HelperEventFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <HelperEventForm {...sheet} />;
}
