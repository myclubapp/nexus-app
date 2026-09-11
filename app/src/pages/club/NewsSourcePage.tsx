import { useEffect, useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../hooks/useClub';
import {
  useCheckWebsite,
  useConnectWebsite,
  useDisconnectWebsite,
  useNewsSource,
} from '../../hooks/useNewsSources';
import { useToast } from '../../hooks/useToast';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { SkeletonList } from '../../components/Skeletons';
import { EmptyState, ErrorState, InlineError } from '../../components/StateViews';
import { formatDateTime } from '../../lib/format';
import {
  categoryOptions,
  clampPostLimit,
  DEFAULT_POST_LIMIT,
  normaliseSiteUrl,
  parseCategories,
  POST_LIMIT_OPTIONS,
  postsEndpoint,
  siteLabel,
  type CategoryChoice,
} from '../../lib/wordpress';

/**
 * News von der Vereins-Website übernehmen (UC-038).
 *
 * Ein Bestandsverein hat seine Geschichte auf der Website und nicht in dieser
 * App. Wer sie mitnimmt, startet mit einem Feed voller echter Meldungen statt
 * mit Beispielinhalten – das ist der Unterschied zwischen «neues Werkzeug» und
 * «unser Verein» (BR-002, FR-146).
 *
 * Die Ansicht führt in drei Schritten: Adresse eingeben, Website prüfen,
 * Umfang einstellen und holen. Der mittlere Schritt ist der wichtigste – er
 * beantwortet, ob dort überhaupt WordPress läuft, bevor eine Quelle entsteht
 * (BR-173), und er liefert die Kategorien, ohne die der Vorstand nicht
 * entscheiden könnte, was er holen will (FR-149).
 *
 * Der Abruf selbst läuft in der Edge Function `import-wordpress-news`: Die
 * Websites antworten langsam und weisen Aufrufe ohne browserähnlichen
 * User-Agent ab. Danach gleicht der nächtliche Zeitplan von selbst ab
 * (0023_news_sync_schedule.sql).
 */
export function NewsSourcePage() {
  const { t } = useTranslation();
  const { isAdmin } = useClub();
  const toast = useToast();

  const source = useNewsSource();
  const check = useCheckWebsite();
  const connect = useConnectWebsite();
  const disconnect = useDisconnectWebsite();

  const [url, setUrl] = useState('');
  const [postLimit, setPostLimit] = useState(DEFAULT_POST_LIMIT);
  const [categories, setCategories] = useState<CategoryChoice[]>([]);
  // §5: Das Trennen ist eine Löschung und wird vorher gefragt.
  const [isDisconnecting, setDisconnecting] = useState(false);

  // Die gespeicherten Einstellungen einmal je Quelle in die Ansicht holen –
  // nicht bei jedem Neuladen der Abfrage. Sonst überschriebe ein Abgleich im
  // Hintergrund (Fensterwechsel) die Auswahl, die gerade jemand trifft.
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    const saved = source.data;
    if (!saved) {
      loaded.current = null;
      return;
    }
    if (loaded.current === saved.id) return;
    loaded.current = saved.id;
    setUrl(saved.url);
    setPostLimit(clampPostLimit(saved.post_limit));
    setCategories(parseCategories(saved.categories));
  }, [source.data]);

  const normalised = normaliseSiteUrl(url);
  const connected = source.data;

  // Geprüft wurde immer eine bestimmte Adresse. Tippt jemand danach weiter,
  // gehört das Ergebnis nicht mehr zu dem, was im Feld steht.
  const isCurrent = check.variables === normalised;
  const found = isCurrent ? (check.data ?? null) : null;
  const checkError = isCurrent ? (check.error as Error | null) : null;

  const options = categoryOptions(found?.categories ?? [], categories);
  const selectedIds = categories.map((category) => category.id);

  if (!isAdmin) {
    return (
      <AppPage title={t('newsImport.title')} backHref="/tabs/profile" largeTitle={false}>
        <EmptyState
          message={t('newsImport.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      </AppPage>
    );
  }

  return (
    <AppPage title={t('newsImport.title')} backHref="/tabs/profile" largeTitle={false}>
      {source.isLoading ? (
        <SkeletonList />
      ) : source.error ? (
        <ErrorState error={source.error as Error} onRetry={() => void source.refetch()} />
      ) : (
        <>
          <ListSection footnote={t('newsImport.urlHint')}>
            <IonItem>
              <IonInput
                type="url"
                inputmode="url"
                autocapitalize="off"
                autocorrect={false}
                label={t('newsImport.url')}
                labelPlacement="stacked"
                placeholder="verein.ch"
                value={url}
                onIonInput={(e) => setUrl(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {/* Die geprüfte Adresse steht vor dem Abruf da: Wer «verein.ch»
              tippt, soll sehen, dass daraus «https://verein.ch» wird, bevor
              eine Fehlermeldung von einer fremden Website kommt. */}
          {normalised && normalised !== connected?.url && (
            <ListSection>
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <IonNote>{t('newsImport.willFetch', { url: normalised })}</IonNote>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

          {/* Schritt 5: prüfen, ohne etwas zu speichern (BR-173). */}
          <div className="app-actions">
            <IonButton
              expand="block"
              fill="outline"
              disabled={!normalised || check.isPending}
              onClick={() => check.mutate(normalised!)}
            >
              {check.isPending ? <IonSpinner name="crescent" /> : t('newsImport.check')}
            </IonButton>
          </div>

          {checkError && (
            <>
              <InlineError message={checkError.message} />
              <IonNote className="app-footnote">{t('newsImport.checkFailedHint')}</IonNote>
            </>
          )}

          {/* Schritt 6: was die Website hergibt. */}
          {found && (
            <ListSection title={t('newsImport.found')}>
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <h2>{found.siteName ?? siteLabel(found.url)}</h2>
                  <IonNote>
                    {found.totalPosts === null
                      ? t('newsImport.foundWordpress')
                      : t('newsImport.foundPosts', { count: found.totalPosts })}
                  </IonNote>
                </IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel className="ion-text-wrap">
                  <IonNote>
                    {t('newsImport.foundEndpoint', {
                      url: postsEndpoint(found.url, found.apiStyle),
                    })}
                  </IonNote>
                </IonLabel>
              </IonItem>
            </ListSection>
          )}

          {/* Schritt 7: Umfang und Auswahl (FR-149, BR-174). */}
          <ListSection
            title={t('newsImport.scope')}
            footnote={
              options.length > 0
                ? t('newsImport.categoriesHint')
                : t('newsImport.categoriesUnknown')
            }
          >
            <IonItem>
              <IonSelect
                label={t('newsImport.postLimit')}
                labelPlacement="stacked"
                value={postLimit}
                onIonChange={(e) => setPostLimit(clampPostLimit(e.detail.value))}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {POST_LIMIT_OPTIONS.map((option) => (
                  <IonSelectOption key={option} value={option}>
                    {t('newsImport.postLimitValue', { count: option })}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonSelect
                multiple
                label={t('newsImport.categories')}
                labelPlacement="stacked"
                disabled={options.length === 0}
                placeholder={t('newsImport.categoriesAll')}
                value={selectedIds}
                onIonChange={(e) => {
                  const ids = (e.detail.value ?? []) as number[];
                  setCategories(
                    options
                      .filter((option) => ids.includes(option.id))
                      .map(({ id, name }) => ({ id, name })),
                  );
                }}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {options.map((option) => (
                  <IonSelectOption key={option.id} value={option.id}>
                    {option.count > 0
                      ? t('newsImport.categoryOption', {
                          name: option.name,
                          count: option.count,
                        })
                      : option.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>

          {connect.error && <InlineError message={(connect.error as Error).message} />}
          {disconnect.error && <InlineError message={(disconnect.error as Error).message} />}

          {/* Schritt 8: holen – und bei einer verbundenen Website zugleich die
              geänderten Einstellungen speichern (A6). */}
          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={!normalised || connect.isPending}
              onClick={() =>
                connect.mutate(
                  { url: normalised!, postLimit, categories },
                  {
                    onSuccess: (result) =>
                      toast.success(t('newsImport.imported', { count: result.imported })),
                  },
                )
              }
            >
              {connect.isPending ? (
                <IonSpinner name="crescent" />
              ) : connected ? (
                t('newsImport.refresh')
              ) : (
                t('newsImport.connect')
              )}
            </IonButton>
          </div>

          {connected && (
            <>
              <ListSection
                title={t('newsImport.status')}
                footnote={t('newsImport.scheduleHint')}
              >
                <IonItem>
                  <IonLabel className="ion-text-wrap">
                    <h2>{connected.site_name ?? siteLabel(connected.url)}</h2>
                    <IonNote>
                      {connected.last_sync_at
                        ? t('newsImport.lastSync', {
                            when: formatDateTime(connected.last_sync_at),
                            count: connected.last_imported,
                          })
                        : t('newsImport.neverSynced')}
                    </IonNote>
                  </IonLabel>
                </IonItem>

                {/* Was gespeichert ist, nicht was gerade im Formular steht:
                    Sonst behauptete die Zeile eine Einstellung, die noch
                    niemand gespeichert hat. */}
                <IonItem>
                  <IonLabel className="ion-text-wrap">
                    <IonNote>
                      {t('newsImport.savedScope', {
                        count: clampPostLimit(connected.post_limit),
                        categories:
                          parseCategories(connected.categories)
                            .map((category) => category.name)
                            .join(', ') || t('newsImport.categoriesAll'),
                      })}
                    </IonNote>
                  </IonLabel>
                </IonItem>

                {/* Der letzte Fehler bleibt stehen, bis ein Abgleich glückt.
                    Sonst wundert sich der Vorstand wochenlang, warum von der
                    Website nichts mehr ankommt (A3). */}
                {connected.last_status === 'error' && connected.last_error && (
                  <IonItem>
                    <IonLabel className="ion-text-wrap">
                      <IonText color="danger">
                        <h2>{t('newsImport.lastError')}</h2>
                      </IonText>
                      <IonNote>{connected.last_error}</IonNote>
                    </IonLabel>
                  </IonItem>
                )}
              </ListSection>

              <div className="app-actions">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="medium"
                  disabled={disconnect.isPending}
                  onClick={() => setDisconnecting(true)}
                >
                  {disconnect.isPending ? (
                    <IonSpinner name="crescent" />
                  ) : (
                    t('newsImport.disconnect')
                  )}
                </IonButton>
              </div>

              <IonAlert
                isOpen={isDisconnecting}
                header={t('newsImport.disconnect')}
                message={t('newsImport.disconnectConfirm')}
                onDidDismiss={() => setDisconnecting(false)}
                buttons={[
                  { text: t('common.cancel'), role: 'cancel' },
                  {
                    text: t('newsImport.disconnect'),
                    role: 'destructive',
                    handler: () =>
                      disconnect.mutate(connected.id, {
                        onSuccess: () => {
                          setUrl('');
                          setPostLimit(DEFAULT_POST_LIMIT);
                          setCategories([]);
                          check.reset();
                          toast.success(t('newsImport.disconnected'));
                        },
                        onError: (cause) => toast.failure(cause.message),
                      }),
                  },
                ]}
              />
            </>
          )}
        </>
      )}
    </AppPage>
  );
}
