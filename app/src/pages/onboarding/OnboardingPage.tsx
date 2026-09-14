import { useMemo, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
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
import {
  useFindClub,
  useMyJoinRequest,
  useRequestJoin,
  useWithdrawJoinRequest,
  type ClubLookup,
} from '../../hooks/useJoinRequests';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { DateField } from '../../components/DateField';
import { InlineError } from '../../components/StateViews';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { CLUB_KINDS, defaultSeasonStart } from '../../lib/clubKind';
import { normaliseClubSlug } from '../../lib/joinRequest';
import type { ClubKind } from '../../lib/database.types';

type Mode = 'create' | 'join' | 'request';

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
  const findClub = useFindClub();
  const requestJoin = useRequestJoin();
  const withdrawRequest = useWithdrawJoinRequest();
  const myRequest = useMyJoinRequest();

  const [mode, setMode] = useState<Mode>('create');
  const [step, setStep] = useState(0);

  const [clubName, setClubName] = useState('');
  const [clubKind, setClubKind] = useState<ClubKind>('sport');
  const [kindLabel, setKindLabel] = useState('');
  // Leer heisst «noch nicht angefasst»: Der Vorschlag folgt dann der
  // Vereinsart, statt bei einem Wechsel auf einem alten Wert stehen zu bleiben.
  const [seasonStart, setSeasonStart] = useState('');

  const [inviteCode, setInviteCode] = useState('');
  const [clubSlug, setClubSlug] = useState('');
  const [foundClub, setFoundClub] = useState<ClubLookup | null>(null);
  const [lookupFailed, setLookupFailed] = useState(false);
  // §5: Das Zurückziehen ist ein Widerruf und wird vorher gefragt.
  const [isWithdrawing, setWithdrawing] = useState(false);

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
              enterkeyhint="next"
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
                  enterkeyhint="next"
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
          <DateField
            label={t('clubSettings.seasonStart')}
            presentation="date"
            value={effectiveSeasonStart}
            onChange={setSeasonStart}
          />
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
          <IonSegmentButton value="request">
            <IonLabel>{t('onboarding.requestJoin')}</IonLabel>
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
      ) : mode === 'request' ? (
        <>
          {/* Die eigene offene Anfrage geht allem vor: Ohne sie wüsste die
              Person nicht, dass sie wartet (A3 bietet den Rückzug an). */}
          {myRequest.data ? (
            <>
              <ListSection
                title={t('onboarding.requestPending')}
                footnote={t('onboarding.requestPendingHint')}
              >
                <IonItem>
                  <IonLabel className="ion-text-wrap">
                    <h2>{myRequest.data.clubName}</h2>
                    <IonNote>{t('onboarding.requestWaiting')}</IonNote>
                  </IonLabel>
                </IonItem>
              </ListSection>

              {withdrawRequest.error && (
                <InlineError message={(withdrawRequest.error as Error).message} />
              )}

              <div className="app-actions">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  disabled={withdrawRequest.isPending}
                  onClick={() => setWithdrawing(true)}
                >
                  {withdrawRequest.isPending ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    t('onboarding.withdrawRequest')
                  )}
                </IonButton>
              </div>

              <IonAlert
                isOpen={isWithdrawing}
                header={t('onboarding.withdrawRequest')}
                message={t('onboarding.withdrawConfirm')}
                onDidDismiss={() => setWithdrawing(false)}
                buttons={[
                  { text: t('common.cancel'), role: 'cancel' },
                  {
                    text: t('onboarding.withdrawRequest'),
                    role: 'destructive',
                    handler: () => withdrawRequest.mutate(myRequest.data!.id),
                  },
                ]}
              />
            </>
          ) : (
            <>
              <ListSection footnote={t('onboarding.clubSlugHint')}>
                <IonItem>
                  <IonInput
                    label={t('onboarding.clubSlug')}
                    labelPlacement="stacked"
                    autocapitalize="off"
                    // Ein Kürzel ist kein Wort – die Autokorrektur bliebe
                    // sonst an «tv-muster» hängen.
                    autocorrect={false}
                    enterkeyhint="search"
                    value={clubSlug}
                    onIonInput={(e) => {
                      setClubSlug(e.detail.value ?? '');
                      setFoundClub(null);
                      setLookupFailed(false);
                    }}
                  />
                </IonItem>
              </ListSection>

              {foundClub && (
                <ListSection title={t('onboarding.clubFound')}>
                  <IonItem>
                    <IonLabel className="ion-text-wrap">
                      <h2>{foundClub.clubName}</h2>
                      <IonNote>{t('onboarding.clubFoundHint')}</IonNote>
                    </IonLabel>
                  </IonItem>
                </ListSection>
              )}

              {lookupFailed && <InlineError message={t('onboarding.clubNotFound')} />}
              {findClub.error && (
                <InlineError message={(findClub.error as Error).message} />
              )}
              {requestJoin.error && (
                <InlineError message={(requestJoin.error as Error).message} />
              )}

              <div className="app-actions">
                {foundClub ? (
                  <IonButton
                    expand="block"
                    disabled={requestJoin.isPending}
                    onClick={() =>
                      requestJoin.mutate({ clubId: foundClub.clubId })
                    }
                  >
                    {requestJoin.isPending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      t('onboarding.sendRequest')
                    )}
                  </IonButton>
                ) : (
                  <IonButton
                    expand="block"
                    disabled={
                      findClub.isPending || normaliseClubSlug(clubSlug).length < 2
                    }
                    onClick={() =>
                      findClub.mutate(normaliseClubSlug(clubSlug), {
                        onSuccess: (club) => {
                          setFoundClub(club);
                          setLookupFailed(club === null);
                        },
                      })
                    }
                  >
                    {findClub.isPending ? (
                      <IonSpinner name="crescent" />
                    ) : (
                      t('onboarding.findClub')
                    )}
                  </IonButton>
                )}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <ListSection footnote={t('onboarding.hasInviteHint')}>
            <IonItem>
              <IonInput
                label={t('onboarding.inviteCode')}
                labelPlacement="stacked"
                autocapitalize="off"
                autocorrect={false}
                enterkeyhint="done"
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
