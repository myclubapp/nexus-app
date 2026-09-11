import { useState } from 'react';
import {
  IonAlert,
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
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { FormModal } from '../../components/FormModal';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useDeleteOffice, useOffices, useSaveOffice } from '../../hooks/useMeeting';
import { useMembers } from '../../hooks/useMembers';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../lib/format';
import { isVacant, validateOffice, type Office } from '../../lib/meeting';

/**
 * Die Ämter des Vereins (UC-031, BR-133).
 *
 * `MVP_Scope` §2 führt «Funktionärsämter mit Factsheets & Vakanz-Anzeige» als
 * Ausbaustufe 2. Hier steht deshalb nur, was §13.1 im Kern verlangt: der
 * **Verteiler**. Ein Amt hat einen Titel und höchstens eine Inhaber:in – kein
 * Factsheet, keine Ausschreibung, keine Nachfolgeplanung.
 *
 * Der Nutzen entsteht sofort: Ein Input geht an das Amt, nicht an die Person.
 * Wechselt sie, stimmt der Verteiler ohne Zutun – die Auflösung passiert in der
 * Datenbank, zum Zustellzeitpunkt.
 */
export function OfficePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const offices = useOffices();
  const members = useMembers();
  const save = useSaveOffice();
  const remove = useDeleteOffice();

  const [dissolving, setDissolving] = useState<Office | null>(null);
  const [editing, setEditing] = useState<Office | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [holder, setHolder] = useState<string | null>(null);

  const open = creating || editing !== null;
  const problems = validateOffice({ title, holderMemberId: holder });

  function start(office: Office | null) {
    setTitle(office?.title ?? '');
    setHolder(office?.holderMemberId ?? null);
    if (office) setEditing(office);
    else setCreating(true);
  }

  function close() {
    setEditing(null);
    setCreating(false);
  }

  const rows = offices.data ?? [];
  const vacant = rows.filter(isVacant);

  return (
    <AppPage
      title={t('offices.title')}
      backHref="/tabs/profile"
      onRefresh={() => offices.refetch()}
    >
      {/* FR-144: Ist noch nichts da, trägt der Leerzustand den Knopf – nicht
          beide. */}
      {rows.length > 0 && (
        <div className="app-actions">
          <IonButton expand="block" onClick={() => start(null)}>
            {t('offices.add')}
          </IonButton>
        </div>
      )}

      {offices.isLoading ? (
        <SkeletonList />
      ) : offices.error ? (
        <ErrorState
          error={offices.error as Error}
          onRetry={() => void offices.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          message={t('offices.empty')}
          action={{ label: t('offices.add'), onClick: () => start(null) }}
        />
      ) : (
        <ListSection title={t('offices.list')} footnote={t('offices.hint')}>
          {rows.map((office) => (
            <IonItemSliding key={office.id}>
              <IonItem button detail onClick={() => start(office)}>
                <IonLabel className="ion-text-wrap">
                  <h2>{office.title}</h2>
                  {office.holderName ? (
                    <p>{office.holderName}</p>
                  ) : (
                    <p>{t('offices.vacant')}</p>
                  )}
                  {office.heldSince && (
                    <IonNote>
                      {t('offices.since', { date: formatDate(office.heldSince) })}
                    </IonNote>
                  )}
                </IonLabel>
              </IonItem>
              <IonItemOptions side="end">
                <IonItemOption color="danger" onClick={() => setDissolving(office)}>
                  {t('offices.remove')}
                </IonItemOption>
              </IonItemOptions>
            </IonItemSliding>
          ))}
        </ListSection>
      )}

      {vacant.length > 0 && (
        <ListSection title={t('offices.vacantTitle')} footnote={t('offices.vacantHint')}>
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <p>{vacant.map((office) => office.title).join(', ')}</p>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* guidelines §2: Die Rückfrage steht **vor** der Aktion, und die Farbe
          des Knopfs kommt aus seiner Rolle – nicht aus einem `color`. */}
      <IonAlert
        isOpen={dissolving !== null}
        header={t('offices.remove')}
        message={t('offices.removeConfirm', { title: dissolving?.title ?? '' })}
        onDidDismiss={() => setDissolving(null)}
        buttons={[
          { text: t('common.cancel'), role: 'cancel' },
          {
            text: t('offices.remove'),
            role: 'destructive',
            handler: () => {
              const id = dissolving?.id;
              if (!id) return;
              remove.mutate(id, {
                onSuccess: () => toast.success(t('offices.removed')),
                onError: (error) => toast.failure((error as Error).message),
              });
            },
          },
        ]}
      />

      <FormModal
        isOpen={open}
        title={editing ? t('offices.edit') : t('offices.add')}
        canSubmit={problems.length === 0 && !save.isPending}
        isSubmitting={save.isPending}
        error={save.error ? (save.error as Error).message : null}
        onDismiss={close}
        onSubmit={() =>
          save.mutate(
            { id: editing?.id, title, holderMemberId: holder },
            {
              onSuccess: () => {
                close();
                toast.success(t('common.saved'));
              },
            },
          )
        }
      >
        <ListSection title={t('offices.titleField')} footnote={t('offices.titleHint')}>
          <IonItem>
            <IonInput
              label={t('offices.titleLabel')}
              labelPlacement="stacked"
              value={title}
              onIonInput={(e) => setTitle(e.detail.value ?? '')}
            />
          </IonItem>
        </ListSection>

        <ListSection title={t('offices.holder')} footnote={t('offices.holderHint')}>
          <IonItem>
            <IonSelect
              label={t('offices.holderLabel')}
              labelPlacement="stacked"
              value={holder}
              cancelText={t('common.cancel')}
              okText={t('common.ok')}
              onIonChange={(e) => setHolder((e.detail.value as string) || null)}
            >
              <IonSelectOption value="">{t('offices.vacant')}</IonSelectOption>
              {(members.data ?? []).map((member) => (
                <IonSelectOption key={member.id} value={member.id}>
                  {member.display_name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </ListSection>

        {problems.map((problem) => (
          <InlineError key={problem} message={t(`offices.problem.${problem}`)} />
        ))}
      </FormModal>
    </AppPage>
  );
}
