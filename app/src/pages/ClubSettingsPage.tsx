import { useEffect, useMemo, useState } from 'react';
import { IonButton, IonInput, IonItem, IonLabel, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useClub } from '../hooks/useClub';
import { applyClubTheme } from '../lib/theme';
import { seasonLabel } from '../lib/season';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { EmptyState, InlineError, InlineSuccess } from '../components/StateViews';
import type { ClubSettings, EventType } from '../lib/database.types';

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

const THEME_ROLES = ['primary', 'secondary', 'tertiary'] as const;
type ThemeRole = (typeof THEME_ROLES)[number];

/** Basisfarben aus `theme/variables.css` – der Stand ohne Vereins-Theme. */
const BASE_COLORS: Record<ThemeRole, string> = {
  primary: '#1d4ed8',
  secondary: '#0f766e',
  tertiary: '#b45309',
};

/**
 * Vereinseinstellungen: Name, Saisonstart, Vereinsfarben und die eigenen
 * Begriffe je Terminart (MVP-Scope §6 – die Vereinsart setzt nur Vorlagen,
 * alles bleibt nachträglich änderbar).
 *
 * Geschrieben wird direkt auf `clubs`; die Berechtigung prüft die Policy
 * `clubs_update` über `is_club_admin()`. Das Ausblenden hier ist nur die
 * Bequemlichkeit, nicht der Schutz.
 */
export function ClubSettingsPage() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [seasonStart, setSeasonStart] = useState('');
  const [theme, setTheme] = useState<ClubSettings['theme']>({});
  const [labels, setLabels] = useState<Partial<Record<EventType, string>>>({});
  const [saved, setSaved] = useState(false);

  // Den Entwurf aus dem Verein füllen, sobald er geladen oder gewechselt ist.
  useEffect(() => {
    if (!activeClub) return;
    setName(activeClub.name);
    setSeasonStart(activeClub.season_start ?? '');
    setTheme(activeClub.settings?.theme ?? {});
    setLabels(activeClub.settings?.labels ?? {});
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

  const save = useMutation({
    mutationFn: async () => {
      if (!activeClub) return;

      // Leere Begriffe und Farben gar nicht erst ablegen: `eventLabel()` fällt
      // dann auf die Standardübersetzung zurück.
      const cleanLabels = Object.fromEntries(
        Object.entries(labels).filter(([, value]) => value?.trim()),
      );
      const cleanTheme = Object.fromEntries(
        Object.entries(theme ?? {}).filter(([, value]) => value?.trim()),
      );

      const settings: ClubSettings = { ...activeClub.settings };
      if (Object.keys(cleanLabels).length > 0) settings.labels = cleanLabels;
      else delete settings.labels;
      if (Object.keys(cleanTheme).length > 0) settings.theme = cleanTheme;
      else delete settings.theme;

      const { error } = await supabase
        .from('clubs')
        .update({
          name: name.trim(),
          season_start: seasonStart || null,
          settings,
        })
        .eq('id', activeClub.id);

      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      // Die Saison steckt im Schlüssel der Punkte- und Ranglisten-Abfragen.
      await queryClient.invalidateQueries({ queryKey: ['points'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });

  // Vorschau des Saison-Labels: dieselbe Funktion, die auch das Dashboard und
  // die Rangliste benutzen (Gegenstück zu `season_label()` in SQL).
  const seasonPreview = useMemo(
    () => seasonLabel(seasonStart || null),
    [seasonStart],
  );

  const canSave =
    Boolean(activeClub) && name.trim().length >= 2 && !save.isPending;

  return (
    <AppPage title={t('clubSettings.title')} backHref="/tabs/profile">
      {!isAdmin ? (
        <EmptyState message={t('clubSettings.adminOnly')} />
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

            <IonItem>
              <IonInput
                type="date"
                label={t('clubSettings.seasonStart')}
                labelPlacement="stacked"
                value={seasonStart}
                onIonInput={(e) => setSeasonStart(e.detail.value ?? '')}
              />
            </IonItem>
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
                  value={theme?.[role] ?? BASE_COLORS[role]}
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
          </ListSection>

          <ListSection
            title={t('clubSettings.labels')}
            footnote={t('clubSettings.labelsHint')}
          >
            {EVENT_TYPES.map((type) => (
              <IonItem key={type}>
                <IonInput
                  label={t(`agenda.type.${type}`)}
                  labelPlacement="stacked"
                  placeholder={t(`agenda.type.${type}`)}
                  value={labels[type] ?? ''}
                  onIonInput={(e) =>
                    setLabels((current) => ({ ...current, [type]: e.detail.value ?? '' }))
                  }
                />
              </IonItem>
            ))}
          </ListSection>

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={!canSave}
              onClick={() => {
                setSaved(false);
                save.mutate();
              }}
            >
              {save.isPending ? <IonSpinner name="crescent" /> : t('common.save')}
            </IonButton>

            {save.error && <InlineError message={(save.error as Error).message} />}
            {saved && !save.isPending && !save.error && (
              <InlineSuccess message={t('clubSettings.saved')} />
            )}
          </div>
        </>
      )}
    </AppPage>
  );
}
