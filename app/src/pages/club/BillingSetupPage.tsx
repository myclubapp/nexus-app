import { useEffect, useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonInput,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonToggle,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { EmptyState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useClub } from '../../hooks/useClub';
import { useTeams } from '../../hooks/useInvites';
import { useToast } from '../../hooks/useToast';
import {
  useCreditor,
  useDeleteFeeItem,
  useFeeItems,
  useSaveCreditor,
  useSaveFeeItem,
} from '../../hooks/useInvoicing';
import { creditorProblems, isValidIban, QR_CURRENCIES } from '../../lib/invoicing';
import type { InvoiceFeeItem } from '../../lib/database.types';

/**
 * Die Rechnungsstellung einrichten (UC-046, FR-169 und FR-171).
 *
 * Zwei Dinge, die einmal gesetzt werden und dann stehen: die
 * Gläubigerangaben – ohne sie verlässt keine Rechnung den Verein (BR-222) –
 * und die Positionen, die ein Lauf vorschlägt.
 *
 * **Die QR-IBAN ist Pflicht.** Eine gewöhnliche IBAN trägt keine
 * QRR-Referenz; ohne sie liesse sich ein Zahlungseingang später nicht
 * zuordnen, und der Abgleich aus der Bankdatei wäre Raten (UC-047).
 */
export function BillingSetupPage() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const creditor = useCreditor();
  const saveCreditor = useSaveCreditor();
  const feeItems = useFeeItems();
  const saveFeeItem = useSaveFeeItem();
  const deleteFeeItem = useDeleteFeeItem();
  const teams = useTeams();
  const toast = useToast();

  const [iban, setIban] = useState('');
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');

  const [editing, setEditing] = useState<Partial<InvoiceFeeItem> | null>(null);

  useEffect(() => {
    const row = creditor.data;
    setIban(row?.iban ?? '');
    setName(row?.name ?? activeClub?.name ?? '');
    setStreet(row?.street ?? '');
    setHouseNumber(row?.house_number ?? '');
    setPostalCode(row?.postal_code ?? '');
    setCity(row?.city ?? '');
  }, [creditor.data, activeClub?.name]);

  // Die Teams **des Vereins**, nicht die aus den Mitgliederzeilen: Ein Team
  // ohne Mitglieder käme dort nicht vor, und für genau so eines will der
  // Verein den Beitrag hinterlegen, bevor die ersten beitreten.
  const teamNames = new Map((teams.data ?? []).map((team) => [team.id, team.name]));

  const problems = creditorProblems({
    iban,
    name,
    street,
    postal_code: postalCode,
    city,
  });

  function persistCreditor() {
    saveCreditor.mutate(
      {
        iban,
        name,
        street,
        house_number: houseNumber,
        postal_code: postalCode,
        city,
        country: creditor.data?.country ?? 'CH',
      },
      {
        onSuccess: () => toast.success(t('billing.setupSaved')),
        onError: (cause) => toast.failure((cause as Error).message),
      },
    );
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('billing.setup')} backHref="/tabs/profile/billing">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage
      title={t('billing.setup')}
      backHref="/tabs/profile/billing"
      createActions={[
        {
          icon: addOutline,
          label: t('billing.newFeeItem'),
          onClick: () =>
            setEditing({ team_id: null, name: '', amount: 0, currency: 'CHF', is_active: true }),
        },
      ]}
    >
      <ListSection title={t('billing.creditor')} footnote={t('billing.creditorHint')}>
        <IonItem>
          <IonInput
            label={t('billing.iban')}
            labelPlacement="stacked"
            autocapitalize="characters"
            placeholder="CH44 3199 9123 0008 8901 2"
            enterkeyhint="next"
            value={iban}
            onIonInput={(e) => setIban(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('billing.creditorName')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={name}
            onIonInput={(e) => setName(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('billing.street')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={street}
            onIonInput={(e) => setStreet(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('billing.houseNumber')}
            labelPlacement="stacked"
            enterkeyhint="next"
            value={houseNumber}
            onIonInput={(e) => setHouseNumber(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('billing.postalCode')}
            labelPlacement="stacked"
            inputmode="numeric"
            enterkeyhint="next"
            value={postalCode}
            onIonInput={(e) => setPostalCode(e.detail.value ?? '')}
          />
        </IonItem>
        <IonItem>
          <IonInput
            label={t('billing.city')}
            labelPlacement="stacked"
            enterkeyhint="done"
            value={city}
            onIonInput={(e) => setCity(e.detail.value ?? '')}
          />
        </IonItem>
      </ListSection>

      {/* A1: Was fehlt, steht im Abschnitt und nicht in einem Toast – es
          bezieht sich auf Felder, die gerade auszufüllen sind. */}
      {problems.length > 0 && (
        <ListSection>
          {problems.map((problem) => (
            <IonItem key={problem} lines="none">
              <IonLabel className="ion-text-wrap">
                <IonNote color="warning">{t(`billing.problem.${problem}`)}</IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      <div className="app-actions">
        <IonButton
          expand="block"
          disabled={
            saveCreditor.isPending || !isValidIban(iban) || name.trim().length < 2
          }
          onClick={persistCreditor}
        >
          {saveCreditor.isPending ? <IonSpinner name="crescent" /> : t('common.save')}
        </IonButton>
        {saveCreditor.error && (
          <InlineError message={(saveCreditor.error as Error).message} />
        )}
      </div>

      {/* FR-171: Was ein Lauf vorschlägt. Mit Team ist es der Beitrag dieses
          Teams, ohne ein Zuschlag oder Abzug für alle. */}
      <ListSection
        title={t('billing.feeItems')}
        footnote={t('billing.feeItemsHint')}
      >
        {feeItems.isLoading ? (
          <SkeletonList />
        ) : (feeItems.data ?? []).length === 0 ? (
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <IonNote>{t('billing.noFeeItems')}</IonNote>
            </IonLabel>
          </IonItem>
        ) : (
          (feeItems.data ?? []).map((item) => (
            <IonItemSliding key={item.id}>
              <IonItem button detail={false} onClick={() => setEditing(item)}>
                <IonLabel className="ion-text-wrap">
                  <h2>{item.name}</h2>
                  <IonNote>
                    {item.team_id
                      ? t('billing.forTeam', { team: teamNames.get(item.team_id) ?? '—' })
                      : t('billing.forClub')}
                  </IonNote>
                </IonLabel>
                <IonBadge slot="end" color={item.is_active ? 'primary' : 'medium'}>
                  {item.currency} {Number(item.amount).toFixed(2)}
                </IonBadge>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption
                  color="danger"
                  onClick={() =>
                    deleteFeeItem.mutate(item.id, {
                      onSuccess: () => toast.success(t('billing.feeItemDeleted')),
                      onError: (cause) => toast.failure((cause as Error).message),
                    })
                  }
                >
                  {t('billing.removeFee')}
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))
        )}
      </ListSection>

      <FormModal
        isOpen={editing !== null}
        title={editing?.id ? t('billing.editFeeItem') : t('billing.newFeeItem')}
        canSubmit={(editing?.name ?? '').trim().length >= 2}
        isSubmitting={saveFeeItem.isPending}
        error={saveFeeItem.error ? (saveFeeItem.error as Error).message : null}
        onSubmit={() => {
          if (!editing) return;
          saveFeeItem.mutate(
            {
              id: editing.id,
              team_id: editing.team_id ?? null,
              name: editing.name ?? '',
              amount: Number(editing.amount ?? 0),
              currency: editing.currency ?? 'CHF',
              is_active: editing.is_active !== false,
            },
            {
              onSuccess: () => {
                setEditing(null);
                toast.success(t('billing.feeItemSaved'));
              },
            },
          );
        }}
        onDismiss={() => setEditing(null)}
      >
        <ListSection>
          <IonItem>
            <IonInput
              label={t('billing.feeName')}
              labelPlacement="stacked"
              enterkeyhint="next"
              value={editing?.name ?? ''}
              onIonInput={(e) =>
                setEditing((current) => ({ ...current, name: e.detail.value ?? '' }))
              }
            />
          </IonItem>
          <IonItem>
            <IonInput
              label={t('billing.feeAmount')}
              labelPlacement="stacked"
              type="number"
              inputmode="decimal"
              step="0.05"
              enterkeyhint="done"
              value={editing?.amount ?? 0}
              onIonInput={(e) =>
                setEditing((current) => ({ ...current, amount: Number(e.detail.value ?? 0) }))
              }
            />
          </IonItem>
          <IonItem>
            <IonSelect
              label={t('billing.currency')}
              labelPlacement="stacked"
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              value={editing?.currency ?? 'CHF'}
              onIonChange={(e) =>
                setEditing((current) => ({ ...current, currency: e.detail.value }))
              }
            >
              {QR_CURRENCIES.map((currency) => (
                <IonSelectOption key={currency} value={currency}>
                  {currency}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonSelect
              label={t('billing.feeScope')}
              labelPlacement="stacked"
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              value={editing?.team_id ?? ''}
              onIonChange={(e) =>
                setEditing((current) => ({ ...current, team_id: e.detail.value || null }))
              }
            >
              <IonSelectOption value="">{t('billing.forClub')}</IonSelectOption>
              {(teams.data ?? []).map((team) => (
                <IonSelectOption key={team.id} value={team.id}>
                  {team.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonToggle
              checked={editing?.is_active !== false}
              onIonChange={(e) =>
                setEditing((current) => ({ ...current, is_active: e.detail.checked }))
              }
            >
              <IonLabel className="ion-text-wrap">
                <h2>{t('billing.feeActive')}</h2>
                <IonNote>{t('billing.feeActiveHint')}</IonNote>
              </IonLabel>
            </IonToggle>
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}
