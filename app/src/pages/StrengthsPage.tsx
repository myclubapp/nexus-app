import { useState } from 'react';
import { IonItem, IonLabel, IonNote } from '@ionic/react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { TextSection } from '../components/TextSection';
import { FormModal } from '../components/FormModal';
import { RadarChart } from '../components/RadarChart';
import { ErrorState } from '../components/StateViews';
import { SkeletonCard } from '../components/Skeletons';
import { useValueDimensions } from '../hooks/useGamification';
import {
  hasSeries,
  seriesOf,
  strongestDimension,
  type Dimension,
} from '../lib/dimensions';

/**
 * «Meine Stärken» – die fünf Wertdimensionen (UC-024).
 *
 * Die Seite benennt eine **Stärke** und nirgends eine Lücke (BR-101). Es gibt
 * keine Gesamtnote, keinen Rang und keine Sortierung – auch nicht in der
 * Führungssicht (BR-102, A4).
 *
 * Eine Dimension ohne Erhebung erscheint als «nicht erhoben» und **nie** als
 * Wert null (BR-103): «Finanzen» ist heute genau dieser Fall.
 */
export function StrengthsPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  // A4: Die Führungssicht öffnet dasselbe Diagramm für ein Mitglied des
  // eigenen Teams. Ob das zulässig ist, entscheidet der Server.
  const memberId = params.get('member');
  const dimensions = useValueDimensions(memberId);

  const [explain, setExplain] = useState<Dimension | null>(null);

  const rows = dimensions.data ?? [];
  const strongest = strongestDimension(rows);
  const labels = rows.map((row) => t(`dimensions.${row.dimension}.title`));

  return (
    <AppPage
      title={memberId ? t('dimensions.leadTitle') : t('dimensions.title')}
      backHref="/tabs/profile"
      onRefresh={() => dimensions.refetch()}
    >
      {dimensions.isLoading ? (
        <SkeletonCard />
      ) : dimensions.error ? (
        <ErrorState
          error={dimensions.error as Error}
          onRetry={() => void dimensions.refetch()}
        />
      ) : (
        <>
          <RadarChart
            labels={labels}
            description={t('dimensions.chartDescription')}
            series={[
              { tone: 'own', values: seriesOf(rows, 'own') },
              ...(hasSeries(rows, 'team')
                ? [{ tone: 'team' as const, values: seriesOf(rows, 'team') }]
                : []),
              ...(hasSeries(rows, 'club')
                ? [{ tone: 'club' as const, values: seriesOf(rows, 'club') }]
                : []),
            ]}
          />

          {/* Schritt 4: die stärkste Dimension, positiv benannt. */}
          <ListSection footnote={t('dimensions.legend')}>
            <IonItem lines="none">
              <IonLabel className="ion-text-wrap">
                <h2>
                  {strongest
                    ? t('dimensions.strongest', {
                        name: t(`dimensions.${strongest}.title`),
                      })
                    : /* A1: noch zu wenig Beiträge – dann wird keine Stärke
                         erfunden, sondern gesagt, dass sich das füllt. */
                      t('dimensions.tooEarly')}
                </h2>
              </IonLabel>
            </IonItem>
          </ListSection>

          {/* Schritte 5–6: antippen erklärt, woraus eine Dimension entsteht. */}
          <ListSection title={t('dimensions.overview')}>
            {rows.map((row) => (
              <IonItem
                key={row.dimension}
                button
                detail
                onClick={() => setExplain(row.dimension)}
              >
                <IonLabel className="ion-text-wrap">
                  <h2>{t(`dimensions.${row.dimension}.title`)}</h2>
                  <IonNote>
                    {row.teamValue !== null || row.clubValue !== null
                      ? t('dimensions.comparison', {
                          team: row.teamValue ?? '–',
                          club: row.clubValue ?? '–',
                        })
                      : t('dimensions.noComparison')}
                  </IonNote>
                </IonLabel>
                {/* BR-103: nicht erhoben steht als Wort da, nicht als Zahl. */}
                <IonNote slot="end" color={row.collected ? 'primary' : 'medium'}>
                  {row.collected ? row.ownValue : t('dimensions.notCollected')}
                </IonNote>
              </IonItem>
            ))}
          </ListSection>
        </>
      )}

      <FormModal
        isOpen={explain !== null}
        title={explain ? t(`dimensions.${explain}.title`) : ''}
        onDismiss={() => setExplain(null)}
      >
        {explain && (
          <>
            <TextSection title={t('dimensions.madeOf')}>
              <p>{t(`dimensions.${explain}.source`)}</p>
            </TextSection>
            <TextSection title={t('dimensions.howToGrow')}>
              <p>{t(`dimensions.${explain}.grow`)}</p>
            </TextSection>
          </>
        )}
      </FormModal>
    </AppPage>
  );
}
