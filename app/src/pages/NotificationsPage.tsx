import { useState } from "react";
import {
  IonButton,
  IonItem,
  IonLabel,
  IonListHeader,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonToggle,
} from "@ionic/react";
import { useTranslation } from "react-i18next";
import { AppPage } from "../components/AppPage";
import { ListSection } from "../components/ListSection";
import { TextSection } from "../components/TextSection";
import { DateField } from '../components/DateField';
import { ErrorState, InlineError } from "../components/StateViews";
import { SkeletonList } from "../components/Skeletons";
import {
  useForgetDevice,
  useNotificationSettings,
  usePushDevices,
  useSaveNotificationSettings,
} from "../hooks/useNotificationSettings";
import {
  readPushReadiness,
  useRegisterPush,
} from "../hooks/usePushRegistration";
import { useToast } from "../hooks/useToast";
import { formatDate } from "../lib/format";
import {
  EMAIL_CATEGORIES,
  EMAIL_MODES,
  EMPTY_SETTINGS,
  PUSH_CATEGORIES,
  hasQuietHours,
  isEmailEnabled,
  isPushEnabled,
  isQuietWindowValid,
  toEmailMode,
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
 *
 * E-Mail gibt es seit UC-044: ein Modus (sofort, täglich, wöchentlich, aus)
 * und dieselbe Matrix je Kategorie – ohne Fürsorge und Befinden, die nie per
 * Mail gehen (BR-210). Die zwei Zeilen fehlen bewusst, statt ausgegraut
 * dazustehen: Ein Schalter, der nichts schaltet, erklärt nichts.
 */
export function NotificationsPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const stored = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const devices = usePushDevices();
  const forget = useForgetDevice();
  const registerPush = useRegisterPush();
  // A1/A2: Wie weit dieses Gerät überhaupt kann. Einmal beim Aufbau gelesen –
  // die Antwort des Browsers ändert sich nicht, während die Seite offen ist.
  const readiness = readPushReadiness();

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

  function setEmailCategory(category: PushCategory, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      email: { ...current.email, [category]: enabled },
    }));
  }

  return (
    <AppPage
      title={t("notifications.title")}
      backHref="/tabs/profile"
      onRefresh={() => Promise.all([stored.refetch(), devices.refetch()])}
    >
      {/* Schritt 3: die Begründung, nicht bloss die Sperre – als Text, nicht
          als Listenzeile, die keine ist. */}
      <TextSection title={t("notifications.inbox")}>
        <p>{t("notifications.inboxAlways")}</p>
        <p>
          <IonNote>{t("notifications.inboxWhy")}</IonNote>
        </p>
      </TextSection>

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

          {/* UC-044: E-Mail. Der Modus zuerst – er entscheidet, ob die
              Kategorien darunter überhaupt etwas bewirken. */}
          <ListSection
            title={t("notifications.email")}
            footnote={
              draft.emailMode === "off"
                ? t("notifications.emailOff")
                : t("notifications.emailHint")
            }
          >
            <IonItem>
              <IonSelect
                label={t("notifications.emailMode")}
                labelPlacement="stacked"
                value={draft.emailMode}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
                onIonChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    emailMode: toEmailMode(String(e.detail.value)),
                  }))
                }
              >
                {EMAIL_MODES.map((mode) => (
                  <IonSelectOption key={mode} value={mode}>
                    {t(`notifications.emailModes.${mode}`)}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
            {draft.emailMode !== "off" &&
              EMAIL_CATEGORIES.map((category) => (
                <IonItem key={category}>
                  <IonToggle
                    checked={isEmailEnabled(draft, category)}
                    onIonChange={(e) =>
                      setEmailCategory(category, e.detail.checked)
                    }
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
                <DateField
                  label={t("notifications.quietFrom")}
                  presentation="time"
                  value={draft.quietFrom ?? ""}
                  onChange={(value) => setDraft((current) => ({ ...current, quietFrom: value || null }))}
                  clearable
                />
                <DateField
                  label={t("notifications.quietTo")}
                  presentation="time"
                  value={draft.quietTo ?? ""}
                  onChange={(value) => setDraft((current) => ({ ...current, quietTo: value || null }))}
                  clearable
                />
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

          {/* A1: das Gerät anmelden. Bis heute konnte die App Geräte
              auflisten und abmelden – anmelden konnte sie keines, und die
              Liste blieb deshalb immer leer. */}
          {/* Überschrift, dann Auskunft oder Knopf, dann die Geräteliste:
              Text und Knopfleiste sind keine Zeilen und stehen deshalb
              zwischen Kopf und Liste, nicht in der Liste. */}
          <IonListHeader>
            <IonLabel>{t("notifications.devices")}</IonLabel>
          </IonListHeader>
          {readiness !== "ready" ? (
            /* A2 und die drei anderen Gründe. Kein Fehler, sondern eine
               Auskunft: Die Inbox enthält weiterhin alles (BR-117). */
            <TextSection>
              <p>{t(`notifications.pushState.${readiness}`)}</p>
            </TextSection>
          ) : (
            <div className="app-actions">
              <IonButton
                expand="block"
                fill="outline"
                disabled={registerPush.isPending}
                onClick={() =>
                  registerPush.mutate(undefined, {
                    onSuccess: (outcome) =>
                      outcome === "registered"
                        ? toast.success(t("notifications.deviceRegistered"))
                        : toast.failure(t("notifications.pushState.denied")),
                    onError: (cause) => toast.failure(cause.message),
                  })
                }
              >
                {t("notifications.registerDevice")}
              </IonButton>
            </div>
          )}

          <ListSection footnote={t("notifications.devicesHint")}>
            {(devices.data ?? []).length === 0 ? (
              <IonItem lines="none">
                <IonLabel color="medium" className="ion-text-wrap">
                  {t("notifications.noDevices")}
                </IonLabel>
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
