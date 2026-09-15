import { useState } from 'react';
import { IonNote, IonSegment, IonSegmentButton, IonLabel } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { FormModal } from './FormModal';
import { PulseSections } from './PulseSections';
import { ListSection } from './ListSection';
import { EmptyState, ErrorState } from './StateViews';
import { SkeletonList } from './Skeletons';
import { usePulsePayload, usePulsePreview } from '../hooks/usePulse';

interface PulsePreviewModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  pulseId: string | null;
  /** Die behaltenen Einträge; `null` heisst «noch nichts gestrichen». */
  keep: string[] | null;
}

/**
 * Die Vorschau des Vereins-Pulses (UC-050, FR-189).
 *
 * Zwei Ansichten desselben Pulses: das Blatt, wie es **in der App** erscheint,
 * und die Mail, wie sie **im Postfach** ankommt. Die zweite entsteht in der
 * Function `pulse-preview` mit demselben Renderer wie der Versand – die App
 * baut das Mailblatt ausdrücklich nicht nach.
 *
 * **Sie sendet nichts** (BR-249): kein Versand, kein Vermerk, keine Zählung,
 * und der Entwurf bleibt, wie er ist. Der Puls selbst geht erst mit
 * «Freigeben» hinaus.
 *
 * Kein `onSubmit`: Das Blatt zeigt nur an. Dann steht «Schliessen» links und
 * rechts nichts (guidelines.md §2).
 */
export function PulsePreviewModal({ isOpen, onDismiss, pulseId, keep }: PulsePreviewModalProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<'app' | 'mail'>('app');

  // **Beide Ansichten filtern serverseitig.** Die Auswahl des Vorstands geht
  // als `p_keep` in `pulse_payload()`, und dieselbe Funktion beantwortet die
  // App-Ansicht und – über `pulse-preview` – das Mailblatt. Ein Filter im
  // Client wäre eine zweite Abschrift derselben Regel.
  const payload = usePulsePayload(isOpen ? pulseId : null, keep);
  const mail = usePulsePreview(pulseId, keep, isOpen && view === 'mail');

  return (
    <FormModal isOpen={isOpen} title={t('pulse.previewTitle')} onDismiss={onDismiss}>
      <IonSegment
        value={view}
        onIonChange={(event) => setView(event.detail.value === 'mail' ? 'mail' : 'app')}
      >
        <IonSegmentButton value="app">
          <IonLabel>{t('pulse.previewApp')}</IonLabel>
        </IonSegmentButton>
        <IonSegmentButton value="mail">
          <IonLabel>{t('pulse.previewMail')}</IonLabel>
        </IonSegmentButton>
      </IonSegment>

      {view === 'app' ? (
        payload.isLoading ? (
          <SkeletonList />
        ) : payload.error ? (
          <ErrorState error={payload.error as Error} onRetry={() => void payload.refetch()} />
        ) : !payload.data ? (
          <EmptyState message={t('pulse.previewEmpty')} />
        ) : (
          <>
            <PulseSections
              intro={payload.data.intro}
              sections={payload.data.sections}
              greeting={payload.data.greeting}
            />
            {/* BR-114: Der persönliche Punktestand steht in der App nach den
                Abschnitten. In der Vorschau steht er nicht – er gehört jeder
                Person einzeln, und der Vorstand sieht hier den Puls, nicht
                seinen Punktestand. */}
            <IonNote className="app-footnote">{t('pulse.previewPointsHint')}</IonNote>
          </>
        )
      ) : mail.isLoading ? (
        <SkeletonList />
      ) : mail.error ? (
        <ErrorState error={mail.error as Error} onRetry={() => void mail.refetch()} />
      ) : mail.data ? (
        <ListSection title={mail.data.subject} footnote={t('pulse.previewMailHint')}>
          {/* `sandbox=""` nimmt dem Blatt jedes Recht: kein Skript, keine
              Navigation, kein Zugriff auf die App. Eine Mailvorlage braucht
              nichts davon – und was hier hineinkommt, ist Text aus der
              Datenbank. */}
          <iframe
            className="app-mail-preview"
            srcDoc={mail.data.html}
            sandbox=""
            title={mail.data.subject}
          />
        </ListSection>
      ) : (
        <EmptyState message={t('pulse.previewEmpty')} />
      )}
    </FormModal>
  );
}
