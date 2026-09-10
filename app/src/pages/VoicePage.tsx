import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { FormModal } from '../components/FormModal';
import { EmptyState, ErrorState, InlineError } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useClub } from '../hooks/useClub';
import { useTeams } from '../hooks/useInvites';
import { useMembers } from '../hooks/useMembers';
import { useSubmitVoiceNote, useVoiceNotes, useVoiceQuota } from '../hooks/useVoice';
import { useToast } from '../hooks/useToast';
import {
  VOICE_KINDS,
  createAnonTicket,
  hashTicket,
  isPrivate,
  needsTarget,
  validateVoiceNote,
  type VoiceDraft,
  type VoiceKind,
  type VoiceTarget,
} from '../lib/voice';

const TICKET_KEY = 'myclub.voiceTickets';

/**
 * «Stimme» – ein Anliegen erfassen und adressieren (UC-029).
 *
 * Aufnahme und Transkription fehlen: `SpeechRecognition` im Browser schickt
 * das Audio zu Google und ist durch BR-125 ausgeschlossen. Die Spezifikation
 * nennt den Textweg in A4 als regulären Ablauf – die Seite sagt offen, dass
 * das Mikrofon noch fehlt, statt einen Knopf anzubieten, der nichts tut.
 *
 * Der anonyme Weg erzeugt sein Ticket **auf dem Gerät**; der Server bekommt
 * nur den Prüfwert (A2, BR-122).
 */
