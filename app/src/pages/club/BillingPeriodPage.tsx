import { useMemo, useRef, useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonButton,
  IonCheckbox,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
  IonSpinner,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { ManageSection } from '../../components/ManageSection';
import { StatCard } from '../../components/StatCard';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useClub } from '../../hooks/useClub';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../hooks/useToast';
import {
  useCancelInvoice,
  useDeleteDraft,
  useFeeItems,
  useGenerateInvoices,
  useInvoicePdfUrl,
  useInvoicePeriods,
  useInvoiceRun,
  usePaymentImport,
  usePeriodInvoices,
  useRemindInvoice,
  useRemindOpenInvoices,
  type PaymentImportResult,
} from '../../hooks/useInvoicing';
import {
  canRemind,
  formatQrReference,
  periodTotals,
  remindableCount,
  stateTone,
  totalFor,
} from '../../lib/invoicing';
import { formatDate } from '../../lib/format';

/**
 * Eine Abrechnungsperiode: Entwürfe erzeugen, prüfen, versenden – und die
 * Zahlungen der Bank verbuchen (UC-046 Schritte 4 bis 12, UC-047).
 *
 * **Drei Handlungen, drei Zustände.** Was ein Entwurf ist, lässt sich ändern
 * und verwerfen; was versendet ist, lässt sich stornieren und bezahlen
 * (BR-224). Die Seite zeigt zu jeder Zeile nur, was für ihren Stand gilt.
 *
 * Die camt-Datei wird **nicht hier** gelesen: Sie geht an `payment-import`,
 * und zugeordnet wird in der Datenbank. Der Probelauf davor zeigt, was drin
 * steht, ohne etwas zu buchen.
 */
