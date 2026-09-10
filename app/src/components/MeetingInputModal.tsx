import { useState } from 'react';
import {
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useOffices, useSubmitInput } from '../hooks/useMeeting';
import { useVoiceNotes } from '../hooks/useVoice';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { createAnonTicket, hashTicket, storeTicket } from '../lib/tickets';
import { MEETING_TICKET_KEY, validateInput } from '../lib/meeting';

interface MeetingInputProps {
  /** `ticketLost` sagt, ob der anonyme Rückweg auf diesem Gerät besteht. */
  onDone: (anonymous: boolean, ticketLost: boolean) => void;
  onDismiss: () => void;
}

/**
 * Einen Vorschlag an ein Gremium einreichen (UC-031, Schritte 1–5).
 *
 * Das Zielgremium ist eine **Menge Ämter**, kein benanntes Objekt (BR-133).
 * Damit stimmt der Verteiler nach einem Amtswechsel von selbst – aufgelöst
 * wird er zum Zustellzeitpunkt, in der Datenbank.
 *
 * Schritt 3 nennt auch das Sprachmemo. Aufnahme und Transkription fehlen
 * weiterhin (BR-125, offen seit UC-029); stattdessen lässt sich ein bestehendes
 * eigenes Anliegen als Quelle wählen – der Weg über UC-029, ohne Mikrofon.
 */
export function MeetingInputForm({ onDone, onDismiss }: MeetingInputProps) {
  const { t } = useTranslation();
  const offices = useOffices();
  const notes = useVoiceNotes();
  const submit = useSubmitInput();

  const [body, setBody] = useState('');
  const [committee, setCommittee] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [sourceNoteId, setSourceNoteId] = useState<string | null>(null);

  const problems = validateInput({
    body,
    committeeRoleIds: committee,
    anonymous,
    sourceNoteId,
  });

  // Nur eigene Anliegen taugen als Quelle: Fremdes Gesagtes in ein Gremium zu
  // tragen wäre ein Bruch von BR-123. Der Server prüft dasselbe.
  const ownNotes = (notes.data ?? []).filter((note) => note.isMine);

  async function send() {
    let tokenHash: string | null = null;
    let ticketLost = false;

    if (anonymous) {
      // A1: Das Ticket bleibt hier. Wer den Speicher löscht, verliert den
      // Rückweg – anders wäre es keine Anonymität.
      const ticket = createAnonTicket();
      tokenHash = await hashTicket(ticket);
      ticketLost = !storeTicket(MEETING_TICKET_KEY, ticket);
    }

    await submit.mutateAsync({
      body,
      committeeRoleIds: committee,
      anonymous,
      tokenHash,
      sourceNoteId,
    });

    onDone(anonymous, ticketLost);
  }

  return (
    <FormModal
      isOpen
      title={t('meeting.submitTitle')}
      submitLabel={t('meeting.submit')}
      canSubmit={problems.length === 0 && !submit.isPending}
      isSubmitting={submit.isPending}
      error={submit.error ? (submit.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() => void send().catch(() => undefined)}
    >
      {/* Schritt 3: der Vorschlag. */}
      <ListSection title={t('meeting.bodyTitle')} footnote={t('meeting.bodyHint')}>
        <IonItem>
          <IonTextarea
            label={t('meeting.bodyLabel')}
            labelPlacement="stacked"
            autoGrow
            rows={6}
            value={body}
            onIonInput={(e) => setBody(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {ownNotes.length > 0 && (
        <ListSection title={t('meeting.sourceTitle')} footnote={t('meeting.sourceHint')}>
          <IonItem>
            <IonSelect
              label={t('meeting.sourceLabel')}
              labelPlacement="stacked"
              value={sourceNoteId}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => setSourceNoteId((e.detail.value as string) || null)}
            >
              {ownNotes.map((note) => (
                <IonSelectOption key={note.id} value={note.id}>
                  {note.transcript.slice(0, 60)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>
      )}

      {/* Schritt 4: das Zielgremium – über Ämter, nicht über Namen (BR-133). */}
      <ListSection
        title={t('meeting.committeeTitle')}
        footnote={t('meeting.committeeHint')}
      >
        <IonItem>
          <IonSelect
            multiple
            label={t('meeting.committeeLabel')}
            labelPlacement="stacked"
            value={committee}
            cancelText={t('common.cancel')}
            okText={t('common.ok')}
            onIonChange={(e) => setCommittee(e.detail.value as string[])}
          >
            {(offices.data ?? []).map((office) => (
              <IonSelectOption key={office.id} value={office.id}>
                {office.title}
                {office.holderName ? ` – ${office.holderName}` : ''}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonItem>
      </ListSection>

      {/* Schritt 4: persönlich oder anonym. */}
      <ListSection
        title={t('meeting.identityTitle')}
        footnote={
          anonymous ? t('meeting.anonymousHint') : t('meeting.personalHint')
        }
      >
        <IonItem>
          <IonToggle
            checked={anonymous}
            onIonChange={(e) => setAnonymous(e.detail.checked)}
          >
            {t('meeting.anonymous')}
          </IonToggle>
        </IonItem>
      </ListSection>

      {offices.data?.length === 0 && (
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <IonNote>{t('meeting.noOffices')}</IonNote>
          </IonLabel>
        </IonItem>
      )}

      {problems.map((problem) => (
        <InlineError key={problem} message={t(`meeting.problem.${problem}`)} />
      ))}
    </FormModal>
  );
}
