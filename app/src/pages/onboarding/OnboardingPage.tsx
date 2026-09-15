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
import { AuthShell } from '../../components/AuthShell';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { DateField } from '../../components/DateField';
import { InlineError } from '../../components/StateViews';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { CLUB_KINDS, defaultSeasonStart } from '../../lib/clubKind';
import { normaliseClubSlug } from '../../lib/joinRequest';
import { CLUB_SETUP_ROUTE } from '../../lib/clubSetup';
import type { ClubKind } from '../../lib/database.types';

type Mode = 'create' | 'join' | 'request';

/**
 * Onboarding: gründen oder beitreten (UC-001, UC-002, UC-004).
 *
 * **Dasselbe Gerüst wie die Anmeldung** (`AuthShell`): eine zentrierte Spalte
 * ohne Kopfzeile. Vorher war diese Seite eine `AppPage` mit Kopfzeile, und
 * darin lag nur das Segment in einer zentrierten Spalte – Eingabefelder und
 * Knopfleiste nahmen die volle Fensterbreite. Wer die Anmeldung hinter sich
 * hatte, landete auf einer Seite, die anders aussah als die davor, und auf
 * einem grossen Bildschirm zog sich das Namensfeld über die ganze Breite.
 *
 * Die Gründung läuft in drei Schritten – Name, Vereinsart, Saisonbeginn –, denn
 * mehr als drei Eingabeschritte sprengen die drei Minuten aus BR-004/NFR-024.
 * Die Vereinsart steuert dabei nur Vorlagen und schränkt nichts ein (BR-001).
 * Alles Weitere – Verband, Teams, Beispielinhalte, Mitglieder – fragt der
 * Einrichtungs-Assistent **nach** der Gründung (UC-051), und zwar
 * überspringbar: Der Verein ist ab Schritt 8 vollständig nutzbar (BR-002).
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
    <AuthShell
      title={t('onboarding.welcome')}
      subtitle={t('onboarding.subtitle')}
      wide
      footer={
        <>
          <LanguageSwitcher />
          <IonButton fill="clear" size="small" onClick={() => void signOut()}>
            {t('auth.logout')}
          </IonButton>
        </>
      }
    >
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
                // UC-001, Schritt 10 führt seit UC-051 in den Einrichtungs-
                // Assistenten und nicht auf das Dashboard: Verband, Teams,
                // Beispielinhalte und Mitglieder sind die vier Fragen, die
                // ein frisch gegründeter Verein danach hat. Überspringen
                // führt von dort aufs Dashboard.
                //
                // Der Sprung ist nötig: Beim ersten Verein übernähme sonst
                // `RedirectIfClubMember`, bei einem weiteren (A3) ist diese
                // Weiche ausgeschaltet – der Wizard bliebe stehen, und die
                // nächste Eingabe gründete einen dritten Verein.
                onSuccess: () => navigate(CLUB_SETUP_ROUTE, { replace: true }),
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
                      <IonNote>
                        {foundClub.acceptsRequests
                          ? t('onboarding.clubFoundHint')
                          : t('onboarding.clubClosedHint')}
                      </IonNote>
                    </IonLabel>
                  </IonItem>
                </ListSection>
              )}

              {/* BR-258: Der Verein hat diesen Weg nicht geöffnet. Das ist
                  kein Fehler der anfragenden Person – deshalb steht hier der
                  Weg, der bleibt, und keine rote Meldung. */}
              {foundClub && !foundClub.acceptsRequests && (
                <TextSection>
                  <p>{t('onboarding.clubClosedExplain')}</p>
                </TextSection>
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
                    disabled={requestJoin.isPending || !foundClub.acceptsRequests}
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
    </AuthShell>
  );
}
