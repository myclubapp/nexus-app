import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useClub } from '../../hooks/useClub';
import type { ClubKind } from '../../lib/database.types';

const CLUB_KINDS: ClubKind[] = [
  'sport',
  'music',
  'culture',
  'youth',
  'neighborhood',
  'other',
];

/**
 * Onboarding ohne Sport-Fokus (MVP-Scope §6). Die Vereinsart steuert nur die
 * Vorlagen für Punkteregeln und Begriffe, nichts davon ist endgültig.
 */
export function OnboardingPage() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const { setActiveClub } = useClub();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [clubName, setClubName] = useState('');
  const [clubKind, setClubKind] = useState<ClubKind>('sport');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function createClub() {
    setBusy(true);
    setError(null);
    const { data: clubId, error: rpcError } = await supabase.rpc('create_club', {
      p_name: clubName.trim(),
      p_club_kind: clubKind,
    });
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    // Der frisch gegründete Verein wird der aktive – sonst entscheidet die
    // Reihenfolge der Mitgliedschaften, welchen die App anzeigt.
    if (clubId) setActiveClub(clubId);
    // busy bleibt gesetzt, bis die Mitgliedschaften neu geladen sind: sonst
    // ist der Knopf während des Nachladens wieder aktiv und ein zweiter
    // Klick gründet denselben Verein ein zweites Mal.
    await queryClient.invalidateQueries({ queryKey: ['memberships'] });
  }

  async function redeemInvite() {
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('redeem_invite', {
      p_code: inviteCode.trim(),
    });
    if (rpcError) {
      setBusy(false);
      setError(rpcError.message);
      return;
    }
    setInfo(t('onboarding.requestSent'));
    await queryClient.invalidateQueries({ queryKey: ['memberships'] });
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('onboarding.welcome')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="app-centered">
          <IonSegment
            value={mode}
            onIonChange={(e) => setMode(e.detail.value as 'create' | 'join')}
          >
            <IonSegmentButton value="create">
              <IonLabel>{t('onboarding.createClub')}</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="join">
              <IonLabel>{t('onboarding.hasInvite')}</IonLabel>
            </IonSegmentButton>
          </IonSegment>

          {mode === 'create' ? (
            <>
              <IonInput
                label={t('onboarding.clubName')}
                labelPlacement="stacked"
                fill="outline"
                value={clubName}
                onIonInput={(e) => setClubName(e.detail.value ?? '')}
              />

              <div>
                <IonLabel>
                  <h2>{t('onboarding.clubKindQuestion')}</h2>
                </IonLabel>
                <IonList inset>
                  {CLUB_KINDS.map((kind) => (
                    <IonItem
                      key={kind}
                      button
                      detail={false}
                      color={clubKind === kind ? 'light' : undefined}
                      onClick={() => setClubKind(kind)}
                    >
                      <IonLabel>{t(`onboarding.clubKind.${kind}`)}</IonLabel>
                    </IonItem>
                  ))}
                </IonList>
                <IonNote>{t('onboarding.clubKindHint')}</IonNote>
              </div>

              <IonButton
                expand="block"
                disabled={busy || clubName.trim().length < 2}
                onClick={() => void createClub()}
              >
                {busy ? <IonSpinner name="crescent" /> : t('onboarding.createAndContinue')}
              </IonButton>
            </>
          ) : (
            <>
              <IonInput
                label={t('onboarding.inviteCode')}
                labelPlacement="stacked"
                fill="outline"
                value={inviteCode}
                onIonInput={(e) => setInviteCode(e.detail.value ?? '')}
              />
              <IonNote>{t('onboarding.hasInviteHint')}</IonNote>
              <IonButton
                expand="block"
                disabled={busy || inviteCode.trim().length < 4}
                onClick={() => void redeemInvite()}
              >
                {busy ? <IonSpinner name="crescent" /> : t('common.next')}
              </IonButton>
            </>
          )}

          {error && <IonNote color="danger">{error}</IonNote>}
          {info && <IonNote color="success">{info}</IonNote>}

          <IonButton fill="clear" size="small" onClick={() => void signOut()}>
            {t('auth.logout')}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
}
