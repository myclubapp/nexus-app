import { useMemo, useState } from 'react';
import {
  IonBadge,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonProgressBar,
} from '@ionic/react';
import { Share } from '@capacitor/share';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { ManageSection } from '../../components/ManageSection';
import { FormModal } from '../../components/FormModal';
import { MemberAvatar } from '../../components/MemberAvatar';
import { StatCard } from '../../components/StatCard';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useClub } from '../../hooks/useClub';
import { useToast } from '../../hooks/useToast';
import { deliverCsv } from '../../lib/csv';
import { canShareNatively } from '../../lib/invite';
import {
  useContributionOverview,
  useSetContributionGoal,
} from '../../hooks/useContributionGoal';
import {
  contributionCsv,
  goalColor,
  goalProgress,
  type ContributionRow,
} from '../../lib/contributionGoal';

/**
 * Die Beiträge der Saison (UC-042, FR-160).
 *
 * Diese Seite ist der Ersatz für die Helferpunkte-Liste der bisherigen App –
 * mit einem Unterschied: Es gibt nur ein Konto. Ist und Soll stehen in
 * derselben Einheit wie jede Punktzahl, der Zeitraum ist die Saison des
 * Vereins und nicht ein eigenes Datumspaar.
 *
 * **Nur der Vorstand.** Die Prüfung liegt in `contribution_overview()`; was
 * hier steht, ist Bequemlichkeit (guidelines §9) – und BR-201: Es gibt keine
 * Liste der Säumigen für die Mitgliedschaft.
 */
export function ContributionPage() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const overview = useContributionOverview();
  const setGoal = useSetContributionGoal();
  const toast = useToast();

  const [editing, setEditing] = useState<ContributionRow | null>(null);
  const [draft, setDraft] = useState('');

  const rows = useMemo(() => overview.data ?? [], [overview.data]);

  const counts = useMemo(
    () => ({
      reached: rows.filter((row) => row.state === 'reached').length,
      onTrack: rows.filter((row) => row.state === 'onTrack').length,
      open: rows.filter((row) => row.state === 'open').length,
    }),
    [rows],
  );

  // Ob überhaupt ein Ziel gilt. Ohne Ziel bleibt es bei einer Ist-Liste –
  // eine Ampel ohne Massstab gibt es nicht (A2).
  const hasGoal = rows.some((row) => row.goal !== null);

  function openEdit(row: ContributionRow) {
    setEditing(row);
    setDraft(row.goal === null ? '' : String(row.goal));
  }

  async function saveGoal() {
    if (!editing) return;
    const trimmed = draft.trim();
    // Leer heisst «es gilt das Vereinsziel», 0 heisst «befreit» (BR-200).
    const value = trimmed === '' ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      toast.failure(t('seasonGoal.goalInvalid'));
      return;
    }
    try {
      await setGoal.mutateAsync({ memberId: editing.member_id, goal: value });
      setEditing(null);
      toast.success(t('common.saved'));
    } catch (cause) {
      toast.failure(cause instanceof Error ? cause.message : t('common.error'));
    }
  }

  async function exportCsv() {
    const csv = contributionCsv(rows, [
      t('seasonGoal.csvName'),
      t('seasonGoal.csvEarned'),
      t('seasonGoal.csvGoal'),
      t('seasonGoal.csvRemaining'),
      t('seasonGoal.csvState'),
    ]);

    // Teilen, Zwischenablage und Datei stehen seit UC-043 einmal in
    // `lib/csv.ts` – der Mitglieder-Export braucht denselben Ablauf.
    const outcome = await deliverCsv({
      csv,
      fileName: `${activeClub?.slug ?? 'club'}-beitraege.csv`,
      title: t('seasonGoal.title'),
      canShareNatively: canShareNatively(),
      share: (input) => Share.share(input),
    });

    if (outcome === 'failed') {
      toast.failure(t('common.error'));
      return;
    }
    toast.success(
      outcome === 'copied' ? t('seasonGoal.copied') : t('seasonGoal.exported'),
    );
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('seasonGoal.title')} backHref="/tabs/profile">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage
      title={t('seasonGoal.title')}
      backHref="/tabs/profile"
      onRefresh={() => overview.refetch()}
    >
      {overview.isLoading ? (
        <SkeletonList rows={6} />
      ) : overview.error ? (
        <ErrorState
          error={overview.error as Error}
          onRetry={() => void overview.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={t('seasonGoal.empty')}
          action={{ label: t('members.title'), routerLink: '/tabs/profile/members' }}
        />
      ) : (
        <>
          {/* NFR-037: Ohne Ziel ist der Bildschirm nicht leer, aber er erklärt
              sich – und nennt den nächsten Schritt. */}
          {!hasGoal && (
            <EmptyState
              message={t('seasonGoal.noGoal')}
              action={{
                label: t('clubSettings.open'),
                routerLink: '/tabs/profile/club',
              }}
            />
          )}

          {hasGoal && (
            <div className="app-stat-row">
              <StatCard value={counts.reached} label={t('seasonGoal.reached')} />
              <StatCard
                value={counts.onTrack}
                label={t('seasonGoal.onTrack')}
                accent="secondary"
              />
              <StatCard
                value={counts.open}
                label={t('seasonGoal.open')}
                accent="tertiary"
              />
            </div>
          )}

          <ListSection
            title={t('seasonGoal.members')}
            footnote={t('seasonGoal.listHint')}
          >
            {rows.map((row) => (
              <IonItem key={row.member_id} button detail onClick={() => openEdit(row)}>
                <MemberAvatar
                  slot="start"
                  displayName={row.name ?? ''}
                  avatarUrl={row.avatar_url}
                />
                <IonLabel>
                  <h2>{row.name}</h2>
                  <p>
                    {row.state === 'exempt'
                      ? t('seasonGoal.exempt')
                      : row.goal === null
                        ? t('seasonGoal.earnedOnly', { points: row.earned })
                        : t('seasonGoal.remaining', { points: row.remaining })}
                  </p>
                  {row.goal !== null && row.goal > 0 && (
                    <IonProgressBar
                      className="app-goal-bar"
                      color={goalColor(row.state)}
                      value={goalProgress(row.earned, row.goal)}
                    />
                  )}
                </IonLabel>
                {/* §11 Nr. 18: die Zahl im Badge, der Wortlaut als aria-label. */}
                <IonBadge
                  slot="end"
                  color={goalColor(row.state)}
                  aria-label={t(`seasonGoal.state.${row.state}`)}
                >
                  {row.goal === null ? row.earned : `${row.earned}/${row.goal}`}
                </IonBadge>
              </IonItem>
            ))}
          </ListSection>

          <ManageSection
            actions={[
              {
                label: t('seasonGoal.export'),
                onClick: () => void exportCsv(),
              },
            ]}
          />
        </>
      )}

      <FormModal
        isOpen={editing !== null}
        title={editing?.name ?? t('seasonGoal.goalTitle')}
        onDismiss={() => setEditing(null)}
        onSubmit={() => void saveGoal()}
        isSubmitting={setGoal.isPending}
      >
        <ListSection footnote={t('seasonGoal.goalHint')}>
          <IonItem>
            <IonInput
              label={t('seasonGoal.goalLabel')}
              labelPlacement="stacked"
              type="number"
              inputmode="numeric"
              min={0}
              placeholder={t('seasonGoal.goalPlaceholder')}
              value={draft}
              onIonInput={(e) => setDraft(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
        <IonNote className="app-footnote">{t('seasonGoal.goalExempt')}</IonNote>
      </FormModal>
    </AppPage>
  );
}
