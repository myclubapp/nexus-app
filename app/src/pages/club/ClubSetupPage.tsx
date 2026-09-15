import { useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonItem,
  IonLabel,
  IonNote,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Share } from '@capacitor/share';
import { AppPage } from '../../components/AppPage';
import { FederationConnectForm } from '../../components/FederationConnectForm';
import { FederationImportModal } from '../../components/FederationImportModal';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { EmptyState, InlineError } from '../../components/StateViews';
import { Wizard, type WizardStep } from '../../components/Wizard';
import { TeamCreate } from './TeamPage';
import { useClub } from '../../hooks/useClub';
import { useSaveJoinPolicy } from '../../hooks/useClubSettings';
import { useFederationConnections, useSetFederationNews } from '../../hooks/useFederation';
import { useCreateInvite, useTeams, defaultInviteExpiry } from '../../hooks/useInvites';
import { useCreateTeam } from '../../hooks/useMembers';
import { useImportFederationTeams } from '../../hooks/useTeamAdmin';
import { useDropSampleContent, useSampleContent } from '../../hooks/useSample';
import { useToast } from '../../hooks/useToast';
import {
  clampStep,
  newsToggleMessageKey,
  setupSteps,
  type SetupStepId,
} from '../../lib/clubSetup';
import { deliversNews, type Federation } from '../../lib/federation';
import { canShareNatively, inviteLink } from '../../lib/invite';
import { composeTeamName } from '../../lib/team';

/**
 * Den Verein einrichten (UC-051).
 *
 * **Das ist nicht die Gründung.** Die bleibt bei drei Eingabeschritten
 * (BR-004), und der Verein ist danach vollständig nutzbar (BR-002). Dieser
 * Assistent führt durch die vier Fragen, die ein frisch gegründeter Verein
 * danach tatsächlich hat, und jede einzelne darf unbeantwortet bleiben:
 *
 *   1. Hängt ihr an einem Verband? – dann kommen Spielplan und Teams von dort
 *   2. Wollt ihr auch seine Beiträge im Feed? – nur, wenn 1 beantwortet wurde
 *   3. Wie heissen eure Teams? – von Hand oder aus dem Verband übernommen
 *   4. Die Beispielinhalte – behalten oder weg
 *   5. Wie kommen die Mitglieder herein? – Einladung, und ob offene Anfragen
 *      einen Weg haben (FR-196)
 *
 * **Warum eine Schrittführung und keine Einstellungsseite:** Wer eben einen
 * Verein gegründet hat, weiss nicht, was er als Nächstes braucht – eine Seite
 * mit fünfzehn Schaltern beantwortet diese Frage nicht. Eine Frage nach der
 * anderen tut es (NFR-024, dasselbe Muster wie die Gründung).
 *
 * Jeder Schritt wirkt **sofort**: Der Verband ist verbunden, sobald der
 * Testaufruf trägt; das Team steht, sobald es angelegt ist. Der Assistent
 * sammelt nichts ein, was am Ende gemeinsam gespeichert würde – wer nach dem
 * zweiten Schritt weggeht, hat zwei Schritte erledigt und nicht keinen.
 */
