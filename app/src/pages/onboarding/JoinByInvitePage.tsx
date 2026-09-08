import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonItem, IonLabel, IonNote, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClub } from '../../hooks/useClub';
import { useInvitePreview } from '../../hooks/useInvites';
import { useRedeemInvite } from '../../hooks/useOnboarding';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { ErrorState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { setPendingInvite, takePendingInvite } from '../../lib/invite';

/**
 * Einladung öffnen und einlösen (UC-002).
 *
 * Der Ablauf hält sich an die 60 Sekunden aus BR-007: ansehen, anmelden falls
 * nötig, Namen bestätigen, fertig. Wer schon Mitglied ist, landet ohne weitere
 * Frage im Verein (A3).
 */
export function JoinByInvitePage() {
  const { t } = useTranslation();
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { session, initialising } = useAuth();
  const { memberships } = useClub();

  const preview = useInvitePreview(code);
  const redeem = useRedeemInvite();
  const [displayName, setDisplayName] = useState('');

  // UC-005 A4: Ohne Sitzung führt der Weg über die Anmeldung und danach
  // hierher zurück. Der Code überlebt den Umweg im Sitzungsspeicher.
  useEffect(() => {
    if (initialising) return;
    if (!session && code) {
      setPendingInvite(code);
      navigate('/login', { replace: true });
      return;
    }
    // Angekommen: Der gemerkte Code hat seinen Zweck erfüllt.
    if (session) takePendingInvite();
  }, [initialising, session, code, navigate]);

  if (initialising || preview.isLoading) {
    return (
      <AppPage title={t('invite.joinTitle')} largeTitle={false}>
        <SkeletonList rows={3} />
      </AppPage>
    );
  }

  if (preview.error) {
    return (
      <AppPage title={t('invite.joinTitle')} largeTitle={false}>
        <ErrorState
          error={preview.error as Error}
          onRetry={() => void preview.refetch()}
        />
      </AppPage>
    );
  }

  const data = preview.data;

  // A1 abgelaufen, A2 ausgeschöpft, widerrufen oder unbekannt: Der Grund wird
  // benannt und der andere Weg angeboten (Beitritts-Anfrage, UC-004).
  if (!data?.isValid) {
    return (
      <AppPage title={t('invite.joinTitle')} largeTitle={false}>
        <ListSection footnote={t('invite.invalidHint')}>
          <IonItem>
            <IonLabel className="ion-text-wrap">
              <h2>{t(`invite.invalid.${data?.reason ?? 'unknown'}`)}</h2>
              {data?.clubName && <IonNote>{data.clubName}</IonNote>}
            </IonLabel>
          </IonItem>
        </ListSection>

        <div className="app-actions">
          <IonButton expand="block" routerLink="/onboarding">
            {t('invite.requestInstead')}
          </IonButton>
        </div>
      </AppPage>
    );
  }

  const alreadyMember = memberships.some(
    (membership) => membership.club_id === data.clubId,
  );

  return (
    <AppPage title={t('invite.joinTitle')} largeTitle={false}>
      <ListSection title={t('invite.youAreInvited')}>
        <IonItem>
          <IonLabel>{t('leaderboard.club')}</IonLabel>
          <IonNote slot="end">{data.clubName}</IonNote>
        </IonItem>
        {data.teamName && (
          <IonItem>
            <IonLabel>{t('leaderboard.team')}</IonLabel>
            <IonNote slot="end">{data.teamName}</IonNote>
          </IonItem>
        )}
        <IonItem>
          <IonLabel>{t('invite.roleLabel')}</IonLabel>
          <IonNote slot="end">{t(`invite.role.${data.role ?? 'member'}`)}</IonNote>
        </IonItem>
      </ListSection>

      {!alreadyMember && (
        <ListSection footnote={t('invite.displayNameHint')}>
          <IonItem>
            <IonInput
              label={t('invite.displayName')}
              labelPlacement="stacked"
              autocapitalize="words"
              value={displayName}
              onIonInput={(e) => setDisplayName(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      )}

      {alreadyMember && (
        <IonNote className="app-hint">{t('invite.alreadyMember')}</IonNote>
      )}

      {redeem.error && <InlineError message={(redeem.error as Error).message} />}

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={redeem.isPending || (!alreadyMember && displayName.trim().length < 2)}
          onClick={() =>
            redeem.mutate(
              { code: code!, displayName: displayName.trim() || undefined },
              {
                // A3: Auch wer schon Mitglied war, landet im Verein – die
                // Mitgliedschaft bleibt dabei unverändert.
                onSuccess: () => navigate('/tabs/dashboard', { replace: true }),
              },
            )
          }
        >
          {redeem.isPending ? <IonSpinner name="crescent" /> : t('invite.joinNow')}
        </IonButton>
      </div>
    </AppPage>
  );
}
