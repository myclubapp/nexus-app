import { useState } from 'react';
import { IonInput, IonItem, IonLabel, IonNote } from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { DateField } from '../../components/DateField';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useClub } from '../../hooks/useClub';
import { useToast } from '../../hooks/useToast';
import { useCreditor, useCreatePeriod, useInvoicePeriods } from '../../hooks/useInvoicing';
import { creditorProblems } from '../../lib/invoicing';
import { formatDate } from '../../lib/format';

/**
 * Die Abrechnungsperioden des Vereins (UC-046, Schritte 1 bis 3).
 *
 * Eine Periode ist der Rahmen eines Laufs: ein Zweck, eine Fälligkeit, eine
 * Währung. Die Rechnungen einer Periode stehen im Detail; hier steht, was es
 * gibt und was als Nächstes zu tun ist.
 *
 * **Ohne Gläubigerangaben führt der erste Weg dorthin** (BR-222): Eine
 * Periode anzulegen, aus der nichts hinausgehen kann, wäre ein leerer Schritt.
 */
export function BillingPage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const periods = useInvoicePeriods();
  const creditor = useCreditor();
  const createPeriod = useCreatePeriod();
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [prefix, setPrefix] = useState('');

  const problems = creditorProblems(creditor.data);
  const ready = problems.length === 0;

  if (!isAdmin) {
    return (
      <AppPage title={t('billing.title')} backHref="/tabs/profile">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  function startNewPeriod() {
    setName('');
    setDueDate('');
    setPrefix('');
    setIsOpen(true);
  }

  return (
    <AppPage
      title={t('billing.title')}
      backHref="/tabs/profile"
      onRefresh={() => periods.refetch()}
      // §2: Was etwas anlegt, steht als Plus unten rechts – nicht als Knopf
      // in einer Abschnitts-Überschrift. Ohne Gläubigerangaben gibt es den
      // Weg nicht: Eine Periode, aus der nichts hinausgehen kann, wäre ein
      // leerer Schritt (BR-222).
      createActions={
        ready
          ? [{ icon: addOutline, label: t('billing.newPeriod'), onClick: startNewPeriod }]
          : undefined
      }
    >
      <ListSection footnote={ready ? t('billing.setupDoneHint') : t('billing.setupNeededHint')}>
        <IonItem button detail routerLink="/tabs/profile/billing/setup">
          <IonLabel className="ion-text-wrap">
            <h2>{t('billing.setup')}</h2>
            <IonNote>
              {ready ? t('billing.setupDone') : t(`billing.problem.${problems[0]}`)}
            </IonNote>
          </IonLabel>
        </IonItem>
      </ListSection>

      <ListSection
        title={t('billing.periods')}
        footnote={t('billing.periodsHint')}
      >
        {periods.isLoading ? (
          <SkeletonList />
        ) : periods.error ? (
          <ErrorState
            error={periods.error as Error}
            onRetry={() => void periods.refetch()}
          />
        ) : (periods.data ?? []).length === 0 ? (
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <IonNote>{t('billing.noPeriods')}</IonNote>
            </IonLabel>
          </IonItem>
        ) : (
          (periods.data ?? []).map((period) => (
            <IonItem
              key={period.id}
              button
              detail
              routerLink={`/tabs/profile/billing/${period.id}`}
            >
              <IonLabel className="ion-text-wrap">
                <h2>{period.name}</h2>
                <IonNote>
                  {t('billing.dueOn', { date: formatDate(period.due_date) })} · {period.currency}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))
        )}
      </ListSection>

      <FormModal
        isOpen={isOpen}
        title={t('billing.newPeriod')}
        canSubmit={name.trim().length >= 2 && dueDate.length > 0}
        isSubmitting={createPeriod.isPending}
        error={createPeriod.error ? (createPeriod.error as Error).message : null}
        onSubmit={() =>
          createPeriod.mutate(
            {
              name,
              dueDate,
              currency: 'CHF',
              referencePrefix: prefix,
            },
            {
              onSuccess: () => {
                setIsOpen(false);
                toast.success(t('billing.periodCreated'));
              },
            },
          )
        }
        onDismiss={() => setIsOpen(false)}
      >
        <ListSection footnote={t('billing.prefixHint')}>
          <IonItem>
            <IonInput
              label={t('billing.periodName')}
              labelPlacement="stacked"
              placeholder={t('billing.periodNamePlaceholder')}
              enterkeyhint="next"
              value={name}
              onIonInput={(e) => setName(e.detail.value ?? '')}
            />
          </IonItem>
          <DateField
            label={t('billing.dueDate')}
            presentation="date"
            value={dueDate}
            onChange={setDueDate}
          />
          <IonItem>
            <IonInput
              label={t('billing.prefix')}
              labelPlacement="stacked"
              inputmode="numeric"
              maxlength={10}
              enterkeyhint="done"
              value={prefix}
              onIonInput={(e) => setPrefix((e.detail.value ?? '').replace(/\D/g, ''))}
            />
          </IonItem>
        </ListSection>
      </FormModal>
    </AppPage>
  );
}