export function BillingPeriodPage() {
  const { t } = useTranslation();
  const { periodId } = useParams<{ periodId: string }>();
  const { isAdmin } = useClub();
  const periods = useInvoicePeriods();
  const invoices = usePeriodInvoices(periodId ?? null);
  const feeItems = useFeeItems();
  const members = useMembers();
  const generate = useGenerateInvoices();
  const run = useInvoiceRun();
  const importPayments = usePaymentImport();
  const deleteDraft = useDeleteDraft();
  const cancelInvoice = useCancelInvoice();
  const pdfUrl = useInvoicePdfUrl();
  const remindOne = useRemindInvoice();
  const remindAll = useRemindOpenInvoices();
  const toast = useToast();

  const [isPicking, setIsPicking] = useState(false);
  const [pickedMembers, setPickedMembers] = useState<string[]>([]);
  const [pickedItems, setPickedItems] = useState<string[]>([]);
  const [confirmSend, setConfirmSend] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [opened, setOpened] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const [preview, setPreview] = useState<PaymentImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camtRef = useRef<{ xml: string; filename: string } | null>(null);

  const period = (periods.data ?? []).find((entry) => entry.id === periodId);
  const rows = invoices.data ?? [];
  const totals = useMemo(() => periodTotals(rows), [rows]);
  const today = new Date().toISOString().slice(0, 10);

  const activeMembers = (members.data ?? []).filter((member) => member.status !== 'left');
  // FR-176: Wie viele jetzt eine Erinnerung bekämen – dieselbe Regel wie in
  // `remind_invoice()`, damit der Knopf nicht mehr verspricht als der Server
  // tut (BR-236).
  const remindable = remindableCount(rows, today);
  const detail = rows.find((invoice) => invoice.id === opened) ?? null;
  const chosenItems = (feeItems.data ?? []).filter((item) => pickedItems.includes(item.id));

  async function openPdf(path: string) {
    try {
      const url = await pdfUrl.mutateAsync(path);
      window.open(url, '_blank', 'noopener');
    } catch (cause) {
      toast.failure((cause as Error).message);
    }
  }

  /** Die gewählte Datei lesen und **im Backend** prüfen, ohne zu buchen. */
  async function readCamt(file: File) {
    const xml = await file.text();
    camtRef.current = { xml, filename: file.name };
    importPayments.mutate(
      { xml, filename: file.name, dryRun: true },
      {
        onSuccess: (result) => setPreview(result),
        onError: (cause) => toast.failure(describeImportError(cause as Error, t)),
      },
    );
  }

  function bookCamt() {
    const file = camtRef.current;
    if (!file) return;
    importPayments.mutate(
      { xml: file.xml, filename: file.filename },
      {
        onSuccess: (result) => {
          setPreview(null);
          camtRef.current = null;
          toast.success(
            t('billing.importDone', {
              matched: result.matched ?? 0,
              found: result.found,
            }),
          );
        },
        onError: (cause) => toast.failure(describeImportError(cause as Error, t)),
      },
    );
  }

  if (!isAdmin) {
    return (
      <AppPage title={t('billing.title')} backHref="/tabs/profile/billing">
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  function startGenerating() {
    setPickedMembers([]);
    setPickedItems((feeItems.data ?? []).filter((item) => item.is_active).map((item) => item.id));
    setIsPicking(true);
  }

  return (
    <AppPage
      title={period?.name ?? t('billing.title')}
      backHref="/tabs/profile/billing"
      onRefresh={() => invoices.refetch()}
      // §2: Rechnungen erzeugen legt etwas an – das steht als Plus unten
      // rechts. Der Versand bleibt ein beschrifteter Knopf im Inhalt: Er
      // gehört zur Zahl der Entwürfe darüber und trüge als Fab kein Wort.
      createActions={[
        { icon: addOutline, label: t('billing.generate'), onClick: startGenerating },
      ]}
    >
      {invoices.isLoading ? (
        <SkeletonList />
      ) : invoices.error ? (
        <ErrorState error={invoices.error as Error} onRetry={() => void invoices.refetch()} />
      ) : (
        <>
          <div className="app-stat-row">
            <StatCard value={totals.draft} label={t('billing.drafts')} accent="secondary" />
            <StatCard value={Math.round(totals.open)} label={t('billing.openAmount')} accent="tertiary" />
            <StatCard value={Math.round(totals.received)} label={t('billing.received')} accent="primary" />
          </div>

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={totals.draft === 0 || run.isPending}
              onClick={() => setConfirmSend(true)}
            >
              {run.isPending ? <IonSpinner name="crescent" /> : t('billing.send', { count: totals.draft })}
            </IonButton>

            {/* FR-176: «damit ich nicht einzeln nachfassen muss». Der Knopf
                erscheint nur, wenn es überfällige Rechnungen gibt, an die
                diese Woche noch nicht erinnert wurde. */}
            {remindable > 0 && (
              <IonButton
                expand="block"
                fill="outline"
                disabled={remindAll.isPending}
                onClick={() =>
                  remindAll.mutate(periodId!, {
                    onSuccess: (result) =>
                      toast.success(t('billing.reminded', { count: result.reminded })),
                    onError: (cause) => toast.failure((cause as Error).message),
                  })
                }
              >
                {remindAll.isPending ? (
                  <IonSpinner name="crescent" />
                ) : (
                  t('billing.remindAll', { count: remindable })
                )}
              </IonButton>
            )}

            {run.error && <InlineError message={describeRunError(run.error as Error, t)} />}
          </div>

          {/* UC-047: Die Datei geht an den Server; gelesen und zugeordnet wird
              dort. Der Probelauf zeigt, was sie enthält, bevor gebucht wird. */}
          <ListSection title={t('billing.payments')} footnote={t('billing.paymentsHint')}>
            <IonItem
              button
              detail={false}
              disabled={importPayments.isPending}
              onClick={() => fileRef.current?.click()}
            >
              <IonLabel className="ion-text-wrap">
                <h2>{t('billing.importFile')}</h2>
                <IonNote>{t('billing.importFileHint')}</IonNote>
              </IonLabel>
              {importPayments.isPending && <IonSpinner slot="end" name="crescent" />}
            </IonItem>
            <input
              ref={fileRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void readCamt(file);
              }}
            />
          </ListSection>

          <ListSection title={t('billing.invoices')} footnote={t('billing.invoicesHint')}>
            {rows.length === 0 ? (
              <IonItem lines="none">
                <IonLabel className="ion-text-wrap">
                  <IonNote>{t('billing.noInvoices')}</IonNote>
                </IonLabel>
              </IonItem>
            ) : (
              rows.map((invoice) => (
                <IonItemSliding key={invoice.id}>
                  <IonItem button detail onClick={() => setOpened(invoice.id)}>
                    <IonLabel className="ion-text-wrap">
                      <h2>{invoice.memberName}</h2>
                      <p>
                        {invoice.currency} {Number(invoice.amount).toFixed(2)} ·{' '}
                        {t('billing.dueOn', { date: formatDate(invoice.due_date) })}
                      </p>
                      <IonNote>
                        {formatQrReference(invoice.reference)}
                        {invoice.reminder_count > 0 &&
                          ` · ${t('billing.remindedTimes', { count: invoice.reminder_count })}`}
                      </IonNote>
                    </IonLabel>
                    <IonBadge
                      slot="end"
                      color={stateTone(invoice.status, invoice.due_date, today)}
                    >
                      {t(`billing.state.${invoice.status}`)}
                    </IonBadge>
                  </IonItem>
                  <IonItemOptions side="end">
                    {invoice.status === 'draft' ? (
                      <IonItemOption
                        color="danger"
                        onClick={() => setConfirmDiscard(invoice.id)}
                      >
                        {t('billing.discard')}
                      </IonItemOption>
                    ) : invoice.status === 'sent' ? (
                      <IonItemOption color="warning" onClick={() => setCancelling(invoice.id)}>
                        {t('billing.cancel')}
                      </IonItemOption>
                    ) : (
                      <IonItemOption
                        disabled={!invoice.pdf_path}
                        onClick={() => invoice.pdf_path && void openPdf(invoice.pdf_path)}
                      >
                        {t('billing.openPdf')}
                      </IonItemOption>
                    )}
                  </IonItemOptions>
                </IonItemSliding>
              ))
            )}
          </ListSection>
        </>
      )}

      {/* Die Zeile öffnet ihr Blatt: Positionen, Referenz – und die
          Verwaltungswege als `ManageSection` (guidelines §2). Die Wischoption
          bleibt der kurze Weg; ohne diesen Abschnitt wäre sie der **einzige**,
          und Tastatur und VoiceOver kämen nie an «Stornieren». Das Blatt zeigt
          nur an, deshalb ohne `onSubmit` (§11 Nr. 16). */}
      <FormModal
        isOpen={detail !== null}
        title={detail?.memberName ?? t('billing.invoices')}
        onDismiss={() => setOpened(null)}
      >
        <ListSection footnote={formatQrReference(detail?.reference ?? '')}>
          {(detail?.positions ?? []).map((position) => (
            <IonItem key={position.id}>
              <IonLabel className="ion-text-wrap">{position.label}</IonLabel>
              <IonNote slot="end">{Number(position.amount).toFixed(2)}</IonNote>
            </IonItem>
          ))}
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('billing.state.' + (detail?.status ?? 'draft'))}</h2>
              <IonNote>
                {t('billing.dueOn', { date: formatDate(detail?.due_date ?? today) })}
              </IonNote>
            </IonLabel>
            <IonNote slot="end">
              {detail?.currency} {Number(detail?.amount ?? 0).toFixed(2)}
            </IonNote>
          </IonItem>
        </ListSection>

        <ManageSection
          actions={[
            Boolean(detail?.pdf_path) && {
              label: t('billing.openPdf'),
              onClick: () => void openPdf(detail!.pdf_path!),
            },
            detail?.status === 'draft' && {
              label: t('billing.discard'),
              destructive: true,
              onClick: () => setConfirmDiscard(detail.id),
            },
            detail !== null && canRemind(detail, today) && {
              label: t('billing.remind'),
              onClick: () =>
                remindOne.mutate(detail.id, {
                  onSuccess: (sent) =>
                    sent
                      ? toast.success(t('billing.reminded', { count: 1 }))
                      : toast.success(t('billing.remindTooSoon')),
                  onError: (cause) => toast.failure((cause as Error).message),
                }),
            },
            detail?.status === 'sent' && {
              label: t('billing.cancel'),
              destructive: true,
              onClick: () => setCancelling(detail.id),
            },
          ]}
        />
      </FormModal>

      {/* Schritte 4 bis 7: wer, und mit welchen Positionen. Die Vorschau
          rechnet mit derselben Regel wie `generate_invoices()`. */}
      <FormModal
        isOpen={isPicking}
        title={t('billing.generate')}
        submitLabel={t('billing.generateSubmit', { count: pickedMembers.length })}
        canSubmit={pickedMembers.length > 0 && pickedItems.length > 0}
        isSubmitting={generate.isPending}
        error={generate.error ? (generate.error as Error).message : null}
        submitPlacement="content"
        onSubmit={() =>
          generate.mutate(
            { periodId: periodId!, memberIds: pickedMembers, feeItemIds: pickedItems },
            {
              onSuccess: (result) => {
                setIsPicking(false);
                toast.success(
                  t('billing.generated', {
                    created: result.created,
                    skipped: result.existing.length + result.without.length,
                  }),
                );
              },
            },
          )
        }
        onDismiss={() => setIsPicking(false)}
      >
        <ListSection title={t('billing.feeItems')} footnote={t('billing.pickItemsHint')}>
          {(feeItems.data ?? [])
            .filter((item) => item.is_active)
            .map((item) => (
              <IonItem key={item.id}>
                <IonCheckbox
                  checked={pickedItems.includes(item.id)}
                  onIonChange={(e) =>
                    setPickedItems((current) =>
                      e.detail.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{item.name}</h2>
                    <IonNote>
                      {item.currency} {Number(item.amount).toFixed(2)}
                    </IonNote>
                  </IonLabel>
                </IonCheckbox>
              </IonItem>
            ))}
        </ListSection>

        <ListSection title={t('members.title')} footnote={t('billing.pickMembersHint')}>
          {activeMembers.map((member) => {
            const amount = totalFor(chosenItems, member.teamIds);
            return (
              <IonItem key={member.id}>
                <IonCheckbox
                  checked={pickedMembers.includes(member.id)}
                  onIonChange={(e) =>
                    setPickedMembers((current) =>
                      e.detail.checked
                        ? [...current, member.id]
                        : current.filter((id) => id !== member.id),
                    )
                  }
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{member.display_name}</h2>
                    <IonNote>
                      {amount > 0
                        ? `${period?.currency ?? 'CHF'} ${amount.toFixed(2)}`
                        : t('billing.noFeeForMember')}
                    </IonNote>
                  </IonLabel>
                </IonCheckbox>
              </IonItem>
            );
          })}
        </ListSection>
      </FormModal>

      {/* UC-047 Schritt 5: erst zeigen, dann buchen. */}
      <FormModal
        isOpen={preview !== null}
        title={t('billing.importPreview')}
        submitLabel={t('billing.importBook')}
        canSubmit={(preview?.found ?? 0) > 0}
        isSubmitting={importPayments.isPending}
        submitPlacement="content"
        onSubmit={bookCamt}
        onDismiss={() => {
          setPreview(null);
          camtRef.current = null;
        }}
      >
        <ListSection footnote={t('billing.importPreviewHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>{t('billing.importFound', { count: preview?.found ?? 0 })}</h2>
            </IonLabel>
          </IonItem>
          {(preview?.preview ?? []).map((payment) => (
            <IonItem key={payment.reference}>
              <IonLabel className="ion-text-wrap">
                <h2>{payment.payer ?? t('billing.unknownPayer')}</h2>
                <IonNote>{formatQrReference(payment.reference)}</IonNote>
              </IonLabel>
              <IonNote slot="end">{payment.amount.toFixed(2)}</IonNote>
            </IonItem>
          ))}
        </ListSection>
      </FormModal>

      <IonAlert
        isOpen={confirmSend}
        header={t('billing.send', { count: totals.draft })}
        message={t('billing.sendConfirm', { count: totals.draft })}
        onDidDismiss={() => setConfirmSend(false)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('billing.sendNow'),
            handler: () =>
              run.mutate(
                { periodId: periodId! },
                {
                  onSuccess: (result) => {
                    toast.success(t('billing.sent', { count: result.sent }));
                    if (result.failed.length > 0) {
                      toast.failure(t('billing.sendFailed', { count: result.failed.length }));
                    }
                  },
                },
              ),
          },
        ]}
      />

      <IonAlert
        isOpen={confirmDiscard !== null}
        header={t('billing.discard')}
        message={t('billing.discardConfirm')}
        onDidDismiss={() => setConfirmDiscard(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('billing.discard'),
            role: 'destructive',
            handler: () =>
              deleteDraft.mutate(confirmDiscard!, {
                onSuccess: () => {
                  setOpened(null);
                  toast.success(t('billing.draftDeleted'));
                },
                onError: (cause) => toast.failure((cause as Error).message),
              }),
          },
        ]}
      />

      <IonAlert
        isOpen={cancelling !== null}
        header={t('billing.cancel')}
        message={t('billing.cancelConfirm')}
        inputs={[{ name: 'reason', type: 'text', placeholder: t('billing.cancelReason') }]}
        onDidDismiss={() => setCancelling(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('billing.cancel'),
            role: 'destructive',
            handler: (data: { reason?: string }) =>
              cancelInvoice.mutate(
                { invoiceId: cancelling!, reason: data?.reason ?? '' },
                {
                  onSuccess: () => {
                    setOpened(null);
                    toast.success(t('billing.cancelled'));
                  },
                  onError: (cause) => toast.failure((cause as Error).message),
                },
              ),
          },
        ]}
      />
    </AppPage>
  );
}

/**
 * Die Meldungen der beiden Functions in Sätze übersetzen.
 *
 * `creditor_incomplete` und `unreadable` sind Zustände, keine Fehler – sie
 * gehören in die Sprache des Vereins und nicht als englischer Schlüssel in
 * einen Toast.
 */
function describeRunError(error: Error, t: (key: string) => string): string {
  if (error.message === 'creditor_incomplete') return t('billing.problem.missing');
  return error.message;
}

function describeImportError(error: Error, t: (key: string) => string): string {
  if (error.message === 'unreadable') return t('billing.importUnreadable');
  return error.message;
}
