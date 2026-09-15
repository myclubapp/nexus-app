import { useRef, useState } from 'react';
import {
  IonAlert,
  IonBadge,
  IonItem,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonLabel,
  IonNote,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { TextSection } from '../../components/TextSection';
import { OfficeDetailModal } from '../../components/OfficeDetailModal';
import { OfficeFormModal } from '../../components/OfficeFormModal';
import { OfficeImportModal } from '../../components/OfficeImportModal';
import { EmptyState, ErrorState } from '../../components/StateViews';
import { SkeletonList } from '../../components/Skeletons';
import { useClub } from '../../hooks/useClub';
import { useOfficeMarkdown } from '../../hooks/useOfficeMarkdown';
import { useDeleteOffice, useOffices } from '../../hooks/useOffices';
import { useRefreshOnEnter } from '../../hooks/useRefreshOnEnter';
import { useToast } from '../../hooks/useToast';
import {
  groupOffices,
  holderNames,
  isVacant,
  openSeats,
  sortOffices,
  type Office,
} from '../../lib/office';
import { OFFICE_MARKDOWN_ACCEPT } from '../../lib/officeMarkdown';

interface OfficePageProps {
  /** Woher die Person kommt: aus dem Profil (Verwaltung) oder aus dem Marktplatz. */
  backHref?: string;
}

/**
 * Die Ämter des Vereins (UC-031 BR-133, UC-041 FR-126/FR-127).
 *
 * Seit UC-041 ist die Seite das **Organigramm für alle**: Jedes Mitglied
 * sieht, wer was trägt, und öffnet das Factsheet. Der Vorstand legt an,
 * ändert und löst auf – über das Plus unten rechts, den Abschnitt «Verwalten»
 * im Detail-Blatt und die Wischgeste. Die Berechtigung dafür liegt in `save_office()` und den
 * Policies; das Ausblenden hier ist Bequemlichkeit.
 *
 * Ein Amt ist zugleich der Verteiler für Sitzungs-Inputs (BR-133): Ein
 * Vorschlag geht an das Amt, nicht an die Person. Wer es hält, steht in der
 * Belegung; der Verteiler folgt ihr (BR-185).
 */
export function OfficePage({ backHref = '/tabs/profile' }: OfficePageProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAdmin } = useClub();
  const offices = useOffices();
  const remove = useDeleteOffice();
  const markdown = useOfficeMarkdown();
  useRefreshOnEnter([['offices']]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dissolving, setDissolving] = useState<Office | null>(null);
  // Die gewählte Datei, schon gelesen: Das Blatt zeigt daraus, was sie ändert.
  const [importFile, setImportFile] = useState<{ text: string; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = sortOffices(offices.data ?? []);
  const vacant = rows.filter(isVacant);
  // BR-237: Der Vorstand steht als eigene Gruppe – er ist das Gremium, an das
  // Sitzungen und Vorschläge gehen, und nicht ein Amt unter vielen. Führt ein
  // Verein keine Vorstandsämter, bleibt es bei der einen Liste; eine leere
  // Gruppe wäre eine Überschrift ohne Inhalt.
  const { board, others } = groupOffices(rows);
  // Aus der Liste gelesen, nicht kopiert: Nach dem Sichern zeigt das Blatt
  // den neuen Stand.
  const openOffice = rows.find((office) => office.id === openId) ?? null;
  const editOffice = rows.find((office) => office.id === editId) ?? null;

  async function readFile(file: File) {
    try {
      setImportFile({ text: await file.text(), name: file.name });
    } catch {
      toast.failure(t('offices.markdown.fileError'));
    }
  }

  function startEdit(office: Office) {
    setOpenId(null);
    setEditId(office.id);
  }

  function renderRow(office: Office) {
    const names = holderNames(office.holders);
    const item = (
      <IonItem button detail onClick={() => setOpenId(office.id)}>
        <IonLabel className="ion-text-wrap">
          <h2>{office.title}</h2>
          {/* Ein Sekundärtext: die Belegung – oder dass niemand da ist. */}
          <IonNote>{names.length > 0 ? names.join(', ') : t('offices.holdersEmpty')}</IonNote>
        </IonLabel>
        {/* Genau ein Status-Element rechts (BR-183). */}
        {isVacant(office) ? (
          <IonBadge
            slot="end"
            color="warning"
            aria-label={t('offices.openSeats', { count: openSeats(office) })}
          >
            {openSeats(office)}
          </IonBadge>
        ) : (
          <IonNote slot="end">{t('offices.occupied')}</IonNote>
        )}
      </IonItem>
    );

    if (!isAdmin) return <div key={office.id}>{item}</div>;

    return (
      <IonItemSliding key={office.id}>
        {item}
        <IonItemOptions side="end">
          <IonItemOption color="danger" onClick={() => setDissolving(office)}>
            {t('offices.remove')}
          </IonItemOption>
        </IonItemOptions>
      </IonItemSliding>
    );
  }

  return (
    <AppPage
      title={t('offices.title')}
      backHref={backHref}
      onRefresh={() => offices.refetch()}
      createActions={
        isAdmin
          ? [{ icon: addOutline, label: t('offices.add'), onClick: () => setCreating(true) }]
          : undefined
      }
    >
      {offices.isLoading ? (
        <SkeletonList />
      ) : offices.error ? (
        <ErrorState error={offices.error as Error} onRetry={() => void offices.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          message={t('offices.empty')}
          action={
            isAdmin
              ? { label: t('offices.add'), onClick: () => setCreating(true) }
              : { label: t('marketplace.title'), routerLink: '/tabs/marketplace' }
          }
        />
      ) : (
        <>
          {board.length > 0 && (
            <ListSection
              title={t('offices.boardGroup')}
              footnote={t('offices.boardGroupHint')}
            >
              {board.map(renderRow)}
            </ListSection>
          )}

          {others.length > 0 && (
            <ListSection
              title={t(board.length > 0 ? 'offices.otherGroup' : 'offices.list')}
              footnote={t('offices.hint')}
            >
              {others.map(renderRow)}
            </ListSection>
          )}
        </>
      )}

      {vacant.length > 0 && (
        <TextSection title={t('offices.vacantTitle')}>
          <p>{vacant.map((office) => office.title).join(', ')}</p>
          <p>
            <IonNote>{t('offices.vacantHint')}</IonNote>
          </p>
        </TextSection>
      )}

      {/* UC-041 A7/A8: Die Ämterbeschreibungen liegen nicht nur hier, sondern
          auch in der Ablage des Vereins – auf Drive, in SharePoint, im Ordner
          des Präsidiums. Der Abschnitt ist die Tür dorthin und zurück; das
          Einlesen steht bewusst nicht beim Plus, weil es kein leeres Formular
          öffnet, sondern eine Datei prüft. */}
      {isAdmin && (
        <ListSection
          title={t('offices.markdown.section')}
          footnote={t('offices.markdown.sectionHint')}
        >
          <IonItem
            button
            detail={false}
            disabled={rows.length === 0}
            onClick={() => void markdown.exportOffices(rows)}
          >
            <IonLabel className="ion-text-wrap">
              <h2>{t('offices.markdown.exportAll')}</h2>
              <IonNote>{t('offices.markdown.exportAllHint')}</IonNote>
            </IonLabel>
          </IonItem>
          <IonItem button detail={false} onClick={() => fileInput.current?.click()}>
            <IonLabel className="ion-text-wrap">
              <h2>{t('offices.markdown.import')}</h2>
              <IonNote>{t('offices.markdown.importHint')}</IonNote>
            </IonLabel>
          </IonItem>
          <IonItem button detail={false} onClick={() => void markdown.exportTemplate()}>
            <IonLabel className="ion-text-wrap">
              <h2>{t('offices.markdown.template')}</h2>
              <IonNote>{t('offices.markdown.templateHint')}</IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* Der Dateiwähler ist ein verstecktes Feld – der sichtbare Weg trägt
          den Namen der Handlung (wie beim Factsheet und beim Zahlungsabgleich). */}
      <input
        ref={fileInput}
        type="file"
        accept={OFFICE_MARKDOWN_ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void readFile(file);
        }}
      />

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
              const office = dissolving;
              if (!office) return;
              remove.mutate(office, {
                onSuccess: () => toast.success(t('offices.removed')),
                onError: (error) => toast.failure((error as Error).message),
              });
            },
          },
        ]}
      />

      <OfficeDetailModal
        office={openOffice}
        onEdit={isAdmin ? startEdit : undefined}
        onDissolve={
          isAdmin
            ? (office) => {
                // Das Blatt schliesst zuerst, dann fragt derselbe Alert wie beim Wischen.
                setOpenId(null);
                setDissolving(office);
              }
            : undefined
        }
        onDismiss={() => setOpenId(null)}
      />

      <OfficeImportModal
        file={importFile}
        onDismiss={() => setImportFile(null)}
        onDone={() => setImportFile(null)}
      />

      <OfficeFormModal
        isOpen={creating || editOffice !== null}
        office={editOffice}
        onDismiss={() => {
          setCreating(false);
          setEditId(null);
        }}
        onDone={() => {
          setCreating(false);
          setEditId(null);
          toast.success(t('common.saved'));
        }}
      />
    </AppPage>
  );
}
