import { useEffect, useMemo, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonInput,
  IonItem,
  IonLabel,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonNote,
  IonSpinner,
  IonTextarea,
  IonToggle,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../hooks/useClub';
import { useSaveClubSettings } from '../hooks/useClubSettings';
import {
  useAdoptSample,
  useDropSampleContent,
  useSampleContent,
} from '../hooks/useSample';
import { useToast } from '../hooks/useToast';
import {
  applyClubTheme,
  BASE_THEME,
  hasEnoughContrast,
  suggestContrast,
  type ThemeRole,
} from '../lib/theme';
import { buildClubSettings, seasonStartChanged } from '../lib/clubSettings';
import { seasonLabel } from '../lib/season';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { DateField } from '../components/DateField';
import { ImagePicker } from '../components/ImagePicker';
import { useRemoveMediaFile } from '../hooks/useMedia';
import { isClubMediaUrl } from '../lib/image';
import { EmptyState, InlineError } from '../components/StateViews';
import { CLUB_MODULES } from '../lib/database.types';
import { usePointRules } from '../hooks/useGamification';
import {
  GOAL_SUGGESTION_SHIFTS,
  suggestedSeasonGoal,
} from '../lib/contributionGoal';
import type { ClubModule, ClubSettings } from '../lib/database.types';

const THEME_ROLES = Object.keys(BASE_THEME) as ThemeRole[];

/**
 * Vereinseinstellungen: Module, Name, Saisonstart, Vereinsfarben, Logo,
 * Rangliste und Vereins-DNA (MVP-Scope §6 – die Vereinsart setzt nur Vorlagen,
 * alles bleibt nachträglich änderbar). Die vereinseigenen Begriffe je
 * Terminart stehen auf `EventLabelPage`; von hier führt ein Weg dorthin.
 *
 * Geschrieben wird über `useSaveClubSettings()`; die Berechtigung prüft die
 * Policy `clubs_update` über `is_club_admin()`. Das Ausblenden hier ist nur
 * die Bequemlichkeit, nicht der Schutz.
 */
export function ClubSettingsPage() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const save = useSaveClubSettings();
  const dropSamples = useDropSampleContent();
  const samples = useSampleContent();
  const adopt = useAdoptSample();
  const toast = useToast();

  const [name, setName] = useState('');
  const [seasonStart, setSeasonStart] = useState('');
  const [theme, setTheme] = useState<ClubSettings['theme']>({});
  const [modules, setModules] = useState<Partial<Record<ClubModule, boolean>>>({});
  const [dna, setDna] = useState<NonNullable<ClubSettings['dna']>>({});
  const [logoUrl, setLogoUrl] = useState('');
  const removeFile = useRemoveMediaFile();
  const [topOnly, setTopOnly] = useState('');
  const [hidePoints, setHidePoints] = useState(false);
  // UC-042: das Saisonziel in Punkten. Leer heisst «kein Ziel».
  const [seasonGoal, setSeasonGoal] = useState('');

  // Der Vorschlag für das Saisonziel: vier Einsätze der Regel, die einen
  // Helfereinsatz bucht. Ohne die Regel gibt es keinen Vorschlag – eine Zahl
  // aus dem Nichts wäre geraten.
  const rules = usePointRules();
  const goalSuggestion = suggestedSeasonGoal(
    rules.data?.find((rule) => rule.code === 'shift_done' && rule.is_active)?.points,
  );
  // A4: Die Warnung steht **vor** dem Speichern, nicht als Hinweis danach.
  const [confirmSeason, setConfirmSeason] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  // Den Entwurf aus dem Verein füllen, sobald er geladen oder gewechselt ist.
  useEffect(() => {
    if (!activeClub) return;
    setName(activeClub.name);
    setSeasonStart(activeClub.season_start ?? '');
    setTheme(activeClub.settings?.theme ?? {});
    setModules(activeClub.settings?.modules ?? {});
    setDna(activeClub.settings?.dna ?? {});
    setLogoUrl(activeClub.settings?.logoUrl ?? '');
    setTopOnly(activeClub.settings?.leaderboard?.topOnly?.toString() ?? '');
    setHidePoints(activeClub.settings?.leaderboard?.hidePoints === true);
    setSeasonGoal(activeClub.settings?.goal?.seasonPoints?.toString() ?? '');
  }, [activeClub]);

  // Farben sofort anwenden, damit die Wirkung sichtbar ist. Beim Verlassen
  // ohne Speichern gilt wieder das, was im Verein steht.
  useEffect(() => {
    applyClubTheme({ ...activeClub?.settings, theme });
  }, [theme, activeClub?.settings]);

  useEffect(
    () => () => {
      applyClubTheme(activeClub?.settings);
    },
    [activeClub?.settings],
  );

  // Vorschau des Saison-Labels: dieselbe Funktion, die auch das Dashboard und
  // die Rangliste benutzen (Gegenstück zu `season_label()` in SQL).
  const seasonPreview = useMemo(
    () => seasonLabel(seasonStart || null),
    [seasonStart],
  );

  const canSave =
    Boolean(activeClub) && name.trim().length >= 2 && !save.isPending;

  // A5: Farben, deren Kontrast nicht reicht – samt Vorschlag.
  const weakColors = THEME_ROLES.filter(
    (role) => theme?.[role] && !hasEnoughContrast(theme[role]!),
  );

  function persist() {
    // Welche Datei nach dem Speichern wegzuräumen ist: die bisherige, sofern
    // sie ein **Logo** dieses Vereins war. `isClubMediaUrl` prüft auch die
    // Art des Bildes – sonst löschte das Ersetzen des Logos ein Teambild,
    // dessen Adresse jemand von Hand ins Adressfeld getippt hat.
    const previousLogo = activeClub?.settings?.logoUrl ?? '';
    const stale =
      previousLogo &&
      previousLogo !== logoUrl &&
      isClubMediaUrl(previousLogo, activeClub?.id ?? '', 'logo')
        ? previousLogo
        : null;

    save.mutate(
      {
        name,
        seasonStart: seasonStart || null,
        settings: buildClubSettings(activeClub?.settings, {
          theme,
          modules,
          dna,
          logoUrl,
          leaderboard: { topOnly, hidePoints },
          goal: { seasonPoints: seasonGoal },
        }),
      },
      {
        onSuccess: () => {
          if (stale) removeFile.mutate(stale);
          toast.success(t('clubSettings.saved'));
        },
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  function submit() {
    // A4: Ein geänderter Saisonbeginn verschiebt die Zuordnung künftiger
    // Buchungen. Gebuchte Punkte behalten ihre Saison – aber das muss jemand
    // sagen, **bevor** gespeichert wird.
    if (seasonStartChanged(activeClub?.season_start, seasonStart)) {
      setConfirmSeason(true);
      return;
    }
    persist();
  }

  return (
    <AppPage title={t('clubSettings.title')} backHref="/tabs/profile">
      {!isAdmin ? (
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      ) : (
        <>
          <ListSection
            title={t('clubSettings.general')}
            footnote={t('clubSettings.seasonStartHint', { season: seasonPreview })}
          >
            <IonItem>
              <IonInput
                label={t('clubSettings.name')}
                labelPlacement="stacked"
                enterkeyhint="next"
                value={name}
                onIonInput={(e) => setName(e.detail.value ?? '')}
              />
            </IonItem>

            <DateField
              label={t('clubSettings.seasonStart')}
              presentation="date"
              value={seasonStart}
              onChange={setSeasonStart}
            />
          </ListSection>

          {/* A1 und FR-115: die Module. Was hier aus ist, gibt es für dieses
              Mitglied nicht – und der Server sagt dasselbe (`module_enabled()`).

              Sie stehen **oben**: Ein Modul entscheidet, ob es einen Bereich
              überhaupt gibt – auch auf dieser Seite (das Saisonziel weiter
              unten erscheint erst mit `modules.goal`). Wer etwas sucht, das
              fehlt, schaltet es hier ein; das darf nicht hinter zwanzig
              Farb- und Textfeldern liegen. */}
          <ListSection
            title={t('clubSettings.modules')}
            footnote={t('clubSettings.modulesHint')}
          >
            {CLUB_MODULES.map((module) => (
              <IonItem key={module}>
                <IonToggle
                  checked={modules[module] === true}
                  onIonChange={(e) =>
                    setModules((current) => ({ ...current, [module]: e.detail.checked }))
                  }
                >
                  <IonLabel className="ion-text-wrap">
                    <h2>{t(`clubSettings.module.${module}.title`)}</h2>
                    <IonNote>{t(`clubSettings.module.${module}.body`)}</IonNote>
                  </IonLabel>
                </IonToggle>
              </IonItem>
            ))}
          </ListSection>

          <ListSection
            title={t('clubSettings.theme')}
            footnote={t('clubSettings.themeHint')}
          >
            {THEME_ROLES.map((role) => (
              <IonItem key={role}>
                <IonLabel>{t(`clubSettings.color.${role}`)}</IonLabel>
                {/* Ionic hat keinen Farbwähler; das native Feld öffnet auf
                    jeder Plattform die Systemauswahl. */}
                <input
                  slot="end"
                  className="app-color-swatch"
                  type="color"
                  aria-label={t(`clubSettings.color.${role}`)}
                  value={theme?.[role] ?? BASE_THEME[role]}
                  onChange={(e) =>
                    setTheme((current) => ({ ...current, [role]: e.target.value }))
                  }
                />
                <IonButton
                  slot="end"
                  fill="clear"
                  size="small"
                  disabled={!theme?.[role]}
                  onClick={() =>
                    setTheme((current) => {
                      const next = { ...current };
                      delete next[role];
                      return next;
                    })
                  }
                >
                  {t('clubSettings.reset')}
                </IonButton>
              </IonItem>
            ))}

            {/* A5: Der Hinweis steht im Abschnitt, nicht in einem Toast – er
                bezieht sich auf ein Feld, das gerade korrigiert werden soll. */}
            {weakColors.map((role) => (
              <IonItem key={`contrast-${role}`} lines="none">
                <IonLabel className="ion-text-wrap">
                  <IonNote>
                    {t('clubSettings.contrastWarning', {
                      color: t(`clubSettings.color.${role}`),
                    })}
                  </IonNote>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="clear"
                  size="small"
                  onClick={() =>
                    setTheme((current) => ({
                      ...current,
                      [role]: suggestContrast(current?.[role] ?? '') ?? current?.[role],
                    }))
                  }
                >
                  {t('clubSettings.contrastFix')}
                </IonButton>
              </IonItem>
            ))}
          </ListSection>

          {/* FR-111: das Logo. Seit UC-045 als Upload **und** als Adresse:
              Der Upload legt die Datei im Vereinsspeicher ab und schreibt
              seine Adresse in dasselbe Feld – ein Verein, dessen Logo schon
              auf seiner Website liegt, trägt weiterhin einfach den Link ein.
              Ein Feld, zwei Wege dorthin; nicht zwei Felder. */}
          <ImagePicker
            title={t('clubSettings.logo')}
            footnote={t('clubSettings.logoHint')}
            kind="logo"
            ownerId={null}
            url={logoUrl || null}
            // Nur den Entwurf setzen. Die alte Datei fällt erst, wenn
            // gespeichert ist – wer ein Logo wählt und die Seite ohne
            // Speichern verlässt, hätte sonst in `settings.logoUrl` eine
            // Adresse, hinter der nichts mehr liegt. Und das Logo lädt vor
            // der Anmeldung (Einladungsseite, White-Label).
            // Das Logo führt die **Adresse**, nicht den Pfad: Das Feld
            // darunter nimmt auch eine fremde Adresse an (UC-034), und beide
            // Wege müssen dasselbe hineinschreiben.
            onChange={(value) => setLogoUrl(value?.url ?? '')}
          />

          <ListSection footnote={t('clubSettings.logoUrlHint')}>
            <IonItem>
              <IonInput
                type="url"
                inputmode="url"
                label={t('clubSettings.logoUrl')}
                labelPlacement="stacked"
                enterkeyhint="next"
                value={logoUrl}
                onIonInput={(e) => setLogoUrl(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {/* BR-148 steht auf einer eigenen Seite: Fünf Terminarten mal vier
              Sprachen sind zwanzig Felder, die einmal eingerichtet und dann
              kaum mehr angefasst werden – hier schoben sie alles Übrige nach
              unten. Die Begriffsseite speichert ihren Ausschnitt selbst
              (`buildClubSettings()` lässt unangetastet, was eine Seite nicht
              mitschickt); wer ihr folgt, verlässt diese Seite wie mit dem
              Zurück-Knopf und nimmt einen ungespeicherten Entwurf nicht mit. */}
          <ListSection footnote={t('clubSettings.labelsHint')}>
            <IonItem button detail routerLink="/tabs/profile/labels">
              <IonLabel>{t('clubSettings.labels')}</IonLabel>
            </IonItem>
          </ListSection>

          {/* Konzept §7.2 und UC-022 A3: der Ausschnitt der Rangliste und
              Ränge ohne Punktzahl. Beides Wahl des Vereins, beides mit
              Vorgabe – wer nichts einstellt, bekommt die Top 20 mit Zahl. */}
          <ListSection
            title={t('clubSettings.leaderboard')}
            footnote={t('clubSettings.leaderboardHint')}
          >
            <IonItem>
              <IonInput
                label={t('clubSettings.topOnly')}
                labelPlacement="stacked"
                type="number"
                inputmode="numeric"
                min={1}
                placeholder="20"
                enterkeyhint="done"
                value={topOnly}
                onIonInput={(e) => setTopOnly(e.detail.value ?? '')}
              />
            </IonItem>
            <IonItem>
              <IonToggle checked={hidePoints} onIonChange={(e) => setHidePoints(e.detail.checked)}>
                <IonLabel className="ion-text-wrap">
                  <h2>{t('clubSettings.hidePoints')}</h2>
                  <IonNote>{t('clubSettings.hidePointsHint')}</IonNote>
                </IonLabel>
              </IonToggle>
            </IonItem>
          </ListSection>

          {/* UC-042: das Saisonziel. Nur sichtbar, wenn das Modul läuft –
              ohne Modul kennt der Verein kein Soll, und der MVP-Schnitt gilt
              unverändert (BR-199). */}
          {modules.goal === true && (
            <ListSection
              title={t('clubSettings.goal')}
              footnote={
                goalSuggestion
                  ? t('clubSettings.goalHintWithSuggestion', {
                      points: goalSuggestion,
                      shifts: GOAL_SUGGESTION_SHIFTS,
                    })
                  : t('clubSettings.goalHint')
              }
            >
              <IonItem>
                <IonInput
                  label={t('clubSettings.goalPoints')}
                  labelPlacement="stacked"
                  type="number"
                  inputmode="numeric"
                  min={1}
                  placeholder={goalSuggestion ? String(goalSuggestion) : undefined}
                  enterkeyhint="done"
                  value={seasonGoal}
                  onIonInput={(e) => setSeasonGoal(e.detail.value ?? '')}
                />
              </IonItem>
            </ListSection>
          )}

          {/* A3 und FR-114: die Vereins-DNA. */}
          <ListSection
            title={t('clubSettings.dna')}
            footnote={t('clubSettings.dnaHint')}
          >
            {(['why', 'values', 'tone', 'traditions'] as const).map((field) => (
              <IonItem key={field}>
                <IonTextarea
                  label={t(`clubSettings.dnaField.${field}`)}
                  labelPlacement="stacked"
                  autoGrow
                  rows={2}
                  value={dna[field] ?? ''}
                  onIonInput={(e) =>
                    setDna((current) => ({ ...current, [field]: e.detail.value ?? '' }))
                  }
                />
              </IonItem>
            ))}
          </ListSection>

          {/* FR-136 und BR-162: **eine** Aktion, nicht einzeln aufräumen. */}
          <ListSection
            title={t('sample.sectionTitle')}
            footnote={t('sample.sectionHint')}
          >
            {/* A3: einen einzelnen behalten. Nach links wischen, wie bei jeder
                Zeilenaktion (guidelines §2) – und als Knopf in der Zeile, weil
                die Wischoption weder Tastatur noch VoiceOver erreicht. Die
                Zeile ist kein `button`, der Knopf steht also nicht in einem. */}
            {(samples.data ?? []).map((item) => {
              const adoptItem = () =>
                adopt.mutate(
                  { kind: item.kind, id: item.id },
                  {
                    onSuccess: () => toast.success(t('sample.adopted')),
                    onError: (cause) => toast.failure((cause as Error).message),
                  },
                );
              return (
                <IonItemSliding key={`${item.kind}-${item.id}`}>
                  <IonItem>
                    <IonLabel className="ion-text-wrap">
                      <h2>{item.title}</h2>
                      <IonNote>{t(`sample.kind.${item.kind}`)}</IonNote>
                    </IonLabel>
                    <IonButton
                      slot="end"
                      fill="clear"
                      size="small"
                      aria-label={t('sample.adopt')}
                      disabled={adopt.isPending}
                      onClick={adoptItem}
                    >
                      {t('sample.adoptShort')}
                    </IonButton>
                  </IonItem>
                  <IonItemOptions side="end">
                    <IonItemOption disabled={adopt.isPending} onClick={adoptItem}>
                      {t('sample.adopt')}
                    </IonItemOption>
                  </IonItemOptions>
                </IonItemSliding>
              );
            })}
          </ListSection>

          {/* Ein Item nur mit einem Knopf ist keine Listenzeile: Die Aktion
              steht als Knopfleiste unter dem Abschnitt. */}
          <div className="app-actions">
            <IonButton
              expand="block"
              fill="outline"
              color="danger"
              disabled={dropSamples.isPending || (samples.data ?? []).length === 0}
              onClick={() => setConfirmDrop(true)}
            >
              {t('sample.drop')}
            </IonButton>
          </div>

          <IonAlert
            isOpen={confirmDrop}
            header={t('sample.drop')}
            message={t('sample.dropConfirm')}
            onDidDismiss={() => setConfirmDrop(false)}
            buttons={[
              { text: t('common.cancel'), role: 'cancel' },
              {
                text: t('sample.drop'),
                role: 'destructive',
                handler: () =>
                  dropSamples.mutate(undefined, {
                    onSuccess: (count) =>
                      toast.success(t('sample.dropped', { count })),
                    onError: (cause) => toast.failure((cause as Error).message),
                  }),
              },
            ]}
          />

          {/* guidelines §2: Die Rückfrage steht **vor** der Aktion, und die
              Farbe des Knopfs kommt aus seiner Rolle. */}
          <IonAlert
            isOpen={confirmSeason}
            header={t('clubSettings.seasonChange')}
            message={t('clubSettings.seasonChangeHint')}
            onDidDismiss={() => setConfirmSeason(false)}
            buttons={[
              { text: t('common.cancel'), role: 'cancel' },
              { text: t('common.save'), handler: persist },
            ]}
          />

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={!canSave}
              onClick={submit}
            >
              {save.isPending ? <IonSpinner name="crescent" /> : t('common.save')}
            </IonButton>

            {save.error && <InlineError message={(save.error as Error).message} />}
          </div>
        </>
      )}
    </AppPage>
  );
}
