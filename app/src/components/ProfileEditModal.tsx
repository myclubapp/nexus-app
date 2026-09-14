import { useEffect, useState } from 'react';
import { IonInput, IonItem, IonToggle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useSetMemberAvatar } from '../hooks/useMedia';
import { useMyProfile, useUpdateMyProfile } from '../hooks/useProfile';
import { DateField } from './DateField';
import { ImagePicker } from './ImagePicker';
import { FormModal } from './FormModal';
import { useSheetProps } from '../hooks/useSheetProps';
import { useToast } from '../hooks/useToast';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';
import { NAME_MAX, validateProfileFields } from '../lib/member';

/** Heute im Formularformat – ein Geburtstag liegt nicht in der Zukunft (0081). */
function today(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

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
  const { activeMembership } = useClub();
  const setAvatar = useSetMemberAvatar();
  const toast = useToast();

  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailPublic, setEmailPublic] = useState(false);
  const [phonePublic, setPhonePublic] = useState(false);
  const [birthDate, setBirthDate] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  /**
   * BR-208: Solange niemand den Anzeigenamen von Hand angefasst hat, folgt er
   * Vor- und Nachname. Wer ihn ändert, behält ihn – ein Spitzname überlebt das
   * Nachtragen des bürgerlichen Namens.
   */
  const [nameTouched, setNameTouched] = useState(false);
  /** Wie beim Teambild: Die Vorschau soll sofort stimmen, nicht erst nach dem Nachladen. */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    activeMembership?.avatar_url ?? null,
  );

  // Den Entwurf aus dem geladenen Profil füllen.
  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName);
    setFirstName(profile.data.firstName ?? '');
    setLastName(profile.data.lastName ?? '');
    setEmail(profile.data.email ?? '');
    setPhone(profile.data.phone ?? '');
    setEmailPublic(profile.data.emailPublic);
    setPhonePublic(profile.data.phonePublic);
    setBirthDate(profile.data.birthDate ?? '');
    setStreet(profile.data.street ?? '');
    setHouseNumber(profile.data.houseNumber ?? '');
    setPostalCode(profile.data.postalCode ?? '');
    setCity(profile.data.city ?? '');
    setCountry(profile.data.country ?? '');
    setEmergencyName(profile.data.emergencyName ?? '');
    setEmergencyPhone(profile.data.emergencyPhone ?? '');
    // Ein gespeicherter Anzeigename, der nicht «Vorname Nachname» ist, ist
    // eine Entscheidung der Person.
    const derived = [profile.data.firstName, profile.data.lastName]
      .filter(Boolean)
      .join(' ');
    setNameTouched(derived !== '' && derived !== profile.data.displayName);
  }, [profile.data]);

  /**
   * Den Anzeigenamen nachführen, solange er niemandem gehört.
   *
   * Nur wenn **beide** Namen stehen – dieselbe Bedingung wie in
   * `update_my_profile()` (0081). Mit nur einem hiesse «Hans Muster» nach dem
   * Nachtragen des Vornamens plötzlich «Hans».
   */
  function syncDisplayName(first: string, last: string) {
    if (nameTouched) return;
    if (!first.trim() || !last.trim()) return;
    setDisplayName(`${first.trim()} ${last.trim()}`);
  }

  const problems = validateProfileFields({ firstName, lastName, country });

  return (
    <FormModal
      isOpen={isOpen}
      title={t('profile.editTitle')}
      // BR-031: Ein Mitglied trägt immer einen Anzeigenamen.
      canSubmit={displayName.trim().length >= 2 && problems.length === 0}
      isSubmitting={save.isPending}
      error={save.error ? (save.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() =>
        save.mutate(
          {
            displayName,
            firstName,
            lastName,
            email,
            phone,
            emailPublic,
            phonePublic,
            birthDate: birthDate || undefined,
            clearBirthDate: birthDate === '',
            street,
            houseNumber,
            postalCode,
            city,
            country: country.trim().toUpperCase(),
            emergencyName,
            emergencyPhone,
          },
          { onSuccess: onSaved },
        )
      }
    >
      {/* UC-045: Das Bild wird sofort gespeichert, nicht erst mit dem
          Formular – ein Foto ist kein Entwurf, und der Upload ist bereits
          geschehen, wenn die Adresse hier ankommt. */}
      {activeMembership && (
        <ImagePicker
          title={t('media.avatar')}
          footnote={t('media.avatarHint')}
          kind="members"
          ownerId={activeMembership.id}
          url={avatarUrl}
          disabled={setAvatar.isPending}
          onChange={(value) => {
            // In die Spalte geht der **Pfad** (0083); die Vorschau bekommt
            // ihn auch – `mediaUrl()` im `ImagePicker` macht eine Adresse
            // daraus.
            const next = value?.path ?? null;
            const previousUrl = avatarUrl;
            setAvatarUrl(next);
            setAvatar.mutate(
              { memberId: activeMembership.id, url: next, previousUrl },
              {
                // Erst hier ist es gespeichert – der `ImagePicker` meldet nur,
                // dass die Datei liegt (guidelines §11 Nr. 5).
                onSuccess: () =>
                  toast.success(next ? t('media.saved') : t('media.removed')),
                onError: (cause) => {
                  setAvatarUrl(previousUrl);
                  toast.failure((cause as Error).message);
                },
              },
            );
          }}
        />
      )}

      <ListSection footnote={t('profile.displayNameHint')}>
        <IonItem>
          <IonInput
            label={t('profile.firstName')}
            labelPlacement="stacked"
            autocapitalize="words"
            autocomplete="given-name"
            maxlength={NAME_MAX}
            enterkeyhint="next"
            value={firstName}
            onIonInput={(e) => {
              const value = e.detail.value ?? '';
              setFirstName(value);
              syncDisplayName(value, lastName);
            }}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.lastName')}
            labelPlacement="stacked"
            autocapitalize="words"
            autocomplete="family-name"
            maxlength={NAME_MAX}
            enterkeyhint="next"
            value={lastName}
            onIonInput={(e) => {
              const value = e.detail.value ?? '';
              setLastName(value);
              syncDisplayName(firstName, value);
            }}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.displayName')}
            labelPlacement="stacked"
            autocapitalize="words"
            enterkeyhint="next"
            value={displayName}
            onIonInput={(e) => {
              setDisplayName(e.detail.value ?? '');
              setNameTouched(true);
            }}
          />
        </IonItem>
        <DateField
          label={t('profile.birthDate')}
          value={birthDate}
          onChange={setBirthDate}
          presentation="date"
          max={today()}
          clearable
        />
      </ListSection>

      <ListSection title={t('profile.contact')} footnote={t('profile.contactHint')}>
        <IonItem>
          <IonInput
            label={t('auth.email')}
            labelPlacement="stacked"
            type="email"
            inputmode="email"
            enterkeyhint="next"
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
            enterkeyhint="next"
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

      {/* Konzept §3.1: Adresse – nur für die Person selbst und den Vorstand.
          Kein Schalter: Es gibt keine Sichtbarkeit zu wählen.

          In Feldern statt in einem Textfeld (BR-207): Ein Export, den der
          Kassier weiterverwendet, braucht Ort und Postleitzahl einzeln. Die
          Postleitzahl ist `inputmode="numeric"`, aber ein Textfeld – führende
          Nullen und «CH-» überleben eine Zahl nicht. */}
      <ListSection title={t('profile.address')} footnote={t('profile.addressHint')}>
        <IonItem>
          <IonInput
            label={t('profile.street')}
            labelPlacement="stacked"
            autocapitalize="words"
            autocomplete="address-line1"
            enterkeyhint="next"
            value={street}
            onIonInput={(e) => setStreet(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.houseNumber')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={houseNumber}
            onIonInput={(e) => setHouseNumber(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.postalCode')}
            labelPlacement="stacked"
            inputmode="numeric"
            autocomplete="postal-code"
            enterkeyhint="next"
            value={postalCode}
            onIonInput={(e) => setPostalCode(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.city')}
            labelPlacement="stacked"
            autocapitalize="words"
            autocomplete="address-level2"
            enterkeyhint="next"
            value={city}
            onIonInput={(e) => setCity(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.country')}
            labelPlacement="stacked"
            autocapitalize="characters"
            autocomplete="country"
            maxlength={2}
            placeholder={t("profile.countryPlaceholder")}
            enterkeyhint="next"
            value={country}
            onIonInput={(e) => setCountry((e.detail.value ?? '').toUpperCase())}
          />
        </IonItem>
      </ListSection>

      {problems.includes('countryCode') && (
        <InlineError message={t('profile.problem.countryCode')} />
      )}

      {/* Der Notfallkontakt: Die Fussnote sagt, wer ihn sieht – das ist die
          Frage, die jemand vor dem Eintragen hat. */}
      <ListSection title={t('profile.emergency')} footnote={t('profile.emergencyHint')}>
        <IonItem>
          <IonInput
            label={t('profile.emergencyName')}
            labelPlacement="stacked"
            autocapitalize="words"
            enterkeyhint="next"
            value={emergencyName}
            onIonInput={(e) => setEmergencyName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('profile.emergencyPhone')}
            labelPlacement="stacked"
            type="tel"
            inputmode="tel"
            enterkeyhint="done"
            value={emergencyPhone}
            onIonInput={(e) => setEmergencyPhone(e.detail.value ?? '')}
          />
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
