import { useEffect, useState } from 'react';
import { IonInput, IonItem, IonToggle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useMyProfile, useUpdateMyProfile } from '../hooks/useProfile';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { ListSection } from './ListSection';

interface ProfileEditModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSaved: () => void;
}

/**
 * Der Inhalt des Profil-Blatts (UC-008, Schritte 3–6).
 *
 * Eigene Komponente, weil `IonModal` seinen Inhalt im Test nicht rendert
 * (docs/TESTING.md). Sichtbarkeit und Angabe stehen nebeneinander: Die Frage
 * «wer sieht das?» gehört an das Feld und nicht auf eine andere Seite.
 */
export function ProfileEditForm({
  onSaved,
  onDismiss,
  isOpen = true,
}: {
  onSaved: () => void;
  onDismiss: () => void;
  /** Das Blatt fährt mit `false` zu; der Inhalt bleibt, bis es unten ist. */
  isOpen?: boolean;
}) {
  const { t } = useTranslation();
  const profile = useMyProfile();
  const save = useUpdateMyProfile();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailPublic, setEmailPublic] = useState(false);
  const [phonePublic, setPhonePublic] = useState(false);

  // Den Entwurf aus dem geladenen Profil füllen.
  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName);
    setEmail(profile.data.email ?? '');
    setPhone(profile.data.phone ?? '');
    setEmailPublic(profile.data.emailPublic);
    setPhonePublic(profile.data.phonePublic);
  }, [profile.data]);

  return (
    <FormModal
      isOpen={isOpen}
      title={t('profile.editTitle')}
      // BR-031: Ein Mitglied trägt immer einen Anzeigenamen.
      canSubmit={displayName.trim().length >= 2}
      isSubmitting={save.isPending}
      error={save.error ? (save.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() =>
        save.mutate(
          { displayName, email, phone, emailPublic, phonePublic },
          { onSuccess: onSaved },
        )
      }
    >
      <ListSection footnote={t('profile.displayNameHint')}>
        <IonItem>
          <IonInput
            label={t('profile.displayName')}
            labelPlacement="stacked"
            autocapitalize="words"
            value={displayName}
            onIonInput={(e) => setDisplayName(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      <ListSection title={t('profile.contact')} footnote={t('profile.contactHint')}>
        <IonItem>
          <IonInput
            label={t('auth.email')}
            labelPlacement="stacked"
            type="email"
            inputmode="email"
            value={email}
            onIonInput={(e) => setEmail(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonToggle checked={emailPublic} onIonChange={(e) => setEmailPublic(e.detail.checked)}>
            {t('profile.emailVisible')}
          </IonToggle>
        </IonItem>

        <IonItem>
          <IonInput
            label={t('profile.phone')}
            labelPlacement="stacked"
            type="tel"
            inputmode="tel"
            value={phone}
            onIonInput={(e) => setPhone(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonToggle checked={phonePublic} onIonChange={(e) => setPhonePublic(e.detail.checked)}>
            {t('profile.phoneVisible')}
          </IonToggle>
        </IonItem>
      </ListSection>
    </FormModal>
  );
}


/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function ProfileEditModal({ isOpen, ...props }: ProfileEditModalProps) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <ProfileEditForm {...sheet} />;
}
