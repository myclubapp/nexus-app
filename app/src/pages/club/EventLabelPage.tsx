import { useEffect, useState } from 'react';
import { IonButton, IonInput, IonItem, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useClub } from '../../hooks/useClub';
import { useSaveClubSettings } from '../../hooks/useClubSettings';
import { useToast } from '../../hooks/useToast';
import { buildClubSettings, type LabelSet } from '../../lib/clubSettings';
import { SUPPORTED_LANGUAGES } from '../../i18n';
import { AppPage } from '../../components/AppPage';
import { ListSection } from '../../components/ListSection';
import { EmptyState, InlineError } from '../../components/StateViews';
import type { EventType } from '../../lib/database.types';

/** Reihenfolge wie in `events.type` (0003_agenda.sql, verengt in 0072). */
const EVENT_TYPES: EventType[] = [
  'training',
  'match',
  'gv',
  'social',
  'helper',
];

/**
 * Die vereinseigenen Begriffe je Terminart (BR-148) – eine eigene Seite.
 *
 * Fünf Terminarten mal vier Sprachen sind zwanzig Felder. In den
 * Vereinseinstellungen schoben sie alles Übrige nach unten, obwohl sie einmal
 * eingerichtet und dann jahrelang nicht mehr angefasst werden. Deshalb stehen
 * sie hier, und dort steht nur noch der Weg hierher.
 *
 * Gespeichert wird derselbe `clubs.settings`-Block wie dort, aber **nur** der
 * Ausschnitt `labels`: `buildClubSettings()` lässt unangetastet, was diese
 * Seite nicht mitschickt. Die Berechtigung prüft die Policy `clubs_update`
 * über `is_club_admin()`; das Ausblenden hier ist Bequemlichkeit, nicht der
 * Schutz.
 */
export function EventLabelPage() {
  const { t } = useTranslation();
  const { activeClub, isAdmin } = useClub();
  const save = useSaveClubSettings();
  const toast = useToast();

  const [labels, setLabels] = useState<Partial<Record<EventType, LabelSet>>>({});

  useEffect(() => {
    if (!activeClub) return;
    setLabels(activeClub.settings?.labels ?? {});
  }, [activeClub]);

  function submit() {
    save.mutate(
      {
        // Name und Saisonbeginn gehören der Einstellungsseite; hier werden sie
        // unverändert mitgeschrieben, weil `clubs` in einem Zug aktualisiert
        // wird. Ein leerer Wert hier wäre eine Änderung, die niemand wollte.
        name: activeClub?.name ?? '',
        seasonStart: activeClub?.season_start ?? null,
        settings: buildClubSettings(activeClub?.settings, { labels }),
      },
      {
        onSuccess: () => toast.success(t('clubSettings.saved')),
        onError: (cause) => toast.failure(cause.message),
      },
    );
  }

  return (
    <AppPage title={t('clubSettings.labels')} backHref="/tabs/profile/club">
      {!isAdmin ? (
        <EmptyState
          message={t('clubSettings.adminOnly')}
          action={{ label: t('profile.title'), routerLink: '/tabs/profile' }}
        />
      ) : (
        <>
          {/* BR-148: je Terminart vier Felder – ein Verein, der «Probe» sagt,
              sagt auf Französisch «répétition». Leer bleibende Sprachen fallen
              auf eine ausgefüllte zurück, nicht auf die Standardübersetzung
              (`resolveLabel()`).

              Ein Abschnitt je Terminart, eine Zeile je Sprache: Ein Item ist
              eine Listenzeile mit höchstens zwei Bedienelementen, kein
              Container für vier Felder nebeneinander – auf 390 px wäre das
              nicht bedienbar. */}
          {EVENT_TYPES.map((type, typeIndex) => (
            <ListSection
              key={type}
              title={t(`agenda.type.${type}`)}
              footnote={
                typeIndex === EVENT_TYPES.length - 1
                  ? t('clubSettings.labelsHint')
                  : undefined
              }
            >
              {SUPPORTED_LANGUAGES.map((code, index) => (
                <IonItem key={code}>
                  <IonInput
                    label={t(`language.${code}`)}
                    labelPlacement="stacked"
                    placeholder={t(`agenda.type.${type}`)}
                    enterkeyhint={
                      index === SUPPORTED_LANGUAGES.length - 1 ? 'done' : 'next'
                    }
                    value={labels[type]?.[code] ?? ''}
                    onIonInput={(e) =>
                      setLabels((current) => ({
                        ...current,
                        [type]: { ...current[type], [code]: e.detail.value ?? '' },
                      }))
                    }
                  />
                </IonItem>
              ))}
            </ListSection>
          ))}

          <div className="app-actions">
            <IonButton
              expand="block"
              disabled={!activeClub || save.isPending}
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