export function VoicePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isTrainer } = useClub();
  const notes = useVoiceNotes();
  const quota = useVoiceQuota();
  const submit = useSubmitVoiceNote();
  const teams = useTeams();
  const members = useMembers();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft>({
    kind: 'self_reflection',
    text: '',
    target: null,
    targetMemberId: null,
    targetTeamId: null,
  });

  const quotaLeft = quota.data ?? 0;
  const problems = validateVoiceNote(draft, quotaLeft);
  const rows = notes.data ?? [];

  // Die Arten, die dieser Person offenstehen: Das Logbuch gehört Trainer:innen.
  const kinds = VOICE_KINDS.filter(
    (kind) => kind !== 'coach_log' || isTrainer,
  );

  async function send() {
    let tokenHash: string | null = null;

    if (draft.kind === 'anonymous') {
      // A2: Das Ticket bleibt hier. Verliert jemand seinen Speicher, verliert
      // er den Rückkanal – anders wäre es keine Anonymität.
      const ticket = createAnonTicket();
      tokenHash = await hashTicket(ticket);
      try {
        const stored = JSON.parse(window.localStorage.getItem(TICKET_KEY) ?? '[]');
        window.localStorage.setItem(
          TICKET_KEY,
          JSON.stringify([...(Array.isArray(stored) ? stored : []), ticket]),
        );
      } catch {
        // Privates Fenster: Das Anliegen geht trotzdem raus, nur der Rückweg
        // fehlt. Darauf weist der Hinweis im Formular hin.
      }
    }

    await submit.mutateAsync({
      kind: draft.kind,
      transcript: draft.text,
      targetMemberId: draft.target === 'person' ? draft.targetMemberId : null,
      targetRole:
        draft.target === 'trainer' || draft.target === 'admin' ? draft.target : null,
      targetTeamId: draft.target === 'team' ? draft.targetTeamId : null,
      tokenHash,
    });

    setOpen(false);
    setDraft({ ...draft, text: '', target: null, targetMemberId: null, targetTeamId: null });
    toast.success(
      isPrivate(draft.kind) ? t('voice.savedPrivate') : t('voice.sent'),
    );
  }

  return (
    <AppPage
      title={t('voice.title')}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([notes.refetch(), quota.refetch()])}
    >
      <ListSection footnote={t('voice.micPending')}>
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <p>{t('voice.quotaLeft', { count: quotaLeft })}</p>
          </IonLabel>
        </IonItem>
      </ListSection>

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={quotaLeft <= 0}
          onClick={() => setOpen(true)}
        >
          {t('voice.write')}
        </IonButton>
      </div>

      {notes.isLoading ? (
        <SkeletonList />
      ) : notes.error ? (
        <ErrorState error={notes.error as Error} onRetry={() => void notes.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState message={t('voice.empty')} />
      ) : (
        <ListSection title={t('voice.mine')} footnote={t('voice.listHint')}>
          {rows.map((note) => (
            <IonItem key={note.id}>
              <IonLabel className="ion-text-wrap">
                <h2>{t(`voice.kind.${note.kind}`)}</h2>
                <p>{note.transcript}</p>
                <IonNote>{note.createdWeek}</IonNote>
                {note.response && <p>«{note.response}»</p>}
              </IonLabel>
              {note.status !== 'open' && (
                <IonBadge slot="end" color="medium">
                  {t(`voice.status.${note.status}`)}
                </IonBadge>
              )}
            </IonItem>
          ))}
        </ListSection>
      )}

      <FormModal
        isOpen={open}
        title={t('voice.write')}
        submitLabel={t('voice.send')}
        canSubmit={problems.length === 0 && !submit.isPending}
        isSubmitting={submit.isPending}
        error={submit.error ? (submit.error as Error).message : null}
        onDismiss={() => setOpen(false)}
        onSubmit={() => void send().catch(() => undefined)}
      >
        <ListSection title={t('voice.kindTitle')} footnote={t(`voice.kindHint.${draft.kind}`)}>
          <IonItem>
            <IonSelect
              label={t('voice.kindLabel')}
              labelPlacement="stacked"
              value={draft.kind}
              onIonChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  kind: e.detail.value as VoiceKind,
                  target: null,
                }))
              }
            >
              {kinds.map((kind) => (
                <IonSelectOption key={kind} value={kind}>
                  {t(`voice.kind.${kind}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>

        {/* Schritt 6: die Adressierung – nur, wo sie einen Sinn hat. */}
        {needsTarget(draft.kind) && (
          <ListSection title={t('voice.targetTitle')}>
            <IonItem>
              <IonSelect
                label={t('voice.targetLabel')}
                labelPlacement="stacked"
                value={draft.target}
                onIonChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    target: e.detail.value as VoiceTarget,
                  }))
                }
              >
                <IonSelectOption value="person">{t('voice.target.person')}</IonSelectOption>
                <IonSelectOption value="trainer">{t('voice.target.trainer')}</IonSelectOption>
                <IonSelectOption value="admin">{t('voice.target.admin')}</IonSelectOption>
                <IonSelectOption value="team">{t('voice.target.team')}</IonSelectOption>
              </IonSelect>
            </IonItem>

            {draft.target === 'person' && (
              <IonItem>
                <IonSelect
                  label={t('voice.person')}
                  labelPlacement="stacked"
                  value={draft.targetMemberId}
                  onIonChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      targetMemberId: e.detail.value as string,
                    }))
                  }
                >
                  {(members.data ?? []).map((member) => (
                    <IonSelectOption key={member.id} value={member.id}>
                      {member.display_name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            )}

            {draft.target === 'team' && (
              <IonItem>
                <IonSelect
                  label={t('voice.team')}
                  labelPlacement="stacked"
                  value={draft.targetTeamId}
                  onIonChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      targetTeamId: e.detail.value as string,
                    }))
                  }
                >
                  {(teams.data ?? []).map((team) => (
                    <IonSelectOption key={team.id} value={team.id}>
                      {team.name}
                    </IonSelectOption>
                  ))}
                </IonSelect>
              </IonItem>
            )}
          </ListSection>
        )}

        {/* BR-121: Der Text steht vor dem Absenden vollständig da. */}
        <ListSection title={t('voice.text')} footnote={t('voice.textHint')}>
          <IonItem>
            <IonTextarea
              label={t('voice.textLabel')}
              labelPlacement="stacked"
              autoGrow
              rows={6}
              value={draft.text}
              onIonInput={(e) =>
                setDraft((current) => ({ ...current, text: e.detail.value ?? '' }))
              }
            />
          </IonItem>
        </ListSection>

        {draft.kind === 'anonymous' && (
          <IonNote className="app-footnote">{t('voice.anonymousHint')}</IonNote>
        )}

        {problems.map((problem) => (
          <InlineError key={problem} message={t(`voice.problem.${problem}`)} />
        ))}
      </FormModal>
    </AppPage>
  );
}
