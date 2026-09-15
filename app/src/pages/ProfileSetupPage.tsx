import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonItem, IonLabel, IonNote, IonToggle } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AppPage } from '../components/AppPage';
import { ImagePicker } from '../components/ImagePicker';
import { ListSection } from '../components/ListSection';
import { TextSection } from '../components/TextSection';
import { Wizard, type WizardStep } from '../components/Wizard';
import { useClub } from '../hooks/useClub';
import { useSetMemberAvatar } from '../hooks/useMedia';
import { useFinishProfileSetup, useMyProfile, useUpdateMyProfile } from '../hooks/useProfile';
import { readPushReadiness, useRegisterPush } from '../hooks/usePushRegistration';
import { useToast } from '../hooks/useToast';
import { NAME_MAX } from '../lib/member';
import {
  isNameStepComplete,
  PROFILE_SETUP_STEPS,
  type ProfileSetupStepId,
} from '../lib/profileSetup';

/**
 * Das eigene Profil einrichten (UC-053, FR-200).
 *
 * **Das Gegenstück zu UC-051.** Dort richtet der Vorstand den Verein ein, hier
 * richtet sich die Person ein – vier Fragen, in der Reihenfolge, in der sie
 * für den Verein etwas ändern:
 *
 *   1. Ein Bild – es macht aus einer Zeile in der Mitgliederliste eine Person
 *   2. Der Name – solange er die E-Mail-Adresse ist, hat ihn niemand gewählt
 *   3. Die Telefonnummer und wer sie sieht
 *   4. Die Meldungen: E-Mail läuft bereits, Push will angemeldet werden
 *
 * **Jeder Schritt wirkt sofort** – dasselbe Versprechen wie beim
 * Vereins-Assistenten. Das Bild ist gespeichert, sobald es gewählt ist; Name
 * und Nummer gehen beim Weitergehen hinaus, nicht erst am Ende. Wer nach dem
 * zweiten Schritt weggeht, hat zwei Schritte erledigt und nicht keinen.
 *
 * **Der vierte Schritt ist der Grund, warum es diese Seite gibt.** Push
 * verlangt eine Erlaubnis, und eine Erlaubnisfrage, die unvermittelt auf dem
 * Dashboard aufpoppt, wird weggetippt – einmal abgelehnt, ist sie im Browser
 * nur noch über die Einstellungen des Betriebssystems zurückzuholen (A2).
 * Hier steht sie am Ende eines Gesprächs, das die Person selbst begonnen hat.
 */
