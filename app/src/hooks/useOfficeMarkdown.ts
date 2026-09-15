import { Share } from '@capacitor/share';
import { useTranslation } from 'react-i18next';
import { useClub } from './useClub';
import { useToast } from './useToast';
import { deliverFile } from '../lib/fileExport';
import { canShareNatively } from '../lib/invite';
import type { Office } from '../lib/office';
import {
  OFFICE_MARKDOWN_MIME,
  officeMarkdownDocument,
  officeMarkdownFileName,
  officeMarkdownLang,
  officeTemplateMarkdown,
} from '../lib/officeMarkdown';

/**
 * Ämterbeschreibungen aus der App herausgeben (UC-041 A7, FR-193).
 *
 * Ein Hook und nicht drei Stellen mit demselben Ablauf: Das Blatt eines
 * Amtes, die Ämterliste und die Vorlage geben dieselbe Sorte Datei heraus,
 * und der Weg dorthin – Teilen-Blatt auf dem Gerät, Download im Browser,
 * Zwischenablage als Rückfall – steht in `fileExport.ts`.
 *
 * Die Sprache der Datei ist die Sprache der App: Wer den Verein auf
 * Französisch führt, legt französische Blätter in die Ablage. Gelesen wird
 * beim Einlesen jede der vier Sprachen.
 */
export function useOfficeMarkdown() {
  const { t, i18n } = useTranslation();
  const { activeClub } = useClub();
  const toast = useToast();

  const lang = officeMarkdownLang(i18n.language);

  async function deliver(text: string, fileName: string, success: string): Promise<void> {
    const outcome = await deliverFile({
      text,
      fileName,
      title: fileName,
      mimeType: OFFICE_MARKDOWN_MIME,
      canShareNatively: canShareNatively(),
      share: (input) => Share.share(input),
    });
    if (outcome === 'failed') {
      toast.failure(t('common.error'));
      return;
    }
    toast.success(outcome === 'copied' ? t('offices.markdown.copied') : success);
  }

  return {
    /** Ein Amt oder alle – der Dateiname sagt, was drin ist. */
    exportOffices: (offices: readonly Office[]) => {
      if (offices.length === 0) {
        toast.failure(t('offices.markdown.nothing'));
        return Promise.resolve();
      }
      const doc = officeMarkdownDocument({
        offices,
        clubName: activeClub?.name,
        clubSlug: activeClub?.slug,
        lang,
      });
      return deliver(
        doc.text,
        doc.fileName,
        t('offices.markdown.exported', { count: offices.length }),
      );
    },

    /** Die leere Vorlage für ein Amt, das es in der App noch nicht gibt. */
    exportTemplate: () =>
      deliver(
        officeTemplateMarkdown(lang),
        officeMarkdownFileName(activeClub?.slug, t('offices.markdown.templateName')),
        t('offices.markdown.templateDone'),
      ),
  };
}
