import { useState } from 'react';
import {
  IonInput,
  IonItem,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useTeams } from '../hooks/useInvites';
import { usePublishNews, useUpdateNews } from '../hooks/useNews';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { validateNews, type NewsDraft } from '../lib/news';
import type { News } from '../lib/database.types';

interface NewsFormProps {
  /** Ist gesetzt, wird bearbeitet statt publiziert (A3). */
  editing?: News | null;
  onDone: (edited: boolean) => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}

/**
 * Eine News schreiben oder korrigieren (UC-026).
 *
 * Der Unterschied zwischen den beiden Wegen ist mehr als der Knopf: Publizieren
 * stellt zu und zählt als Verbindung, Korrigieren tut **beides nicht** (A3).
 * Wer einen Tippfehler behebt, soll nicht den ganzen Verein ein zweites Mal
 * aufschrecken.
 */
export function NewsForm({ editing = null, onDone, onDismiss, isOpen = true }: NewsFormProps) {
  const { t } = useTranslation();
  const teams = useTeams();
  const publish = usePublishNews();
  const update = useUpdateNews();

  const [title, setTitle] = useState(editing?.title ?? '');
  const [body, setBody] = useState(editing?.body ?? '');
  const [imageUrl, setImageUrl] = useState(editing?.image_url ?? '');
  const [teamId, setTeamId] = useState<string | null>(editing?.team_id ?? null);

  const draft: NewsDraft = { title, body, imageUrl, teamId };
  const problems = validateNews(draft);

  const isBusy = publish.isPending || update.isPending;
  const error =
    (publish.error as Error | null)?.message ??
    (update.error as Error | null)?.message ??
    null;

  function submit() {
    if (editing) {
      update.mutate(
        { id: editing.id, draft },
        { onSuccess: () => onDone(true) },
      );
      return;
    }
    publish.mutate(draft, { onSuccess: () => onDone(false) });
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={editing ? t('newsForm.editTitle') : t('newsForm.title')}
      submitLabel={editing ? t('common.save') : t('newsForm.publish')}
      canSubmit={problems.length === 0 && !isBusy}
      isSubmitting={isBusy}
      error={error}
      onDismiss={onDismiss}
      onSubmit={submit}
    >
      <ListSection>
        <IonItem>
          <IonInput
            label={t('newsForm.newsTitle')}
            labelPlacement="stacked"
            value={title}
            onIonInput={(e) => setTitle(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonTextarea
            label={t('newsForm.body')}
            labelPlacement="stacked"
            autoGrow
            rows={4}
            value={body}
            onIonInput={(e) => setBody(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* A1: Das Bild ist ein Verweis – einen Vereinsspeicher gibt es noch nicht. */}
      <ListSection title={t('newsForm.image')} footnote={t('newsForm.imageHint')}>
        <IonItem>
          <IonInput
            type="url"
            inputmode="url"
            label={t('newsForm.imageLabel')}
            labelPlacement="stacked"
            value={imageUrl}
            onIonInput={(e) => setImageUrl(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* Schritt 4: ganzer Verein oder ein Team (BR-109). */}
      <ListSection title={t('newsForm.scope')} footnote={t('newsForm.scopeHint')}>
        <IonItem>
          <IonSelect
            label={t('newsForm.team')}
            labelPlacement="stacked"
            value={teamId}
            onIonChange={(e) => setTeamId((e.detail.value as string | null) ?? null)}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
          >
            <IonSelectOption value={null}>{t('newsForm.wholeClub')}</IonSelectOption>
            {(teams.data ?? []).map((team) => (
              <IonSelectOption key={team.id} value={team.id}>
                {team.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {problems.map((problem) => (
        <InlineError key={problem} message={t(`newsForm.problem.${problem}`)} />
      ))}

      {/* A3 ist eine Erklärung, kein Fehler: eine Fussnote, keine rote Box. */}
      {editing && <IonNote className="app-footnote">{t('newsForm.editHint')}</IonNote>}
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function NewsFormModal({
  isOpen,
  ...props
}: NewsFormProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <NewsForm {...sheet} />;
}
