import { useState } from "react";
import {
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonToggle,
} from "@ionic/react";
import { useTranslation } from "react-i18next";
import { AppPage } from "../components/AppPage";
import { ListSection } from "../components/ListSection";
import { ErrorState, InlineError } from "../components/StateViews";
import { SkeletonList } from "../components/Skeletons";
import {
  useForgetDevice,
  useNotificationSettings,
  usePushDevices,
  useSaveNotificationSettings,
} from "../hooks/useNotificationSettings";
import { useToast } from "../hooks/useToast";
import { formatDate } from "../lib/format";
import {
  EMPTY_SETTINGS,
  PUSH_CATEGORIES,
  hasQuietHours,
  isPushEnabled,
  isQuietWindowValid,
  type NotificationSettings,
  type PushCategory,
} from "../lib/notifications";

/**
 * Benachrichtigungen einstellen (UC-028).
 *
 * BR-117 steht zuoberst und als Aussage, nicht als ausgegrauter Schalter: Die
 * Inbox ist nicht abschaltbar, und die Seite sagt auch warum. Ein deaktivierter
 * Umschalter erklärt nichts.
 *
 * Push selbst gibt es noch nicht (FR-079). Die Seite sagt das offen, statt
 * Schalter anzubieten, die ins Leere führen – aber die Einstellungen wirken
 * bereits: `notify()` vermerkt an jeder Zeile, ob sie hinausgehen dürfte.
 */
export function NotificationsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const stored = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const devices = usePushDevices();
  const forget = useForgetDevice();

  // Der Entwurf entsteht **während des Renderns** aus dem Serverstand, solange
  // niemand etwas angefasst hat. Ein Effekt, der den Stand in den Zustand
  // kopiert, wäre ein zweiter Durchlauf für nichts – und liesse den Umschalter
  // beim ersten Laden kurz springen.
  const [edits, setEdits] = useState<NotificationSettings | null>(null);
  const draft = edits ?? stored.data ?? EMPTY_SETTINGS;

  const windowValid = isQuietWindowValid(draft);

  function setDraft(
    update: (current: NotificationSettings) => NotificationSettings,
  ) {
    setEdits((current) => update(current ?? stored.data ?? EMPTY_SETTINGS));
  }

  function setCategory(category: PushCategory, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      push: { ...current.push, [category]: enabled },
    }));
  }

  return (
    <AppPage
      title={t("notifications.title")}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([stored.refetch(), devices.refetch()])}
    >
      {/* Schritt 3: die Begründung, nicht bloss die Sperre. */}
      <ListSection
        title={t("notifications.inbox")}
        footnote={t("notifications.inboxWhy")}
      >
        <IonItem lines="none">
          <IonLabel className="ion-text-wrap">
            <p>{t("notifications.inboxAlways")}</p>
          </IonLabel>
        </IonItem>
      </ListSection>

      {stored.isLoading ? (
        <SkeletonList />
      ) : stored.error ? (
        <ErrorState
          error={stored.error as Error}
          onRetry={() => void stored.refetch()}
        />
      ) : (
        <>
          <ListSection
            title={t("notifications.push")}
            footnote={t("notifications.pushPending")}
          >
            {PUSH_CATEGORIES.map((category) => (
              <IonItem key={category}>
                <IonToggle
                  checked={isPushEnabled(draft, category)}
                  onIonChange={(e) => setCategory(category, e.detail.checked)}
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`notifications.category.${category}.title`)}</h2>
                    <IonNote>
                      {t(`notifications.category.${category}.body`)}
                    </IonNote>
                  </IonLabel>
                </IonToggle>
              </IonItem>
            ))}
          </ListSection>

          {/* A3: stille Zeiten. */}
          <ListSection
            title={t("notifications.quiet")}
            footnote={t("notifications.quietHint")}
          >
            <IonItem>
              <IonToggle
                checked={hasQuietHours(draft)}
                onIonChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    quietFrom: e.detail.checked
                      ? (current.quietFrom ?? "22:00")
                      : null,
                    quietTo: e.detail.checked
                      ? (current.quietTo ?? "07:00")
                      : null,
                  }))
                }
              >
                <IonLabel>{t("notifications.quietOn")}</IonLabel>
              </IonToggle>
            </IonItem>

            {hasQuietHours(draft) && (
              <>
                <IonItem>
                  <IonInput
                    type="time"
                    label={t("notifications.quietFrom")}
                    labelPlacement="stacked"
                    value={draft.quietFrom ?? ""}
                    onIonInput={(e) =>
                      setDraft((current) => ({
                        ...current,
                        quietFrom: e.detail.value || null,
                      }))
                    }
                  />
                </IonItem>
                <IonItem>
                  <IonInput
                    type="time"
                    label={t("notifications.quietTo")}
                    labelPlacement="stacked"
                    value={draft.quietTo ?? ""}
                    onIonInput={(e) =>
                      setDraft((current) => ({
                        ...current,
                        quietTo: e.detail.value || null,
                      }))
                    }
                  />
                </IonItem>
              </>
            )}
          </ListSection>

          {!windowValid && (
            <InlineError message={t("notifications.quietInvalid")} />
          )}

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={save.isPending || !windowValid}
              onClick={() =>
                save.mutate(draft, {
                  onSuccess: () => {
                    // Nach dem Speichern führt wieder der Serverstand.
                    setEdits(null);
                    toast.success(t("notifications.saved"));
                  },
                  onError: (cause) => toast.failure(cause.message),
                })
              }
            >
              {t("common.save")}
            </IonButton>
          </div>

          {/* A4: die registrierten Geräte. */}
          <ListSection
            title={t("notifications.devices")}
            footnote={t("notifications.devicesHint")}
          >
            {(devices.data ?? []).length === 0 ? (
              <IonItem>
                <IonNote>{t("notifications.noDevices")}</IonNote>
              </IonItem>
            ) : (
              (devices.data ?? []).map((device) => (
                <IonItem key={device.id}>
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`notifications.platform.${device.platform}`)}</h2>
                    <IonNote>{formatDate(device.createdAt)}</IonNote>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    size="small"
                    fill="clear"
                    color="medium"
                    disabled={forget.isPending}
                    onClick={() =>
                      forget.mutate(device.id, {
                        onSuccess: () =>
                          toast.success(t("notifications.deviceForgotten")),
                        onError: (cause) => toast.failure(cause.message),
                      })
                    }
                  >
                    {t("notifications.forget")}
                  </IonButton>
                </IonItem>
              ))
            )}
          </ListSection>

          {/* BR-120: was von alldem unberührt bleibt. */}
          <IonNote className="app-footnote">
            {t("notifications.securityNote")}
          </IonNote>
        </>
      )}
    </AppPage>
  );
}
