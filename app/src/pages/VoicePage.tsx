import { Fragment, useState } from 'react';
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
import { TextSection } from '../components/TextSection';
import { FormModal } from '../components/FormModal';
import { MemberSelect } from '../components/MemberPicker';
import { NoteAnswerModal } from '../components/NoteAnswerModal';
import { EmptyState, ErrorState, InlineError } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useClub } from '../hooks/useClub';
import { useTeams } from '../hooks/useInvites';
import {
  useAnonThreads,
  useFollowUpAnon,
  useSubmitVoiceNote,
  useTicketHashes,
  useVoiceNotes,
  useVoiceQuota,
} from '../hooks/useVoice';
import { useToast } from '../hooks/useToast';
import { formatDateTime } from '../lib/format';
import {
  VOICE_KINDS,
  canHandle,
  createAnonTicket,
  hashTicket,
  isPrivate,
  needsTarget,
  storeTicket,
  validateVoiceNote,
  type VoiceDraft,
  type VoiceKind,
  type VoiceTarget,
} from '../lib/voice';

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
 *
 * Seit UC-030 ist die Seite zweiseitig: Oben steht der Eingang der Anliegen,
 * die an diese Person gerichtet sind (BR-128 – nichts versandet), darunter die
 * eigenen, und zuunterst die anonymen Fäden dieses Geräts. Eine zweite Seite
 * für die Empfängerrolle wäre ein zweiter Ort für dieselbe Sache – und wer
 * beide Rollen hat, müsste zwischen ihnen wechseln.
 */
