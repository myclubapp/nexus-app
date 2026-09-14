import { IonBadge, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import { openOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { useMyInvoices } from '../hooks/useInvoices';
import { formatDate } from '../lib/format';
import { openTotal, sortInvoices, statusTone, wasOnTime } from '../lib/invoice';

/**
 * «Meine Rechnungen» (UC-036, Schritte 1–4).
 *
 * **BR-156: Die App kennt nur den Spiegel.** Hier stehen Betrag, Fälligkeit und
 * Status – und ein Weg in die Detailansicht des Rechnungsdienstes. Positionen,
 * Zahlungsreferenzen und Bankdaten stehen dort, nicht hier.
 *
 * **BR-158: keine Sanktion bei Verzug.** Überfällig erscheint deshalb in
 * `warning` und nicht in `danger`, und es steht kein Wort über Mahngebühren,
 * Sperren oder Abzüge. Verzug ist ein Anlass für Kontakt, mehr nicht.
 */
export function InvoicePage() {
  const { t } = useTranslation();
  const invoices = useMyInvoices();

  const rows = sortInvoices(invoices.data ?? []);
  const outstanding = openTotal(rows);

  return (
    <AppPage
      title={t('invoice.title')}
      backHref="/tabs/profile"
      onRefresh={() => invoices.refetch()}
    >
      {invoices.isLoading ? (
        <SkeletonList />
      ) : invoices.error ? (
        <ErrorState
          error={invoices.error as Error}
          onRetry={() => void invoices.refetch()}
        />
      ) : rows.length === 0 ? (
        // BR-165 seit UC-037: Erklärung und ein nächster Schritt.
        <EmptyState
          message={t('invoice.empty')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      ) : (
        <>
          {outstanding > 0 && (
            <div className="app-stat-row">
              <StatCard
                value={Math.round(outstanding)}
                label={t('invoice.outstanding')}
                accent="tertiary"
              />
            </div>
          )}

          <ListSection title={t('invoice.list')} footnote={t('invoice.listHint')}>
            {rows.map((invoice) => (
              <IonItem
                key={invoice.id}
                // Schritt 4: der Weg in die Detailansicht. Signiert wird der
                // Verweis **im Dienst** (BR-159); die App reicht ihn durch.
                // Der Link verlässt die App – deshalb das Symbol dafür statt
                // des Chevrons, der eine Unterseite verspricht.
                button={Boolean(invoice.detailUrl)}
                detail={false}
                href={invoice.detailUrl ?? undefined}
                target={invoice.detailUrl ? '_blank' : undefined}
                rel={invoice.detailUrl ? 'noopener noreferrer' : undefined}
              >
                <IonLabel className="ion-text-wrap">
                  <h2>{t('invoice.amount', { amount: invoice.amount.toFixed(2) })}</h2>
                  <p>{t('invoice.dueOn', { date: formatDate(invoice.dueDate) })}</p>
                  {/* Schritt 8: Die Gutschrift steht an der Rechnung, die sie
                      ausgelöst hat – nicht nur im Punkte-Verlauf. */}
                  {wasOnTime(invoice) && <IonNote>{t('invoice.onTime')}</IonNote>}
                </IonLabel>
                <IonBadge slot="end" color={statusTone(invoice.status)}>
                  {t(`invoice.status.${invoice.status}`)}
                </IonBadge>
                {invoice.detailUrl && (
                  <IonIcon slot="end" icon={openOutline} color="medium" aria-hidden="true" />
                )}
              </IonItem>
            ))}
          </ListSection>
        </>
      )}
    </AppPage>
  );
}
