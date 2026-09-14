import { useState } from 'react';
import { IonCheckbox, IonItem } from '@ionic/react';
import { Share } from '@capacitor/share';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useMemberExport } from '../hooks/useMembers';
import { useSheetProps } from '../hooks/useSheetProps';
import { useToast } from '../hooks/useToast';
import { deliverCsv } from '../lib/csv';
import { canShareNatively } from '../lib/invite';
import {
  DEFAULT_MEMBER_EXPORT_OPTIONS,
  MEMBER_EXPORT_FIELDS,
  effectiveExportOptions,
  memberExportCsv,
  memberExportFileName,
  type MemberExportOptions,
} from '../lib/memberExport';
import { FormModal } from './FormModal';
import { ListSection } from './ListSection';

interface MemberExportProps {
  /** Das Team, das herausgeht – `null` heisst der ganze Verein (BR-205). */
  teamId: string | null;
  /** Nur für den Dateinamen. */
  teamName: string | null;
  /**
   * Die Mitglieder, die die Liste gerade zeigt. Der Server liefert den
   * ganzen Geltungsbereich; diese Menge schneidet den Filter der Ansicht
   * darauf – wie in der bestehenden myclub-App. `null` heisst «nicht
   * filtern», etwa aus dem Team-Blatt heraus.
   */
  memberIds: string[] | null;
  onDismiss: () => void;
}

/**
 * Welche Felder mitgehen (UC-043, Schritt 3).
 *
 * Die alte myclub-App fragt das über einen `IonAlert` mit Kontrollkästchen.
 * Hier ist es ein Blatt: Sechs Kästchen mit Erklärung passen nicht in einen
 * Alert, und die Feldauswahl ist ein Formular, kein Rückfrage-Dialog
 * (guidelines §2).
 *
 * Warum nicht einfach alles exportieren? Weil eine Datei mit Adressen etwas
 * anderes ist als eine Kaderliste. Wer nur Namen und Teams braucht, soll
 * keine Adressen in der Hand haben.
 */
export function MemberExportForm({
  teamId,
  teamName,
  memberIds,
  onDismiss,
  isOpen = true,
}: MemberExportProps & { isOpen?: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { activeClub, isAdmin } = useClub();
  const exportMembers = useMemberExport();

  const [options, setOptions] = useState<MemberExportOptions>(
    DEFAULT_MEMBER_EXPORT_OPTIONS,
  );

  /**
   * BR-206: Was der Server einer Trainer:in nicht gibt, soll das Blatt ihr
   * auch nicht anbieten – ein Kästchen, das nichts bewirkt, ist ein Versprechen,
   * das die Datei nicht hält.
   *
   * `isAdmin` und **nicht** `isBoard`: `export_members()` entscheidet den
   * Umfang mit `is_club_admin()` (0082). Stünde hier die weitere Rolle, zeigte
   * das Blatt der Sportchef:in Kästchen, die der Server ignoriert.
   */
  const available = MEMBER_EXPORT_FIELDS.filter(
    (field) => isAdmin || (field !== 'address' && field !== 'birthDate'),
  );

  async function run() {
    try {
      const all = await exportMembers.mutateAsync(teamId);
      const rows = memberIds
        ? all.filter((row) => memberIds.includes(row.member_id))
        : all;

      // E1: Ein leerer Ausschnitt erzeugt keine Datei.
      if (rows.length === 0) {
        toast.failure(t('memberExport.empty'));
        return;
      }

      // Die ausgeblendeten Felder dürfen auch keine (leere) Spalte bekommen.
      const csv = memberExportCsv(
        rows,
        effectiveExportOptions(options, isAdmin),
        {
          firstName: t('profile.firstName'),
          lastName: t('profile.lastName'),
          displayName: t('profile.displayName'),
          email: t('auth.email'),
          phone: t('profile.phone'),
          birthDate: t('profile.birthDate'),
          street: t('profile.street'),
          houseNumber: t('profile.houseNumber'),
          postalCode: t('profile.postalCode'),
          city: t('profile.city'),
          country: t('profile.country'),
          role: t('invite.roleLabel'),
          status: t('members.status'),
          memberSince: t('profile.memberSinceLabel'),
          teams: t('memberExport.teams'),
          offices: t('memberExport.offices'),
        },
        {
          role: (value) =>
            t(`invite.role.${value === 'superadmin' ? 'admin' : value}`, {
              defaultValue: value,
            }),
          status: (value) => t(`members.statusValue.${value}`, { defaultValue: value }),
        },
      );

      const fileName = memberExportFileName(activeClub?.slug, teamName);

      // Derselbe Weg wie beim Beitrags-Export (UC-042), und zwar derselbe
      // Code: `deliverCsv()` in `lib/csv.ts`.
      const outcome = await deliverCsv({
        csv,
        fileName,
        title: fileName,
        canShareNatively: canShareNatively(),
        share: (input) => Share.share(input),
      });

      if (outcome === 'failed') {
        toast.failure(t('common.error'));
        return;
      }
      toast.success(
        outcome === 'copied'
          ? t('memberExport.copied')
          : t('memberExport.done', { count: rows.length }),
      );
      onDismiss();
    } catch (cause) {
      toast.failure(cause instanceof Error ? cause.message : t('common.error'));
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={t('memberExport.title')}
      submitLabel={t('memberExport.submit')}
      isSubmitting={exportMembers.isPending}
      error={exportMembers.error ? (exportMembers.error as Error).message : null}
      onDismiss={onDismiss}
      onSubmit={() => void run()}
    >
      <ListSection
        title={t('memberExport.fields')}
        footnote={isAdmin ? t('memberExport.fieldsHint') : t('memberExport.trainerHint')}
      >
        {available.map((field) => (
          <IonItem key={field}>
            <IonCheckbox
              checked={options[field]}
              onIonChange={(e) =>
                setOptions((current) => ({ ...current, [field]: e.detail.checked }))
              }
            >
              {t(`memberExport.field.${field}`)}
            </IonCheckbox>
          </IonItem>
        ))}
      </ListSection>
    </FormModal>
  );
}

/** Blatt-Hülle; der Inhalt entsteht beim Öffnen und fällt erst, wenn das Blatt unten ist. */
export function MemberExportModal({
  isOpen,
  ...props
}: MemberExportProps & { isOpen: boolean }) {
  const sheet = useSheetProps(isOpen ? props : null);
  return sheet && <MemberExportForm {...sheet} />;
}
