import { useMemo, useState } from 'react';
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonRadio,
  IonRadioGroup,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useCreateClub, useRedeemInvite } from '../../hooks/useOnboarding';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { InlineError } from '../../components/StateViews';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { CLUB_KINDS, defaultSeasonStart } from '../../lib/clubKind';
import type { ClubKind } from '../../lib/database.types';

type Mode = 'create' | 'join';

/**
 * Onboarding: gründen oder beitreten (UC-001, UC-002).
 *
 * Die Gründung läuft in drei Schritten – Name, Vereinsart, Saisonbeginn –, denn
 * mehr als drei Eingabeschritte sprengen die drei Minuten aus BR-004/NFR-024.
 * Die Vereinsart steuert dabei nur Vorlagen und schränkt nichts ein (BR-001).
 *
 * Der Formularzustand liegt hier und nicht im Wizard: Nach einem Fehlschlag
 * bleiben die Eingaben stehen, statt dass die Person sie neu tippt.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const createClub = useCreateClub();
  const redeemInvite = useRedeemInvite();

  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState(0);

  const [clubName, setClubName] = useState('');
  const [clubKind, setClubKind] = useState<ClubKind>('sport');
  const [kindLabel, setKindLabel] = useState('');
  // Leer heisst «noch nicht angefasst»: Der Vorschlag folgt dann der
  // Vereinsart, statt bei einem Wechsel auf einem alten Wert stehen zu bleiben.
  const [seasonStart, setSeasonStart] = useState('');

  const [inviteCode, setInviteCode] = useState('');

  const suggestedSeasonStart = useMemo(
    () => defaultSeasonStart(clubKind),
    [clubKind],
  );
  const effectiveSeasonStart = seasonStart || suggestedSeasonStart;

  const steps: WizardStep[] = [
    {
      id: 'name',
      title: t('onboarding.clubName'),
      hint: t('onboarding.clubNameHint'),
      isComplete: clubName.trim().length >= 2,
      content: (
        <ListSection>
          <IonItem>
            <IonInput
              label={t('onboarding.clubNameLabel')}
              labelPlacement="stacked"
              autocapitalize="words"
              value={clubName}
              onIonInput={(e) => setClubName(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      ),
    },
    {
      id: 'kind',
      title: t('onboarding.clubKindQuestion'),
      hint: t('onboarding.clubKindHint'),
      isComplete: clubKind !== 'other' || kindLabel.trim().length >= 2,
      content: (
        <>
          <ListSection>
            <IonRadioGroup
              value={clubKind}
              onIonChange={(e) => setClubKind(e.detail.value as ClubKind)}
            >
              {CLUB_KINDS.map((kind) => (
                <IonItem key={kind}>
                  <IonRadio value={kind} justify="start" labelPlacement="end">
                    {t(`onboarding.clubKind.${kind}`)}
                  </IonRadio>
                </IonItem>
              ))}
            </IonRadioGroup>
          </ListSection>

          {clubKind === 'other' && (
            <ListSection footnote={t('onboarding.clubKindOtherHint')}>
              <IonItem>
                <IonInput
                  label={t('onboarding.clubKindOther')}
                  labelPlacement="stacked"
                  value={kindLabel}
                  onIonInput={(e) => setKindLabel(e.detail.value ?? '')}
                />
              </IonItem>
            </ListSection>
          )}
        </>
      ),
    },
    {
      id: 'season',
      title: t('onboarding.seasonStartQuestion'),
      hint: t('onboarding.seasonStartHint'),
      isComplete: Boolean(effectiveSeasonStart),
      content: (
        <ListSection footnote={t('onboarding.seasonStartFootnote')}>
          <IonItem>
            <IonInput
              type="date"
              label={t('clubSettings.seasonStart')}
              labelPlacement="stacked"
              value={effectiveSeasonStart}
              onIonInput={(e) => setSeasonStart(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      ),
    },
  ];

  return (
    <AppPage title={t('onboarding.welcome')} largeTitle={false}>
      <div className="app-centered">
        <IonSegment
          value={mode}
          onIonChange={(e) => {
            setMode(e.detail.value as Mode);
            setStep(0);
          }}
        >
          <IonSegmentButton value="create">
            <IonLabel>{t('onboarding.createClub')}</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="join">
            <IonLabel>{t('onboarding.hasInvite')}</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </div>

      {mode === 'create' ? (
        <Wizard
          steps={steps}
          current={step}
          onCurrentChange={setStep}
          finishLabel={t('onboarding.createAndContinue')}
          isSubmitting={createClub.isPending}
          error={createClub.error ? (createClub.error as Error).message : null}
          onFinish={() =>
            createClub.mutate(
              {
                name: clubName,
                kind: clubKind,
                seasonStart: effectiveSeasonStart,
                kindLabel: clubKind === 'other' ? kindLabel : undefined,
              },
              {
                // Beim ersten Verein übernimmt das `RedirectIfClubMember`.
                // Bei einem weiteren (A3) ist die Weiche mit `?another=1`
                // ausgeschaltet – ohne diesen Sprung bliebe der Wizard stehen
                // und die nächste Eingabe gründete einen dritten Verein.
                onSuccess: () => navigate('/tabs/dashboard', { replace: true }),
              },
            )
          }
        />
      ) : (
        <>
          <ListSection footnote={t('onboarding.hasInviteHint')}>
            <IonItem>
              <IonInput
                label={t('onboarding.inviteCode')}
                labelPlacement="stacked"
                autocapitalize="off"
                value={inviteCode}
                onIonInput={(e) => setInviteCode(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {redeemInvite.error && (
            <InlineError message={(redeemInvite.error as Error).message} />
          )}

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={redeemInvite.isPending || inviteCode.trim().length < 4}
              onClick={() =>
                redeemInvite.mutate(
                  { code: inviteCode },
                  { onSuccess: () => navigate('/tabs/dashboard', { replace: true }) },
                )
              }
            >
              {redeemInvite.isPending ? (
                <IonSpinner name="crescent" />
              ) : (
                t('onboarding.joinNow')
              )}
            </IonButton>
          </div>
        </>
      )}

      <div className="app-actions">
        <IonButton fill="clear" size="small" onClick={() => void signOut()}>
          {t('auth.logout')}
        </IonButton>
      </div>
    </AppPage>
  );
}