export function ClubSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeClub, isAdmin } = useClub();

  const connections = useFederationConnections();
  const setNews = useSetFederationNews();
  const teams = useTeams();
  const createTeam = useCreateTeam();
  const importTeams = useImportFederationTeams();
  const samples = useSampleContent();
  const dropSamples = useDropSampleContent();
  const createInvite = useCreateInvite();
  const saveJoinPolicy = useSaveJoinPolicy();

  const [step, setStep] = useState(0);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [importing, setImporting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [confirmDrop, setConfirmDrop] = useState(false);

  const entries = connections.data ?? [];
  const ids = setupSteps(entries.length > 0);
  const current = clampStep(step, ids);
  const isPublic = activeClub?.settings?.join?.public === true;

  /**
   * Fertig – oder für heute genug. Beides endet auf dem Dashboard: Dort steht
   * die «Erste Schritte»-Karte, solange der Verein neu ist, und über sie führt
   * der Weg zurück hierher (BR-259).
   */
  function leave() {
    navigate('/tabs/dashboard', { replace: true });
  }

  /**
   * Der Schalter des vierten Schritts. Was dabei geschieht – einschalten und
   * sofort abgleichen –, steht in `useSetFederationNews()`, genau wie auf der
   * Verbandsseite: eine Regel, eine Stelle.
   */
  function toggleNews(federation: Federation, enabled: boolean) {
    setNews.mutate(
      { federation, enabled },
      {
        onSuccess: (result) =>
          toast.success(
            t(newsToggleMessageKey(result), { reason: result.syncError ?? '' }),
          ),
        onError: (cause) => toast.failure((cause as Error).message),
      },
    );
  }

  /**
   * Ein Einladungslink mit den Vorgaben: ganzer Verein, Rolle Mitglied, zwei
   * Wochen gültig, unbegrenzt einlösbar. Wer es genauer will, findet die
   * Einladungen in der Vereinsverwaltung – hier geht es darum, dass überhaupt
   * jemand hereinkommt.
   */
  function createDefaultInvite() {
    createInvite.mutate(
      { teamId: null, role: 'member', expiresOn: defaultInviteExpiry(), maxUses: null },
      { onSuccess: (invite) => setInviteUrl(inviteLink(invite.code)) },
    );
  }

  async function shareInvite(url: string) {
    if (canShareNatively()) {
      try {
        await Share.share({ title: t('invite.shareTitle'), url });
        return;
      } catch {
        // Abbruch im Teilen-Dialog ist kein Fehler – dann bleibt Kopieren.
      }
    }
    await navigator.clipboard?.writeText(url);
    toast.success(t('invite.copied'));
  }

  const content: Record<SetupStepId, WizardStep> = {
    federation: {
      id: 'federation',
      title: t('clubSetup.federation.title'),
      hint: t('clubSetup.federation.hint'),
      isComplete: true,
      content: (
        <>
          {entries.length > 0 && (
            <ListSection title={t('clubSetup.federation.connected')}>
              {entries.map((entry) => (
                <IonItem key={entry.federation} lines="none">
                  <IonLabel className="ion-text-wrap">
                    {t(`federation.name.${entry.federation}`)}
                  </IonLabel>
                  <IonBadge slot="end" color="success">
                    {t('federation.statusLabel.active')}
                  </IonBadge>
                </IonItem>
              ))}
            </ListSection>
          )}

          <FederationConnectForm
            onConnected={() => {
              toast.success(t('federation.connected'));
              void connections.refetch();
            }}
          />
        </>
      ),
    },

    news: {
      id: 'news',
      title: t('clubSetup.news.title'),
      hint: t('clubSetup.news.hint'),
      isComplete: true,
      content: (
        <ListSection footnote={t('federation.newsHint')}>
          {entries.map((entry) =>
            deliversNews(entry.federation) ? (
              <IonItem key={entry.federation}>
                <IonToggle
                  checked={entry.newsEnabled}
                  disabled={setNews.isPending}
                  onIonChange={(e) => toggleNews(entry.federation, e.detail.checked)}
                >
                  <IonLabel className="ion-text-wrap">
                    {t(`federation.name.${entry.federation}`)}
                  </IonLabel>
                </IonToggle>
              </IonItem>
            ) : (
              /* Kein Schalter, der nichts bewirkt – der Satz sagt, warum
                 (BR-260). */
              <IonItem key={entry.federation} lines="none">
                <IonLabel className="ion-text-wrap">
                  <h2>{t(`federation.name.${entry.federation}`)}</h2>
                  <IonNote>{t('federation.newsUnavailable')}</IonNote>
                </IonLabel>
              </IonItem>
            ),
          )}
        </ListSection>
      ),
    },

    teams: {
      id: 'teams',
      title: t('clubSetup.teams.title'),
      hint: t('clubSetup.teams.hint'),
      isComplete: true,
      content: (
        <>
          {(teams.data ?? []).length === 0 ? (
            /* FR-144: erklären **und** einen nächsten Schritt anbieten. */
            <EmptyState
              message={t('clubSetup.teams.empty')}
              action={{
                label: t('members.addTeam'),
                onClick: () => setCreatingTeam(true),
              }}
            />
          ) : (
            <ListSection title={t('teams.title')}>
              {(teams.data ?? []).map((team) => (
                <IonItem key={team.id} lines="none">
                  <IonLabel className="ion-text-wrap">{team.name}</IonLabel>
                </IonItem>
              ))}
            </ListSection>
          )}

          {(createTeam.error || importTeams.error) && (
            <InlineError
              message={
                (createTeam.error as Error | null)?.message ??
                (importTeams.error as Error).message
              }
            />
          )}

          <div className="app-actions">
            <IonButton expand="block" fill="outline" onClick={() => setCreatingTeam(true)}>
              {t('members.addTeam')}
            </IonButton>
            {/* UC-039 A1: Mit verbundenem Verband gibt es den kürzeren Weg. */}
            {entries.length > 0 && (
              <IonButton expand="block" fill="outline" onClick={() => setImporting(true)}>
                {t('teams.import')}
              </IonButton>
            )}
          </div>
        </>
      ),
    },

    samples: {
      id: 'samples',
      title: t('clubSetup.samples.title'),
      hint: t('clubSetup.samples.hint'),
      isComplete: true,
      content: (
        <>
          <TextSection>
            <p>{t('clubSetup.samples.explain')}</p>
          </TextSection>

          {/* Kein `EmptyState`: Das ist keine leere Ansicht, sondern die
              Antwort auf die Frage dieses Schritts – es gibt nichts
              aufzuräumen. Der nächste Schritt ist der Knopf des Assistenten
              (FR-144 gilt Seiten, nicht Sätzen). */}
          {(samples.data ?? []).length === 0 ? (
            <ListSection>
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <IonNote>{t('clubSetup.samples.none')}</IonNote>
                </IonLabel>
              </IonItem>
            </ListSection>
          ) : (
            <>
              <ListSection title={t('sample.sectionTitle')}>
                {(samples.data ?? []).slice(0, 5).map((item) => (
                  <IonItem key={`${item.kind}-${item.id}`} lines="none">
                    <IonLabel className="ion-text-wrap">
                      <h2>{item.title}</h2>
                      <IonNote>{t(`sample.kind.${item.kind}`)}</IonNote>
                    </IonLabel>
                    <IonBadge slot="end" color="medium">
                      {t('sample.badge')}
                    </IonBadge>
                  </IonItem>
                ))}
              </ListSection>

              {/* §5: Ein Entfernen wird vorher gefragt, nicht nachher
                  gemeldet – derselbe Weg wie in den Vereinseinstellungen. */}
              <div className="app-actions">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  disabled={dropSamples.isPending}
                  onClick={() => setConfirmDrop(true)}
                >
                  {t('sample.drop')}
                </IonButton>
              </div>
            </>
          )}
        </>
      ),
    },

    members: {
      id: 'members',
      title: t('clubSetup.members.title'),
      hint: t('clubSetup.members.hint'),
      isComplete: true,
      content: (
        <>
          {inviteUrl ? (
            <ListSection title={t('clubSetup.members.linkReady')} footnote={inviteUrl}>
              <IonItem button detail={false} onClick={() => void shareInvite(inviteUrl)}>
                <IonLabel className="ion-text-wrap">{t('invite.share')}</IonLabel>
              </IonItem>
            </ListSection>
          ) : (
            <div className="app-actions">
              <IonButton
                expand="block"
                fill="outline"
                disabled={createInvite.isPending}
                onClick={createDefaultInvite}
              >
                {t('clubSetup.members.createLink')}
              </IonButton>
            </div>
          )}

          {createInvite.error && (
            <InlineError message={(createInvite.error as Error).message} />
          )}

          {/* FR-196: der zweite Weg hinein – und er ist zu, bis der Vorstand
              ihn öffnet (BR-258). */}
          <ListSection
            title={t('clubSettings.joinPublic')}
            footnote={t('clubSettings.joinPublicHint', { slug: activeClub?.slug ?? '' })}
          >
            <IonItem>
              <IonToggle
                checked={isPublic}
                disabled={saveJoinPolicy.isPending}
                onIonChange={(e) =>
                  saveJoinPolicy.mutate(e.detail.checked, {
                    onError: (cause) => toast.failure((cause as Error).message),
                  })
                }
              >
                <IonLabel className="ion-text-wrap">{t('clubSettings.joinPublic')}</IonLabel>
              </IonToggle>
            </IonItem>
          </ListSection>

          <div className="app-actions">
            <IonButton expand="block" fill="clear" routerLink="/tabs/profile/invite">
              {t('clubSetup.members.moreInvites')}
            </IonButton>
          </div>
        </>
      ),
    },
  };

  if (!isAdmin) {
    return (
      <AppPage title={t('clubSetup.title')} backHref="/tabs/profile" largeTitle={false}>
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={t('clubSetup.title')} backHref="/tabs/profile" largeTitle={false}>
      <Wizard
        steps={ids.map((id) => content[id])}
        current={current}
        onCurrentChange={setStep}
        finishLabel={t('clubSetup.finish')}
        onFinish={leave}
        onSkip={leave}
        skipLabel={t('clubSetup.later')}
      />

      <TeamCreate
        isOpen={creatingTeam}
        teams={teams.data ?? []}
        isSubmitting={createTeam.isPending || importTeams.isPending}
        error={
          (createTeam.error as Error | null)?.message ??
          (importTeams.error as Error | null)?.message ??
          null
        }
        onDismiss={() => setCreatingTeam(false)}
        onSubmit={({ name, pick, addition }) => {
          const done = (message: string) => {
            setCreatingTeam(false);
            toast.success(message);
            void teams.refetch();
          };
          if (pick) {
            // UC-039, Schritte 8 und 9: anlegen, verknüpfen, Spiele holen.
            importTeams.mutate(
              {
                federation: pick.federation,
                items: [
                  {
                    federation_team_id: pick.remote.id,
                    name: pick.remote.name,
                    league: pick.remote.league,
                    team_id: null,
                    name_addition: addition || null,
                  },
                ],
              },
              {
                onSuccess: ({ sync }) => {
                  const teamName = composeTeamName(pick.remote.name, addition);
                  done(
                    sync.games === null
                      ? t('teams.linkedPending', { name: teamName, reason: sync.error })
                      : t('teams.linkedGames', { name: teamName, count: sync.games }),
                  );
                },
              },
            );
            return;
          }
          createTeam.mutate(name, { onSuccess: () => done(t('members.teamCreated')) });
        }}
      />

      <IonAlert
        isOpen={confirmDrop}
        header={t('sample.drop')}
        message={t('sample.dropConfirm')}
        onDidDismiss={() => setConfirmDrop(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('sample.drop'),
            role: 'destructive',
            handler: () =>
              dropSamples.mutate(undefined, {
                onSuccess: (count) => toast.success(t('sample.dropped', { count })),
                onError: (cause) => toast.failure(cause.message),
              }),
          },
        ]}
      />

      <FederationImportModal
        isOpen={importing}
        teams={teams.data ?? []}
        onDismiss={() => setImporting(false)}
        onDone={({ created, linked, sync }) => {
          setImporting(false);
          void teams.refetch();
          toast.success(
            sync.games === null
              ? t('teams.importedPending', { created, linked, reason: sync.error })
              : t('teams.importedGames', { created, linked, count: sync.games }),
          );
        }}
      />
    </AppPage>
  );
}
