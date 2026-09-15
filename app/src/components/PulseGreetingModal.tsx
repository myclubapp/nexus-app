import { useState } from 'react';
import { IonItem, IonLabel, IonNote, IonSelect, IonSelectOption, IonTextarea } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { FormModal } from './FormModal';
import { ImagePicker } from './ImagePicker';
import { ListSection } from './ListSection';
import { EmptyState } from './StateViews';
import { useClub } from '../hooks/useClub';
import { useOffices, useSaveOfficeGreeting } from '../hooks/useOffices';
import { useSavePulseGreetingRole } from '../hooks/useClubSettings';
import { useToast } from '../hooks/useToast';
import { holderNames } from '../lib/office';
import { SUPPORTED_LANGUAGES, type Language } from '../i18n';
import type { LabelSet } from '../lib/clubSettings';

interface PulseGreetingModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/**
 * Die Grussformel am Vereins-Puls einrichten (UC-050, FR-191, FR-192).
 *
 * **Der Gruss hängt am Amt, die Wahl des Amts am Verein** (BR-252): Wechselt
 * die Besetzung, wechselt die Unterschrift mit, ohne dass hier jemand etwas
 * nachzieht. Deshalb zwei Schreibwege in einem Blatt – `set_office_greeting()`
 * für Text und Bild, die Vereinseinstellung für die Wahl des Amtes.
 *
 * **Vier Felder für den Text**, wie bei den Begriffen (BR-148): Ein Verein mit
 * welschen Mitgliedern grüsst sie auf Französisch. Wer nur eines ausfüllt,
 * grüsst alle damit – `pulse_payload()` fällt auf eine ausgefüllte Sprache
 * zurück und nicht auf eine Übersetzung, die niemand geschrieben hat.
 */
export function PulseGreetingModal({ isOpen, onDismiss }: PulseGreetingModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { activeClub } = useClub();
  const offices = useOffices();
  const saveGreeting = useSaveOfficeGreeting();
  const saveRole = useSavePulseGreetingRole();

  const boardOffices = (offices.data ?? []).filter((office) => office.isBoard);

  // **Kein Effekt, sondern abgeleitet.** Beides – Amt und Text – hat einen
  // hinterlegten Stand, und `null` heisst «noch nicht angefasst». Ein Effekt,
  // der den Stand in den Zustand kopiert, müsste auf `offices.data` und
  // `activeClub` hören; kommt eine dieser Referenzen je Rendern neu, dreht die
  // Seite endlos. Abgeleitet kann das nicht passieren, und der geladene Stand
  // erscheint auch dann, wenn die Abfrage erst nach dem Öffnen antwortet.
  const stored = activeClub?.settings?.pulse?.greetingRoleId ?? '';
  const [chosen, setChosen] = useState<string | null>(null);
  const [draft, setDraft] = useState<LabelSet | null>(null);

  const roleId = chosen ?? stored;
  const office = boardOffices.find((entry) => entry.id === roleId) ?? null;
  const text = draft ?? office?.greeting ?? {};
  const names = office ? holderNames(office.holders) : [];

  /** Beim Schliessen zurück auf den hinterlegten Stand – nicht auf leer. */
  function dismiss() {
    setChosen(null);
    setDraft(null);
    onDismiss();
  }

  function submit() {
    if (!office) return;
    saveGreeting.mutate(
      { roleId: office.id, greeting: text },
      {
        onSuccess: () => {
          saveRole.mutate(office.id, {
            onSuccess: () => {
              toast.success(t('pulse.greetingSaved'));
              dismiss();
            },
            onError: (cause) => toast.failure(cause.message),
          });
        },
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t('pulse.greetingTitle')}
      canSubmit={Boolean(office)}
      isSubmitting={saveGreeting.isPending || saveRole.isPending}
      onSubmit={submit}
      onDismiss={dismiss}
    >
      {boardOffices.length === 0 ? (
        <EmptyState
          message={t('pulse.noBoardOffice')}
          action={{ label: t('offices.title'), routerLink: '/tabs/profile/offices' }}
        />
      ) : (
        <>
          <ListSection title={t('pulse.greetingOffice')} footnote={t('pulse.greetingOfficeHint')}>
            <IonItem>
              <IonSelect
                label={t('pulse.greetingOffice')}
                labelPlacement="stacked"
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
                value={roleId}
                onIonChange={(event) => {
                  setChosen(String(event.detail.value ?? ''));
                  // Der Entwurf gehörte dem vorher gewählten Amt.
                  setDraft(null);
                }}
              >
                {boardOffices.map((entry) => (
                  <IonSelectOption key={entry.id} value={entry.id}>
                    {entry.title}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            {office && (
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <IonNote>
                    {/* A2: Ein vakantes Amt grüsst als Vorstand – das soll
                        dastehen, bevor jemand den Text schreibt. */}
                    {names.length > 0 ? names.join(', ') : t('pulse.vacantHint')}
                  </IonNote>
                </IonLabel>
              </IonItem>
            )}
          </ListSection>

          <ListSection title={t('pulse.greetingText')} footnote={t('pulse.greetingTextHint')}>
            {SUPPORTED_LANGUAGES.map((code) => (
              <IonItem key={code}>
                <IonTextarea
                  label={t(`language.${code}`)}
                  labelPlacement="stacked"
                  autoGrow
                  rows={2}
                  value={text[code as Language] ?? ''}
                  onIonInput={(event) =>
                    setDraft((current) => ({
                      ...(current ?? office?.greeting ?? {}),
                      [code]: event.detail.value ?? '',
                    }))
                  }
                />
              </IonItem>
            ))}
          </ListSection>

          {office && (
            <ImagePicker
              title={t('pulse.greetingImage')}
              footnote={t('pulse.greetingImageHint')}
              kind="greeting"
              ownerId={office.id}
              url={office.greetingImageUrl ?? null}
              onChange={(value) =>
                // Die Datei liegt schon; die Adresse gehört sofort in die
                // Spalte. Ein Bild, das erst beim Speichern ankommt, wäre bei
                // einem Abbruch eine verwaiste Datei ohne Verweis.
                saveGreeting.mutate(
                  { roleId: office.id, imageUrl: value?.url ?? '' },
                  {
                    onSuccess: () => toast.success(t('common.saved')),
                    onError: (cause) => toast.failure(cause.message),
                  },
                )
              }
            />
          )}
        </>
      )}
    </FormModal>
  );
}