export function ProfileSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();

  const { activeMembership } = useClub();
  const profile = useMyProfile();
  const save = useUpdateMyProfile();
  const setAvatar = useSetMemberAvatar();
  const finish = useFinishProfileSetup();
  const registerPush = useRegisterPush();

  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [phonePublic, setPhonePublic] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    activeMembership?.avatar_url ?? null,
  );
  const [pushDone, setPushDone] = useState(false);

  const readiness = readPushReadiness();

  // Der Bestand steht erst da, wenn die Abfrage zurück ist. Ohne diesen Effekt
  // beginnt der Assistent mit leeren Feldern und überschriebe beim ersten
  // «Weiter» einen bereits gepflegten Namen mit nichts.
  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName);
    setFirstName(profile.data.firstName ?? '');
    setLastName(profile.data.lastName ?? '');
    setPhone(profile.data.phone ?? '');
    setPhonePublic(profile.data.phonePublic);
  }, [profile.data]);

  /**
   * Was der sichtbare Schritt zu speichern hat.
   *
   * Der `Wizard` hält keinen Formularzustand; das Speichern gehört deshalb an
   * den Übergang. Gespeichert wird nur, was sich geändert hat – sonst schriebe
   * jedes Blättern eine Zeile in die Datenbank.
   */
  function persist(current: ProfileSetupStepId): Promise<void> {
    if (!profile.data) return Promise.resolve();

    if (current === 'name') {
      const unchanged =
        displayName === profile.data.displayName &&
        firstName === (profile.data.firstName ?? '') &&
        lastName === (profile.data.lastName ?? '');
      if (unchanged) return Promise.resolve();
      return save.mutateAsync({ displayName, firstName, lastName });
    }

    if (current === 'contact') {
      const unchanged =
        phone === (profile.data.phone ?? '') && phonePublic === profile.data.phonePublic;
      if (unchanged) return Promise.resolve();
      return save.mutateAsync({ phone, phonePublic });
    }

    return Promise.resolve();
  }

  function go(next: number) {
    void persist(PROFILE_SETUP_STEPS[step])
      .then(() => setStep(next))
      .catch((cause: unknown) => toast.failure((cause as Error).message));
  }

  /**
   * Fertig – oder für heute genug.
   *
   * Beides hält denselben Zeitpunkt fest (BR-270): Der Assistent geht danach
   * nicht mehr von selbst auf. Zurück führt die Karte auf dem Dashboard,
   * solange das Profil unangetastet ist, und die Zeile auf der Profilseite
   * immer.
   */
  function leave(finished: boolean) {
    void persist(PROFILE_SETUP_STEPS[step])
      .catch(() => {
        // Ein misslungener letzter Schritt darf den Ausstieg nicht versperren –
        // gespeichert ist, was die Schritte davor geschrieben haben.
      })
      .then(() => finish.mutateAsync())
      .then(() => {
        if (finished) toast.success(t('profileSetup.done'));
      })
      // Scheitert das Festhalten, sagt die App das – sonst meldete sie «Dein
      // Profil steht», während der Assistent beim nächsten Start wieder aufgeht.
      .catch((cause: unknown) => toast.failure((cause as Error).message))
      .finally(() => navigate('/tabs/dashboard', { replace: true }));
  }

  const content: Record<ProfileSetupStepId, WizardStep> = {
    photo: {
      id: 'photo',
      title: t('profileSetup.photo.title'),
      hint: t('profileSetup.photo.hint'),
      // Ein Bild ist ein Angebot, keine Bedingung.
      isComplete: true,
      content: activeMembership ? (
        <ImagePicker
          title={t('media.avatar')}
          footnote={t('media.avatarHint')}
          kind="members"
          ownerId={activeMembership.id}
          url={avatarUrl}
          disabled={setAvatar.isPending}
          onChange={(value) => {
            const next = value?.path ?? null;
            const previousUrl = avatarUrl;
            setAvatarUrl(next);
            setAvatar.mutate(
              { memberId: activeMembership.id, url: next, previousUrl },
              {
                onSuccess: () => toast.success(next ? t('media.saved') : t('media.removed')),
                onError: (cause) => {
                  setAvatarUrl(previousUrl);
                  toast.failure((cause as Error).message);
                },
              },
            );
          }}
        />
      ) : null,
    },

    name: {
      id: 'name',
      title: t('profileSetup.name.title'),
      hint: t('profileSetup.name.hint'),
      isComplete: isNameStepComplete({ displayName, firstName, lastName }),
      content: (
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
              onIonInput={(e) => setFirstName(e.detail.value ?? '')}
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
              onIonInput={(e) => setLastName(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('profile.displayName')}
              labelPlacement="stacked"
              maxlength={NAME_MAX}
              enterkeyhint="done"
              value={displayName}
              onIonInput={(e) => setDisplayName(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      ),
    },

    contact: {
      id: 'contact',
      title: t('profileSetup.contact.title'),
      hint: t('profileSetup.contact.hint'),
      isComplete: true,
      content: (
        <>
          <ListSection footnote={t('profileSetup.contact.visibility')}>
            <IonItem>
              <IonInput
                label={t('profile.phone')}
                labelPlacement="stacked"
                type="tel"
                autocomplete="tel"
                enterkeyhint="done"
                value={phone}
                onIonInput={(e) => setPhone(e.detail.value ?? '')}
              />
            </IonItem>
            <IonItem>
              <IonToggle
                checked={phonePublic}
                onIonChange={(e) => setPhonePublic(e.detail.checked)}
              >
                {t('profile.phonePublic')}
              </IonToggle>
            </IonItem>
          </ListSection>

          <TextSection title={t('profileSetup.contact.emailTitle')}>
            <p>{t('profileSetup.contact.emailNote', { email: profile.data?.email ?? '' })}</p>
          </TextSection>
        </>
      ),
    },

    notifications: {
      id: 'notifications',
      title: t('profileSetup.notifications.title'),
      hint: t('profileSetup.notifications.hint'),
      isComplete: true,
      content: (
        <>
          {/* Die E-Mail ist bereits eingestellt (BR-211: täglich um 18:00) –
              das ist der Grund, warum hier nur **eine** Frage steht. Wer sie
              anders will, findet die volle Matrix in den Einstellungen. */}
          <TextSection title={t('profileSetup.notifications.mailTitle')}>
            <p>{t('profileSetup.notifications.mailOn')}</p>
          </TextSection>

          <ListSection
            title={t('profileSetup.notifications.pushTitle')}
            /* Die Auskunft steht nur da, wenn sie etwas sagt: Bei «bereit»
               wäre «Bereit.» unter einem Knopf, der genau das anbietet, eine
               Zeile ohne Inhalt. */
            footnote={
              readiness === 'ready' ? undefined : t(`notifications.pushState.${readiness}`)
            }
          >
            {readiness === 'ready' && !pushDone && (
              <IonItem lines="none">
                <IonButton
                  slot="end"
                  size="default"
                  disabled={registerPush.isPending}
                  onClick={() =>
                    registerPush.mutate(undefined, {
                      onSuccess: (outcome) => {
                        setPushDone(outcome === 'registered');
                        if (outcome === 'registered') {
                          toast.success(t('notifications.deviceRegistered'));
                        } else {
                          // A2 ist kein Fehler, sondern eine Antwort – der
                          // Schritt bleibt trotzdem abschliessbar.
                          toast.failure(t('notifications.pushState.denied'));
                        }
                      },
                      onError: (cause) => toast.failure((cause as Error).message),
                    })
                  }
                >
                  {t('notifications.registerDevice')}
                </IonButton>
                <IonLabel className="ion-text-wrap">
                  <IonNote>{t('profileSetup.notifications.pushWhy')}</IonNote>
                </IonLabel>
              </IonItem>
            )}

            {pushDone && (
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  {t('profileSetup.notifications.pushOn')}
                </IonLabel>
              </IonItem>
            )}

            <IonItem button detail routerLink="/tabs/profile/notifications">
              <IonLabel className="ion-text-wrap">
                {t('profileSetup.notifications.more')}
              </IonLabel>
            </IonItem>
          </ListSection>
        </>
      ),
    },
  };

  return (
    <AppPage title={t('profileSetup.title')}>
      <Wizard
        steps={PROFILE_SETUP_STEPS.map((id) => content[id])}
        current={step}
        onCurrentChange={go}
        finishLabel={t('profileSetup.finish')}
        onFinish={() => leave(true)}
        isSubmitting={save.isPending || finish.isPending}
        onSkip={() => leave(false)}
        skipLabel={t('profileSetup.skip')}
      />
    </AppPage>
  );
}