export function VoicePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { isTrainer } = useClub();
  const notes = useVoiceNotes();
  const quota = useVoiceQuota();
  const submit = useSubmitVoiceNote();
  const teams = useTeams();
  const ticketHashes = useTicketHashes();
  const threads = useAnonThreads(ticketHashes);
  const followUp = useFollowUpAnon();

  const [open, setOpen] = useState(false);
  // Nur die Kennung, nicht das Anliegen: Setzt das Blatt den Status, lädt die
  // Abfrage neu – eine Kopie im Zustand zeigte danach den alten Stand, und das
  // Segment spränge zurück.
  const [handledId, setHandledId] = useState<string | null>(null);
  const [followText, setFollowText] = useState<Record<string, string>>({});
  // Zeilen sind kurz (ion-item, Content Types): Ein Anliegen steht auf drei
  // Zeilen, der Volltext im Antwort-Blatt – oder, wo es keines gibt, nach dem
  // Antippen der Zeile.
  const [expanded, setExpanded] = useState<string[]>([]);
  const toggleExpanded = (id: string) =>
    setExpanded((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  const clampClass = (id: string) => (expanded.includes(id) ? undefined : 'app-clamp-3');
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
  const isEmpty = rows.length === 0 && (threads.data ?? []).length === 0;
  // Drei Körbe aus **einer** Abfrage: Was überhaupt sichtbar ist, entscheidet
  // die Policy; hier wird nur sortiert. Ein gemeldetes Anliegen (A6) gehört in
  // keinen der beiden ersten – es unter «Deine» zu führen wäre eine falsche
  // Beschriftung, es wegzulassen ein stilles Verschwinden.
  const inbox = rows.filter((note) => canHandle(note));
  const mine = rows.filter((note) => note.isMine);
  const flagged = rows.filter((note) => !note.isMine && !canHandle(note));
  const handled = rows.find((note) => note.id === handledId) ?? null;

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
      // Privates Fenster: Das Anliegen geht trotzdem raus, nur der Rückweg
      // fehlt. Das muss die Person jetzt erfahren – später merkt sie es
      // daran, dass die Antwort nie erscheint.
      if (!storeTicket(ticket)) toast.failure(t('voice.ticketLost'));
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

  /**
   * A1, Schritt 2: im anonymen Faden nachfassen.
   *
   * Der Server bekommt den Prüfwert des Tickets, nie das Ticket selbst und nie
   * eine Person. Der Wert hängt am Faden, damit ein Ticket ohne Faden die
   * Zuordnung nicht verschiebt.
   */
  function sendFollowUp(noteId: string) {
    const thread = (threads.data ?? []).find((entry) => entry.noteId === noteId);
    if (!thread) return;

    followUp.mutate(
      { tokenHash: thread.tokenHash, body: followText[noteId] ?? '' },
      {
        onSuccess: () => {
          setFollowText((current) => ({ ...current, [noteId]: '' }));
          toast.success(t('voice.followUpSent'));
        },
        onError: (error) => toast.failure((error as Error).message),
      },
    );
  }

  return (
    <AppPage
      title={t('voice.title')}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([notes.refetch(), quota.refetch()])}
    >
      {/* Ein Satz, keine Listenzeile. */}
      <TextSection>{t('voice.quotaLeft', { count: quotaLeft })}</TextSection>
      <IonNote className="app-footnote">{t('voice.micPending')}</IonNote>

      {/* FR-144: Ist noch nichts da, trägt der Leerzustand den Knopf – nicht
          beide. */}
      {!isEmpty && (
        <div className="app-actions">
          <IonButton
            expand="block"
            disabled={quotaLeft <= 0}
            onClick={() => setOpen(true)}
          >
            {t('voice.write')}
          </IonButton>
        </div>
      )}

      {notes.isLoading ? (
        <SkeletonList />
      ) : notes.error ? (
        <ErrorState error={notes.error as Error} onRetry={() => void notes.refetch()} />
      ) : isEmpty ? (
        <EmptyState
          message={t('voice.empty')}
          action={
            quotaLeft > 0 ? { label: t('voice.write'), onClick: () => setOpen(true) } : undefined
          }
        />
      ) : (
        <>
          {/* UC-030, Schritte 2–3: der Eingang. Er steht zuoberst, weil ein
              unbeantwortetes Anliegen die dringendere Sache ist als das
              eigene, das bereits gesagt wurde. */}
          {inbox.length > 0 && (
            <ListSection title={t('voice.inbox')} footnote={t('voice.inboxHint')}>
              {inbox.map((note) => (
                <IonItem key={note.id} button detail onClick={() => setHandledId(note.id)}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`voice.kind.${note.kind}`)}</h2>
                    <p className="app-clamp-3">{note.transcript}</p>
                    <IonNote>{note.createdWeek}</IonNote>
                  </IonLabel>
                  <IonBadge slot="end" color={note.status === 'open' ? 'primary' : 'medium'}>
                    {t(`voice.status.${note.status}`)}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>
          )}

          {mine.length > 0 && (
            <ListSection title={t('voice.mine')} footnote={t('voice.listHint')}>
              {mine.map((note) => (
                <IonItem
                  key={note.id}
                  button
                  detail={false}
                  onClick={() => toggleExpanded(note.id)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`voice.kind.${note.kind}`)}</h2>
                    <p className={clampClass(note.id)}>{note.transcript}</p>
                    <IonNote>{note.createdWeek}</IonNote>
                    {note.response && (
                      <p className={clampClass(note.id)}>«{note.response}»</p>
                    )}
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

          {flagged.length > 0 && (
            <ListSection title={t('voice.flagged')} footnote={t('voice.flaggedHint')}>
              {flagged.map((note) => (
                <IonItem
                  key={note.id}
                  button
                  detail={false}
                  onClick={() => toggleExpanded(note.id)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`voice.kind.${note.kind}`)}</h2>
                    <p className={clampClass(note.id)}>{note.transcript}</p>
                    <IonNote>{note.createdWeek}</IonNote>
                  </IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {/* A1 und BR-129: der anonyme Rückkanal. Er hängt am Ticket dieses
              Geräts – nicht an der angemeldeten Person. Deshalb steht er auch
              dann hier, wenn die Abfrage oben nichts hergibt. */}
          {(threads.data ?? []).map((thread) => (
            <Fragment key={thread.noteId}>
              <ListSection
                title={t('voice.anonThread')}
                footnote={t('voice.anonThreadHint')}
              >
                <IonItem
                  lines="none"
                  button
                  detail={false}
                  onClick={() => toggleExpanded(thread.noteId)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t('voice.kind.anonymous')}</h2>
                    <p className={clampClass(thread.noteId)}>{thread.transcript}</p>
                    <IonNote>{thread.createdWeek}</IonNote>
                  </IonLabel>
                  <IonBadge slot="end" color="medium">
                    {t(`voice.status.${thread.status}`)}
                  </IonBadge>
                </IonItem>

                {thread.messages.map((message, index) => (
                  <IonItem key={`${thread.noteId}-${index}`}>
                    <IonLabel className="ion-text-wrap">
                      <h2>{t(`noteAnswer.side.${message.side}`)}</h2>
                      <p>{message.body}</p>
                      <IonNote>{formatDateTime(message.at)}</IonNote>
                    </IonLabel>
                  </IonItem>
                ))}

                <IonItem>
                  <IonTextarea
                    label={t('voice.followUp')}
                    labelPlacement="stacked"
                    autoGrow
                    rows={2}
                    value={followText[thread.noteId] ?? ''}
                    onIonInput={(e) =>
                      setFollowText((current) => ({
                        ...current,
                        [thread.noteId]: e.detail.value ?? '',
                      }))
                    }
                  />
                </IonItem>
              </ListSection>
              {/* Der Knopf steht als Knopfleiste unter der Liste – ein Item ist
                  eine Zeile, kein Behälter für einen Knopf. */}
              <div className="app-actions">
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={
                    (followText[thread.noteId] ?? '').trim().length === 0 ||
                    followUp.isPending
                  }
                  onClick={() => sendFollowUp(thread.noteId)}
                >
                  {t('voice.followUpSend')}
                </IonButton>
              </div>
            </Fragment>
          ))}
        </>
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
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
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
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                <IonSelectOption value="person">{t('voice.target.person')}</IonSelectOption>
                <IonSelectOption value="trainer">{t('voice.target.trainer')}</IonSelectOption>
                <IonSelectOption value="admin">{t('voice.target.admin')}</IonSelectOption>
                <IonSelectOption value="team">{t('voice.target.team')}</IonSelectOption>
              </IonSelect>
            </IonItem>

            {draft.target === 'person' && (
              <MemberSelect
                label={t('voice.person')}
                value={draft.targetMemberId}
                onChange={(memberId) =>
                  setDraft((current) => ({ ...current, targetMemberId: memberId }))
                }
              />
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
                  cancelText={t('common.cancel')}
                  okText={t('common.ok')}
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

      <NoteAnswerModal
        note={handled}
        onDismiss={() => setHandledId(null)}
        onDone={(outcome) => {
          setHandledId(null);
          toast.success(t(`voice.done.${outcome}`));
        }}
      />
    </AppPage>
  );
}
