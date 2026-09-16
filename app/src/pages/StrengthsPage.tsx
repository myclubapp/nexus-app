import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { StrengthsSection } from '../components/StrengthsSection';
import { useValueDimensions } from '../hooks/useGamification';

/**
 * «Meine Stärken» als eigene Seite – heute die **Führungssicht** (UC-024, A4):
 * dasselbe Diagramm für ein Mitglied des eigenen Teams, geöffnet aus der
 * Mitgliederliste. Ob das zulässig ist, entscheidet der Server.
 *
 * Für einen selbst steht das Diagramm nicht mehr hier, sondern auf dem
 * Wirkungs-Tab: Die eigenen Dimensionen sind kein Eintrag in den
 * Einstellungen, sondern der Kern dessen, was der Tab zeigt.
 */
export function StrengthsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const memberId = params.get('member');
  // Nur für das Nachladen am Bildschirmrand – das Diagramm holt dieselbe
  // Abfrage, der Cache liefert sie beiden.
  const dimensions = useValueDimensions(memberId);

  return (
    <AppPage
      title={memberId ? t('dimensions.leadTitle') : t('dimensions.title')}
      /* Zurück dorthin, wo die Sicht geöffnet wurde: aus der Mitgliederliste
         in die Mitgliederliste. */
      backHref={memberId ? '/tabs/profile/members' : '/tabs/impact'}
      onRefresh={() => dimensions.refetch()}
    >
      <StrengthsSection memberId={memberId} />
    </AppPage>
  );
}
