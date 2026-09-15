import { useState } from 'react';
import {
  IonButton,
  IonCheckbox,
  IonItem,
  IonLabel,
  IonNote,
  IonTextarea,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { ManageSection } from '../components/ManageSection';
import { PulseGreetingModal } from '../components/PulseGreetingModal';
import { PulsePreviewModal } from '../components/PulsePreviewModal';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState, InlineError } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import {
  useComposePulse,
  useConnectionRatio,
  useDiscardPulse,
  usePulseDraft,
  useReleasePulse,
} from '../hooks/usePulse';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../lib/format';
import {
  PULSE_SECTIONS,
  allItems,
  isEmpty,
  itemsOf,
  ratioTilted,
} from '../lib/pulse';

/**
 * Den Vereins-Puls freigeben (UC-027, Schritte 3–6).
 *
 * BR-115: Der Entwurf ist vollständig vorkomponiert. Wer nichts anfasst, kann
 * sofort freigeben – deshalb sind zu Beginn **alle** Einträge angehakt und das
 * Einleitungsfeld ist leer und freiwillig.
 *
 * Oben steht die Verbindungs-Quote (FR-070): Sie ist der Grund, warum es
 * diese Seite gibt.
 */
export function PulsePage() {
  const { t } = useTranslation();
  const toast = useToast();
  const draft = usePulseDraft();
  const ratio = useConnectionRatio();
  const release = useReleasePulse();
  const discard = useDiscardPulse();
  const compose = useComposePulse();

  const [intro, setIntro] = useState('');
  // FR-189: Zwei Blätter, die nichts versenden – die Vorschau und die
  // Einrichtung der Grussformel.
  const [previewOpen, setPreviewOpen] = useState(false);
  const [greetingOpen, setGreetingOpen] = useState(false);
  // A3 nach einem Anstoss von Hand: Der Lauf fand nichts. Das gehört in die
  // Fläche und nicht in einen Toast – die Erklärung muss stehen bleiben,
  // solange der Bildschirm leer ist (BR-165).
  const [nothingToTell, setNothingToTell] = useState(false);
  // `null` heisst «noch nichts gestrichen» – dann geht der Entwurf unverändert
  // raus, ohne dass der Client eine Liste schicken muss.
  const [struck, setStruck] = useState<Set<string> | null>(null);

  const pulse = draft.data ?? null;
  const kept = new Set(
    pulse
      ? allItems(pulse)
          .map((item) => item.id)
          .filter((id) => !struck?.has(id))
      : [],
  );

  function toggle(id: string, keep: boolean) {
    setStruck((current) => {
      const next = new Set(current ?? []);
      if (keep) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppPage
      title={t('pulse.title')}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([draft.refetch(), ratio.refetch()])}
    >
      {/* FR-070: die Quote, endlich sichtbar. */}
      {ratio.data && (
        <>
          <div className="app-stat-row">
            <StatCard
              value={ratio.data.connections}
              label={t('pulse.connections')}
            />
            <StatCard
              value={ratio.data.calls}
              label={t('pulse.calls')}
              accent="tertiary"
            />
          </div>
          <IonNote className="app-footnote">
            {ratioTilted(ratio.data) ? t('pulse.ratioTilted') : t('pulse.ratioHint')}
          </IonNote>
        </>
      )}

      {draft.isLoading ? (
        <SkeletonList />
      ) : draft.error ? (
        <ErrorState error={draft.error as Error} onRetry={() => void draft.refetch()} />
      ) : !pulse ? (
        /* A3: Es liegt nichts vor – BR-165 verlangt trotzdem einen nächsten
           Schritt. Seit `0094` ist das der Entwurf selbst: Der wöchentliche
           Lauf ist montags, und wer bis dahin warten müsste, hätte hier eine
           Seite ohne Handlung. Bleibt auch dann nichts übrig, kann der Vorstand
           im Feed selbst etwas erzählen. */
        <>
          <EmptyState
            message={nothingToTell ? t('pulse.nothingToTell') : t('pulse.noDraft')}
            action={{
              label: compose.isPending ? t('common.loading') : t('pulse.compose'),
              onClick: () => {
                setNothingToTell(false);
                compose.mutate(undefined, {
                  onSuccess: (pulseId) => {
                    if (pulseId) toast.success(t('pulse.composed'));
                    else setNothingToTell(true);
                  },
                  onError: (cause) => toast.failure(cause.message),
                });
              },
            }}
          />
          <div className="app-actions">
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              routerLink="/tabs/dashboard"
            >
              {t('pulse.tellSomething')}
            </IonButton>
            <IonNote>{t('pulse.composeHint')}</IonNote>
          </div>
        </>
      ) : (
        <>
          <IonNote className="app-footnote">
            {t('pulse.composedOn', { date: formatDate(pulse.composedAt) })}
          </IonNote>

          {/* BR-113: drei Fragen, feste Reihenfolge. */}
          {PULSE_SECTIONS.map((section) => {
            const items = itemsOf(pulse, section);
            if (items.length === 0) return null;
            return (
              <ListSection key={section} title={t(`pulse.section.${section}`)}>
                {items.map((item) => (
                  <IonItem key={item.id}>
                    <IonCheckbox
                      checked={kept.has(item.id)}
                      onIonChange={(e) => toggle(item.id, e.detail.checked)}
                    >
                      <IonLabel className="ion-text-wrap">
                        <h2>{item.title}</h2>
                        {/* Die Art steht dabei: «Woran wir arbeiten» mischt
                            publizierte Entscheide und laufende Aufgaben, und
                            ohne dieses Wort sähen beide gleich aus. */}
                        <IonNote>
                          {t(`pulse.kind.${item.kind}`)}
                          {' · '}
                          {item.at ? formatDate(item.at) : t('pulse.noDate')}
                        </IonNote>
                      </IonLabel>
                    </IonCheckbox>
                  </IonItem>
                ))}
              </ListSection>
            );
          })}

          {/* Schritt 5: freiwillig – BR-115 verlangt keine Texterstellung. */}
          <ListSection title={t('pulse.intro')} footnote={t('pulse.introHint')}>
            <IonItem>
              <IonTextarea
                label={t('pulse.introLabel')}
                labelPlacement="stacked"
                autoGrow
                value={intro}
                onIonInput={(e) => setIntro(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {isEmpty(pulse, kept) && <InlineError message={t('pulse.allStruck')} />}

          <div className="app-actions">
            {/* FR-189: sehen, was ankommt – **vor** der Freigabe. Sie steht
                deshalb über dem Freigabeknopf und nicht daneben. */}
            <IonButton
              expand="block"
              fill="outline"
              disabled={isEmpty(pulse, kept)}
              onClick={() => setPreviewOpen(true)}
            >
              {t('pulse.preview')}
            </IonButton>

            <IonButton
              expand="block"
              disabled={release.isPending || isEmpty(pulse, kept)}
              onClick={() =>
                release.mutate(
                  {
                    pulseId: pulse.id,
                    intro,
                    // Nichts gestrichen heisst: keine Liste schicken.
                    keep: struck === null ? null : [...kept],
                  },
                  {
                    onSuccess: (count) => {
                      setIntro('');
                      setStruck(null);
                      toast.success(t('pulse.released', { count }));
                    },
                    onError: (cause) => toast.failure(cause.message),
                  },
                )
              }
            >
              {t('pulse.release')}
            </IonButton>

            {/* A2: «Diese Woche nicht». */}
            <IonButton
              expand="block"
              fill="clear"
              color="medium"
              disabled={discard.isPending}
              onClick={() =>
                discard.mutate(pulse.id, {
                  onSuccess: () => toast.success(t('pulse.discarded')),
                  onError: (cause) => toast.failure(cause.message),
                })
              }
            >
              {t('pulse.discard')}
            </IonButton>
            <IonNote>{t('pulse.discardHint')}</IonNote>
          </div>
        </>
      )}

      {/* Die Grussformel gehört nicht an den einzelnen Puls, sondern an das
          Amt (BR-252) – deshalb steht sie als Verwaltungsweg und ist auch
          erreichbar, wenn diese Woche kein Entwurf vorliegt. */}
      <ManageSection
        actions={[
          {
            label: t('pulse.greetingManage'),
            detail: true,
            onClick: () => setGreetingOpen(true),
          },
        ]}
        footnote={t('pulse.greetingManageHint')}
      />

      <PulsePreviewModal
        isOpen={previewOpen}
        onDismiss={() => setPreviewOpen(false)}
        pulseId={pulse?.id ?? null}
        keep={struck === null ? null : [...kept]}
      />

      <PulseGreetingModal isOpen={greetingOpen} onDismiss={() => setGreetingOpen(false)} />
    </AppPage>
  );
}
