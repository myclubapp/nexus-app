import { useRef, useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useRemoveFactsheet, useSaveOffice, useUploadFactsheet } from '../hooks/useOffices';
import { FormModal } from './FormModal';
import { MemberSelect } from './MemberPicker';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import {
  EMPTY_OFFICE_DRAFT,
  checkFactsheetFile,
  officeToDraft,
  validateOffice,
  type FactsheetProblem,
  type Office,
  type OfficeDraft,
  type OfficeHolderDraft,
} from '../lib/office';

interface OfficeFormProps {
  /** Ein bestehendes Amt; ohne es entsteht ein neues. */
  office?: Office | null;
  onDone: () => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Ein Amt anlegen oder bearbeiten (UC-041, FR-126).
 *
 * Alles an einem Ort – Bezeichnung, Warum, Pflichten, Eckdaten, Belegung,
 * Ansprechperson, PDF –, weil das Factsheet **eine** Sache ist. Gespeichert
 * wird in einem Schritt über `save_office()`; das PDF folgt danach, weil ein
 * neues Amt seine Kennung erst nach dem Sichern hat.
 *
 * Die Belegung ist eine Liste von Personen mit oder ohne Konto (BR-184). Wer
 * ein Mitglied wählt, bekommt dessen Namen; der Server bestätigt das. Der
 * Spiegel für den Verteiler entsteht in der Datenbank (BR-185).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md).
 */
