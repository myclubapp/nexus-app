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
import {
  buildClubSettings,
  seasonStartChanged,
  type LabelSet,
} from '../lib/clubSettings';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { seasonLabel } from '../lib/season';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { DateField } from '../components/DateField';
import { EmptyState, InlineError } from '../components/StateViews';
import { CLUB_MODULES } from '../lib/database.types';
import type { ClubModule, ClubSettings, EventType } from '../lib/database.types';

/** Reihenfolge wie in `events.type` (0003_agenda.sql). */
const EVENT_TYPES: EventType[] = [
  'training',
  'match',
  'cup',
  'tournament',
  'gv',
  'social',
  'helper',
];

const THEME_ROLES = Object.keys(BASE_THEME) as ThemeRole[];

/**
 * Vereinseinstellungen: Name, Saisonstart, Vereinsfarben und die eigenen
 * Begriffe je Terminart (MVP-Scope §6 – die Vereinsart setzt nur Vorlagen,
 * alles bleibt nachträglich änderbar).
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
  const [labels, setLabels] = useState<Partial<Record<EventType, LabelSet>>>({});
  const [modules, setModules] = useState<Partial<Record<ClubModule, boolean>>>({});
  const [dna, setDna] = useState<NonNullable<ClubSettings['dna']>>({});
  const [logoUrl, setLogoUrl] = useState('');
  const [topOnly, setTopOnly] = useState('');
  const [hidePoints, setHidePoints] = useState(false);
  // A4: Die Warnung steht **vor** dem Speichern, nicht als Hinweis danach.
  const [confirmSeason, setConfirmSeason] = useState(false);
  const [confirmDrop, setConfirmDrop] = useState(false);

  // Den Entwurf aus dem Verein füllen, sobald er geladen oder gewechselt ist.
  useEffect(() => {
    if (!activeClub) return;
    setName(activeClub.name);
    setSeasonStart(activeClub.season_start ?? '');
    setTheme(activeClub.settings?.theme ?? {});
    setLabels(activeClub.settings?.labels ?? {});
    setModules(activeClub.settings?.modules ?? {});
    setDna(activeClub.settings?.dna ?? {});
    setLogoUrl(activeClub.settings?.logoUrl ?? '');
    setTopOnly(activeClub.settings?.leaderboard?.topOnly?.toString() ?? '');
    setHidePoints(activeClub.settings?.leaderboard?.hidePoints === true);
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
    save.mutate(
      {
        name,
        seasonStart: seasonStart || null,
        settings: buildClubSettings(activeClub?.settings, {
          labels,
          theme,
          modules,
          dna,
          logoUrl,
          leaderboard: { topOnly, hidePoints },
        }),
      },
      {
        onSuccess: () => toast.success(t('clubSettings.saved')),
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

          {/* FR-111: das Logo. Als Adresse, nicht als Upload – dafür fehlt
              Supabase Storage (offen seit UC-026). */}
          <ListSection
            title={t('clubSettings.logo')}
            footnote={t('clubSettings.logoHint')}
          >
            <IonItem>
              <IonInput
                type="url"
                inputmode="url"
                label={t('clubSettings.logoUrl')}
                labelPlacement="stacked"
                value={logoUrl}
                onIonInput={(e) => setLogoUrl(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          <ListSection
            title={t('clubSettings.labels')}
            footnote={t('clubSettings.labelsHint')}
          >
            {/* BR-148: je Terminart vier Felder – ein Verein, der «Probe»
                sagt, sagt auf Französisch «répétition». Leer bleibende
                Sprachen fallen auf eine ausgefüllte zurück, nicht auf die
                Standardübersetzung (`resolveLabel()`). */}
            {EVENT_TYPES.map((type) => (
              <IonItem key={type}>
                <IonLabel className="ion-text-wrap">
                  <h2>{t(`agenda.type.${type}`)}</h2>
                </IonLabel>
                {SUPPORTED_LANGUAGES.map((code) => (
                  <IonInput
                    key={code}
                    slot="end"
                    label={t(`language.${code}`)}
                    labelPlacement="stacked"
                    placeholder={t(`agenda.type.${type}`)}
                    value={labels[type]?.[code] ?? ''}
                    onIonInput={(e) =>
                      setLabels((current) => ({
                        ...current,
                        [type]: { ...current[type], [code]: e.detail.value ?? '' },
                      }))
                    }
                  />
                ))}
              </IonItem>
            ))}
          </ListSection>

          {/* A1 und FR-115: die Module. Was hier aus ist, gibt es für dieses
              Mitglied nicht – und der Server sagt dasselbe (`module_enabled()`). */}
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
                Zeilenaktion (guidelines §2). */}
            {(samples.data ?? []).map((item) => (
              <IonItemSliding key={`${item.kind}-${item.id}`}>
                <IonItem>
                  <IonLabel className="ion-text-wrap">
                    <h2>{item.title}</h2>
                    <IonNote>{t(`sample.kind.${item.kind}`)}</IonNote>
                  </IonLabel>
                </IonItem>
                <IonItemOptions side="end">
                  <IonItemOption
                    onClick={() =>
                      adopt.mutate(
                        { kind: item.kind, id: item.id },
                        {
                          onSuccess: () => toast.success(t('sample.adopted')),
                          onError: (cause) => toast.failure((cause as Error).message),
                        },
                      )
                    }
                  >
                    {t('sample.adopt')}
                  </IonItemOption>
                </IonItemOptions>
              </IonItemSliding>
            ))}

            <IonItem lines="none">
              <IonButton
                fill="outline"
                color="danger"
                disabled={dropSamples.isPending || (samples.data ?? []).length === 0}
                onClick={() => setConfirmDrop(true)}
              >
                {t('sample.drop')}
              </IonButton>
            </IonItem>
          </ListSection>

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
