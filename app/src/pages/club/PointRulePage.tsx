import { useMemo, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../hooks/useClub';
import {
  useAllPointRules,
  useCreatePointRule,
  useSetPillarActive,
  useUpdatePointRule,
} from '../../hooks/usePointRules';
import { useToast } from '../../hooks/useToast';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState } from '../../components/StateViews';
import {
  LIMIT_PERIODS,
  PILLARS,
  groupByPillar,
  isCodeAvailable,
  isThanksOnly,
  readRuleLimit,
  type LimitPeriod,
  type Pillar,
} from '../../lib/pointRule';
import type { PointRule } from '../../lib/database.types';

/**
 * Punkteregeln konfigurieren (UC-016).
 *
 * Gruppiert nach den sieben Säulen des Gamification-Konzepts. Eine Änderung
 * wirkt immer nur nach vorne – bereits gebuchte Punkte bleiben, wie sie sind
 * (BR-063). Das steht als Fussnote auf der Seite, nicht nur in der Doku.
 */
export function PointRulePage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const toast = useToast();

  const rules = useAllPointRules();
  const updateRule = useUpdatePointRule();
  const setPillar = useSetPillarActive();
  const createRule = useCreatePointRule();

  const [open, setOpen] = useState<PointRule | null>(null);
  const [label, setLabel] = useState('');
  const [points, setPoints] = useState('0');
  const [isActive, setActive] = useState(true);
  const [limitMax, setLimitMax] = useState('');
  const [limitPeriod, setLimitPeriod] = useState<LimitPeriod>('week');

  const [isNewOpen, setNewOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPillar, setNewPillar] = useState<Pillar>(7);
  const [newPoints, setNewPoints] = useState('10');

  const all = useMemo(() => rules.data ?? [], [rules.data]);
  const groups = useMemo(() => groupByPillar(all), [all]);

  function openRule(rule: PointRule) {
    const limit = readRuleLimit(rule.meta);
    setOpen(rule);
    setLabel(rule.label);
    setPoints(String(rule.points));
    setActive(rule.is_active);
    setLimitMax(limit.max === null ? '' : String(limit.max));
    setLimitPeriod(limit.period);
  }

  function saveRule() {
    if (!open) return;
    const parsed = Number(points);
    updateRule.mutate(
      {
        ruleId: open.id,
        label,
        // BR-066: Regeln tragen keine negativen Werte.
        points: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
        isActive,
        meta: open.meta,
        limit: {
          max: limitMax.trim() ? Number(limitMax) : null,
          period: limitPeriod,
        },
      },
      {
        onSuccess: () => {
          setOpen(null);
          toast.success(t('pointRules.savedForward'));
        },
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  /** Eine eigene Regel beginnen – vom FAB und vom Leerzustand aus. */
  function startNewRule() {
    setNewLabel('');
    setNewCode('');
    setNewPillar(7);
    setNewPoints('10');
    setNewOpen(true);
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('pointRules.title')} backHref="/tabs/profile">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage
      title={t('pointRules.title')}
      backHref="/tabs/profile"
      createActions={[{ icon: addOutline, label: t('pointRules.addRule'), onClick: startNewRule }]}
      onRefresh={() => rules.refetch()}
    >
      {rules.isLoading ? (
        <SkeletonList rows={8} />
      ) : rules.error ? (
        <ErrorState error={rules.error as Error} onRetry={() => void rules.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState
          message={t('pointRules.empty')}
          action={{ label: t('pointRules.addRule'), onClick: startNewRule }}
        />
      ) : (
        groups.map(({ pillar, rules: pillarRules }) => {
          const activeCount = pillarRules.filter((rule) => rule.is_active).length;

          return (
            <ListSection
              key={pillar}
              title={t(`pointRules.pillar.${pillar}`)}
              action={
                // A2: Die ganze Säule mit einer Aktion abschalten.
                <IonButton
                  fill="clear"
                  size="small"
                  disabled={setPillar.isPending}
                  onClick={() =>
                    setPillar.mutate(
                      { pillar, isActive: activeCount === 0 },
                      {
                        onSuccess: () => toast.success(t('pointRules.savedForward')),
                        onError: (cause) => toast.failure(cause.message),
                      },
                    )
                  }
                >
                  {activeCount === 0 ? t('pointRules.enableAll') : t('pointRules.disableAll')}
                </IonButton>
              }
            >
              {pillarRules.map((rule) => {
                const limit = readRuleLimit(rule.meta);
                return (
                  <IonItem key={rule.id} button detail onClick={() => openRule(rule)}>
                    <IonLabel className="ion-text-wrap">
                      <h2>{rule.label}</h2>
                      <IonNote>
                        {rule.code}
                        {limit.max !== null
                          ? ` · ${t('pointRules.limitShort', {
                              max: limit.max,
                              period: t(`pointRules.period.${limit.period}`),
                            })}`
                          : ''}
                      </IonNote>
                    </IonLabel>

                    {!rule.is_active ? (
                      <IonBadge slot="end" color="medium">
                        {t('pointRules.inactive')}
                      </IonBadge>
                    ) : isThanksOnly(rule) ? (
                      // A4: Nur Dank, keine Zahl.
                      <IonBadge slot="end" color="secondary">
                        {t('pointRules.thanksOnly')}
                      </IonBadge>
                    ) : (
                      <IonNote slot="end" color="primary">
                        +{rule.points}
                      </IonNote>
                    )}
                  </IonItem>
                );
              })}
            </ListSection>
          );
        })
      )}

      {/* Regel bearbeiten (Schritt 3–6) */}
      <FormModal
        isOpen={open !== null}
        title={open?.label ?? ''}
        isSubmitting={updateRule.isPending}
        onDismiss={() => setOpen(null)}
        onSubmit={saveRule}
      >
        <ListSection footnote={t('pointRules.forwardHint')}>
          <IonItem>
            <IonInput
              label={t('pointRules.label')}
              labelPlacement="stacked"
              value={label}
              onIonInput={(e) => setLabel(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              inputmode="numeric"
              min={0}
              label={t('pointRules.points')}
              labelPlacement="stacked"
              value={points}
              onIonInput={(e) => setPoints(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>

        {/* A4: Nur-Dank ist kein eigener Schalter, sondern der Wert null. */}
        <ListSection footnote={t('pointRules.thanksOnlyHint')}>
          <IonItem>
            <IonToggle checked={isActive} onIonChange={(e) => setActive(e.detail.checked)}>
              {t('pointRules.active')}
            </IonToggle>
          </IonItem>
        </ListSection>

        {/* A5: Häufigkeitsgrenze */}
        <ListSection title={t('pointRules.limit')} footnote={t('pointRules.limitHint')}>
          <IonItem>
            <IonInput
              type="number"
              inputmode="numeric"
              min={1}
              label={t('pointRules.limitMax')}
              labelPlacement="stacked"
              placeholder={t('pointRules.limitNone')}
              value={limitMax}
              onIonInput={(e) => setLimitMax(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonSelect
              label={t('pointRules.limitPeriod')}
              value={limitPeriod}
              onIonChange={(e) => setLimitPeriod(e.detail.value as LimitPeriod)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              {LIMIT_PERIODS.map((period) => (
                <IonSelectOption key={period} value={period}>
                  {t(`pointRules.period.${period}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>
      </FormModal>

      {/* A3: Eigene Regel anlegen */}
      <FormModal
        isOpen={isNewOpen}
        title={t('pointRules.addRule')}
        canSubmit={
          newLabel.trim().length >= 2 && isCodeAvailable(all, newCode)
        }
        isSubmitting={createRule.isPending}
        error={createRule.error ? (createRule.error as Error).message : null}
        onDismiss={() => setNewOpen(false)}
        onSubmit={() =>
          createRule.mutate(
            {
              label: newLabel,
              code: newCode,
              pillar: newPillar,
              points: Math.max(0, Number(newPoints) || 0),
            },
            {
              onSuccess: () => {
                setNewOpen(false);
                toast.success(t('pointRules.ruleCreated'));
              },
            },
          )
        }
      >
        <ListSection footnote={t('pointRules.codeHint')}>
          <IonItem>
            <IonInput
              label={t('pointRules.label')}
              labelPlacement="stacked"
              value={newLabel}
              onIonInput={(e) => setNewLabel(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('pointRules.code')}
              labelPlacement="stacked"
              autocapitalize="off"
              value={newCode}
              onIonInput={(e) => setNewCode(e.detail.value ?? '')}
            />
          </IonItem>
          {newCode.trim() !== '' && !isCodeAvailable(all, newCode) && (
            <IonItem lines="none">
              <IonNote color="danger">{t('pointRules.codeTaken')}</IonNote>
            </IonItem>
          )}
        </ListSection>

        <ListSection>
          <IonItem>
            <IonSelect
              label={t('pointRules.pillarLabel')}
              value={newPillar}
              onIonChange={(e) => setNewPillar(e.detail.value as Pillar)}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
            >
              {PILLARS.map((pillar) => (
                <IonSelectOption key={pillar} value={pillar}>
                  {t(`pointRules.pillar.${pillar}`)}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonInput
              type="number"
              inputmode="numeric"
              min={0}
              label={t('pointRules.points')}
              labelPlacement="stacked"
              value={newPoints}
              onIonInput={(e) => setNewPoints(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}