export function OfficeForm({
  office = null,
  onDone,
  onDismiss,
  isOpen = true,
}: OfficeFormProps) {
  const { t } = useTranslation();
  const { activeClub } = useClub();
  const save = useSaveOffice();
  const upload = useUploadFactsheet();
  const removeFactsheet = useRemoveFactsheet();

  const [draft, setDraft] = useState<OfficeDraft>(
    office ? officeToDraft(office) : EMPTY_OFFICE_DRAFT,
  );
  // Das PDF wird gewählt, aber erst beim Sichern hochgeladen (siehe oben).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [removeRequested, setRemoveRequested] = useState(false);
  const [fileProblem, setFileProblem] = useState<FactsheetProblem | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const problems = validateOffice(draft);
  const isBusy = save.isPending || upload.isPending || removeFactsheet.isPending;
  const error =
    (save.error as Error | null)?.message ??
    (upload.error as Error | null)?.message ??
    (removeFactsheet.error as Error | null)?.message ??
    null;

  function patch(changes: Partial<OfficeDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function patchHolder(index: number, changes: Partial<OfficeHolderDraft>) {
    setDraft((current) => ({
      ...current,
      holders: current.holders.map((holder, i) => (i === index ? { ...holder, ...changes } : holder)),
    }));
  }

  function addHolder() {
    setDraft((current) => ({
      ...current,
      holders: [
        ...current.holders,
        { id: null, memberId: null, displayName: '', interim: false, since: null },
      ],
    }));
  }

  function removeHolder(index: number) {
    setDraft((current) => ({
      ...current,
      holders: current.holders.filter((_, i) => i !== index),
    }));
  }

  function chooseFile(file: File | null) {
    if (!file) return;
    const problem = checkFactsheetFile(file);
    setFileProblem(problem);
    if (problem) return;
    setPendingFile(file);
    setRemoveRequested(false);
  }

  async function submit() {
    const id = await save.mutateAsync({ id: office?.id ?? null, draft });
    if (pendingFile) {
      await upload.mutateAsync({ officeId: id, file: pendingFile });
    } else if (removeRequested && office?.factsheetPath) {
      await removeFactsheet.mutateAsync({ officeId: id, path: office.factsheetPath });
    }
    onDone();
  }

  const hasFactsheet = Boolean(office?.factsheetPath) && !removeRequested;

  return (
    <FormModal
      isOpen={isOpen}
      title={t(office ? 'offices.edit' : 'offices.add')}
      canSubmit={problems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={() => void submit().catch(() => undefined)}
    >
      <ListSection title={t('offices.titleField')} footnote={t('offices.titleHint')}>
        <IonItem>
          <IonInput
            label={t('offices.titleLabel')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={draft.title}
            onIonInput={(e) => patch({ title: e.detail.value ?? '' })}
          />
        </IonItem>
      </ListSection>

      <ListSection title={t('offices.why')} footnote={t('offices.whyHint')}>
        <IonItem>
          <IonTextarea
            label={t('offices.whyLabel')}
            labelPlacement="stacked"
            autoGrow
            value={draft.why}
            onIonInput={(e) => patch({ why: e.detail.value ?? '' })}
          />
        </IonItem>
      </ListSection>

      <ListSection title={t('offices.duties')} footnote={t('offices.dutiesHint')}>
        <IonItem>
          <IonTextarea
            label={t('offices.dutiesLabel')}
            labelPlacement="stacked"
            autoGrow
            rows={4}
            value={draft.dutiesText}
            onIonInput={(e) => patch({ dutiesText: e.detail.value ?? '' })}
          />
        </IonItem>
      </ListSection>

      <ListSection title={t('offices.facts')} footnote={t('offices.seatsHint')}>
        <IonItem>
          <IonInput
            label={t('offices.hours')}
            labelPlacement="stacked"
            placeholder={t('offices.hoursLabel')}
            enterkeyhint="next"
            value={draft.hoursPerSeason}
            onIonInput={(e) => patch({ hoursPerSeason: e.detail.value ?? '' })}
          />
        </IonItem>
        {/* BR-206: die Zahl, die gebucht wird. Leer heisst «noch nicht
            festgelegt» – nicht «null Punkte»; derselbe Unterschied wie beim
            Saisonziel (BR-200). */}
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={0}
            max={10000}
            label={t('offices.points')}
            labelPlacement="stacked"
            placeholder={t('offices.seasonPointsLabel')}
            enterkeyhint="next"
            value={draft.seasonPoints === null ? '' : String(draft.seasonPoints)}
            onIonInput={(e) => {
              const raw = (e.detail.value ?? '').trim();
              const parsed = Number(raw);
              patch({
                seasonPoints: raw === '' || !Number.isFinite(parsed) ? null : Math.round(parsed),
              });
            }}
          />
        </IonItem>
        {/* Was keine Punktzahl ist, aber am Amt hängt: Lohn, Spesen. */}
        <IonItem>
          <IonInput
            label={t('offices.pointsExtra')}
            labelPlacement="stacked"
            placeholder={t('offices.pointsLabel')}
            enterkeyhint="next"
            value={draft.pointsLabel}
            onIonInput={(e) => patch({ pointsLabel: e.detail.value ?? '' })}
          />
        </IonItem>
        <IonItem>
          <IonInput
            type="number"
            inputmode="numeric"
            min={1}
            max={50}
            enterkeyhint="done"
            label={t('offices.seatsLabel')}
            labelPlacement="stacked"
            value={String(draft.maxHolders)}
            onIonInput={(e) => patch({ maxHolders: Number(e.detail.value ?? '1') })}
          />
        </IonItem>
      </ListSection>

      {/* BR-237: Das Merkmal steht in einem eigenen Abschnitt, weil es mehr
          bewirkt als eine Angabe am Factsheet – es bestimmt, wer zu einer
          Vorstandssitzung eingeladen wird und wer sie überhaupt sieht. */}
      <ListSection footnote={t('offices.boardHint')}>
        <IonItem>
          <IonToggle
            checked={draft.isBoard}
            onIonChange={(e) => patch({ isBoard: e.detail.checked })}
          >
            {t('offices.board')}
          </IonToggle>
        </IonItem>
      </ListSection>

      {/* BR-184: Namen genügen. Ein gewähltes Mitglied bringt seinen Namen
          selbst mit – der Server setzt ihn, das Feld zeigt ihn nur. */}
      <ListSection
        title={t('offices.holders')}
        footnote={t('offices.holdersHint')}
        action={
          <IonButton fill="clear" size="small" onClick={addHolder}>
            {t('offices.addHolder')}
          </IonButton>
        }
      >
        {draft.holders.length === 0 && (
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <IonNote>{t('offices.holdersEmpty')}</IonNote>
            </IonLabel>
          </IonItem>
        )}
        {draft.holders.map((holder, index) => (
          <div key={holder.id ?? `new-${index}`}>
            <MemberSelect
              label={t('offices.holderMember')}
              noneLabel={t('offices.holderNoMember')}
              fallbackName={holder.displayName}
              value={holder.memberId}
              onChange={(memberId, member) =>
                patchHolder(index, {
                  memberId,
                  displayName: member?.display_name ?? holder.displayName,
                })
              }
            />
            <IonItem>
              <IonInput
                label={t('offices.holderName')}
                labelPlacement="stacked"
                enterkeyhint="done"
                readonly={holder.memberId !== null}
                value={holder.displayName}
                onIonInput={(e) => patchHolder(index, { displayName: e.detail.value ?? '' })}
              />
            </IonItem>
            <IonItem>
              <IonToggle
                checked={holder.interim}
                onIonChange={(e) => patchHolder(index, { interim: e.detail.checked })}
              >
                <IonLabel>{t('offices.interim')}</IonLabel>
              </IonToggle>
              <IonButton
                slot="end"
                fill="clear"
                color="danger"
                size="small"
                onClick={() => removeHolder(index)}
              >
                {t('offices.removeHolder')}
              </IonButton>
            </IonItem>
          </div>
        ))}
      </ListSection>

      <ListSection title={t('offices.contact')}>
        <MemberSelect
          label={t('offices.contactMember')}
          noneLabel={t('offices.contactNone')}
          fallbackName={draft.contactName}
          value={draft.contactMemberId}
          onChange={(memberId, member) =>
            patch({
              contactMemberId: memberId,
              contactName: member?.display_name ?? draft.contactName,
            })
          }
        />
        <IonItem>
          <IonInput
            label={t('offices.contactLabel')}
            labelPlacement="stacked"
            enterkeyhint="done"
            value={draft.contactName}
            onIonInput={(e) => patch({ contactName: e.detail.value ?? '' })}
          />
        </IonItem>
      </ListSection>

      {/* BR-186: Das PDF. Der Dateiwähler ist ein verstecktes Feld – der
          sichtbare Knopf trägt den Namen der Handlung. */}
      <ListSection title={t('offices.factsheet')} footnote={t('offices.factsheetHint')}>
        <IonItem>
          <IonLabel className="ion-text-wrap">
            <IonNote>
              {pendingFile
                ? t('offices.factsheetPending', { name: pendingFile.name })
                : removeRequested
                  ? t('offices.factsheetRemovePending')
                  : hasFactsheet
                    ? t('offices.factsheet')
                    : t('offices.factsheetNone')}
            </IonNote>
          </IonLabel>
        </IonItem>
      </ListSection>
      <input
        ref={fileInput}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          chooseFile(e.target.files?.[0] ?? null);
          e.target.value = '';
        }}
      />
      <div className="app-actions">
        <IonButton expand="block" fill="outline" onClick={() => fileInput.current?.click()}>
          {t(hasFactsheet || pendingFile ? 'offices.factsheetReplace' : 'offices.factsheetChoose')}
        </IonButton>
        {(hasFactsheet || pendingFile) && (
          <IonButton
            expand="block"
            fill="clear"
            color="medium"
            onClick={() => {
              setPendingFile(null);
              setRemoveRequested(Boolean(office?.factsheetPath));
            }}
          >
            {t('offices.factsheetRemove')}
          </IonButton>
        )}
      </div>
      {fileProblem && <InlineError message={t(`offices.factsheetError.${fileProblem}`)} />}

      {problems.map((problem) => (
        <InlineError key={problem} message={t(`offices.problem.${problem}`)} />
      ))}

      {/* Ohne Verein gibt es nichts zu sichern – der Fall ist theoretisch,
          das Formular hängt hinter `RequireClub`. */}
      {!activeClub && <InlineError message={t('common.error')} />}
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function OfficeFormModal({
  isOpen,
  ...props
}: OfficeFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <OfficeForm {...sheet} />;
}
