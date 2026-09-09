import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { usePendingJoinRequests } from '../hooks/useJoinRequests';

/**
 * Die Verwaltungswege des Vorstands als Listeneinträge.
 *
 * Sie stehen an zwei Stellen – im Seitenmenü (`AppMenu`) und auf der
 * Profilseite – und dürfen dort nicht auseinanderlaufen. Eine neue
 * Verwaltungsansicht wird genau hier eingehängt, nicht ein zweites Mal.
 *
 * Ohne Vorstandsrolle rendert die Komponente nichts. Das ist Bequemlichkeit,
 * kein Schutz: Die Berechtigung liegt in den RLS-Policies und in
 * `is_club_admin()` (§9).
 */
export function ClubAdminLinks() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const pendingRequests = usePendingJoinRequests();

  if (!isAdmin) return null;

  const pending = pendingRequests.data?.length ?? 0;

  return (
    <>
      <IonItem button routerLink="/tabs/profile/club" detail>
        <IonLabel>
          <h2>{t('clubSettings.open')}</h2>
          <IonNote>{activeClub?.name}</IonNote>
        </IonLabel>
      </IonItem>

      <IonItem button routerLink="/tabs/profile/members" detail>
        <IonLabel>{t('members.title')}</IonLabel>
      </IonItem>

      <IonItem button routerLink="/tabs/profile/rules" detail>
        <IonLabel>{t('pointRules.title')}</IonLabel>
      </IonItem>

      <IonItem button routerLink="/tabs/profile/invite" detail>
        <IonLabel>{t('invite.title')}</IonLabel>
      </IonItem>

      <IonItem button routerLink="/tabs/profile/requests" detail>
        <IonLabel>{t('joinRequest.title')}</IonLabel>
        {pending > 0 && (
          <IonBadge slot="end" color="danger">
            {pending}
          </IonBadge>
        )}
      </IonItem>
    </>
  );
}
