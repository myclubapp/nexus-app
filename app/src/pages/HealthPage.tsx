import { useState } from 'react';
import { IonBadge, IonItem, IonLabel, IonNote } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { AppPage } from '../components/AppPage';
import { ListSection } from '../components/ListSection';
import { StatCard } from '../components/StatCard';
import { EmptyState, ErrorState } from '../components/StateViews';
import { SkeletonList } from '../components/Skeletons';
import { HealthSignalModal } from '../components/HealthSignalModal';
import {
  useClubHealth,
  useHealthDefinitions,
  useHealthSignals,
  useResponsibility,
  useSuccessionLead,
  useTeamHealth,
} from '../hooks/useHealth';
import { useToast } from '../hooks/useToast';
import { formatDate } from '../lib/format';
import {
  attendanceRate,
  isClubSignal,
  isConcentrated,
  responseRate,
  seasonTrend,
  severityColor,
  signalKey,
  sortSignals,
  sortSuccession,
} from '../lib/health';

/**
 * Die offenen Fürsorge-Hinweise und die Zahlen dahinter (UC-023).
 *
 * Dringend zuerst, dann nach Alter – ausdrücklich **nicht** nach Person
 * gruppiert: Eine nach Namen sortierte Liste von Hinweisen wäre der Anfang
 * einer Akte, und die schliesst BR-097 aus.
 *
 * **Die Kennzahlen stehen unter den Hinweisen, nicht davor.** BR-099 verlangt
 * die Triage in unter zehn Sekunden; wer erst an vier Zahlen vorbeiscrollen
 * muss, triagiert nicht mehr. Die Zahlen sind der Zusammenhang, nicht die
 * Aufgabe.
 */
export function HealthPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const signals = useHealthSignals();
  const club = useClubHealth();
  const teams = useTeamHealth();
  const responsibility = useResponsibility();
  const succession = useSuccessionLead();
  const definitions = useHealthDefinitions();
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = sortSignals(signals.data ?? []);
  const open = rows.find((row) => row.id === openId) ?? null;
  const trend = club.data ? seasonTrend(club.data) : null;
  const offices = sortSuccession(succession.data ?? []);

  return (
    <AppPage
      title={t('health.title')}
      backHref="/tabs/profile"
      onRefresh={() =>
        Promise.all([
          signals.refetch(),
          club.refetch(),
          teams.refetch(),
          responsibility.refetch(),
          succession.refetch(),
        ])
      }
    >
      {signals.isLoading ? (
        <SkeletonList />
      ) : signals.error ? (
        <ErrorState
          error={signals.error as Error}
          onRetry={() => void signals.refetch()}
        />
      ) : rows.length === 0 ? (
        /* BR-165: auch eine gute Nachricht braucht einen nächsten Schritt.
           «Keine Hinweise» heisst nicht «nichts zu tun» – es heisst, dass die
           Aufmerksamkeit anderswo besser aufgehoben ist. */
        <EmptyState
          message={t('health.empty')}
          action={{ label: t('agenda.title'), routerLink: '/tabs/agenda' }}
        />
      ) : (
        <ListSection
          title={t('health.openSignals', { count: rows.length })}
          footnote={t('health.listHint')}
        >
          {rows.map((signal) => (
            <IonItem
              key={signal.id}
              button
              detail
              onClick={() => setOpenId(signal.id)}
            >
              <IonLabel className="ion-text-wrap">
                <h2>
                  {isClubSignal(signal)
                    ? t('health.club')
                    : (signal.memberName ?? t('health.member'))}
                </h2>
                <p>{t(signalKey(signal.signalType, 'title'))}</p>
                <IonNote>
                  {formatDate(signal.detectedAt)}
                  {signal.status === 'in_contact' && signal.ownerName
                    ? ` · ${t('health.ownedBy', { name: signal.ownerName })}`
                    : ''}
                </IonNote>
              </IonLabel>
              <IonBadge slot="end" color={severityColor(signal.severity)}>
                {t(`health.severity.${signal.severity}`)}
              </IonBadge>
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* FR-060: die Vereins-Übersicht. Nur der Vorstand – die Abfrage wird
          für Trainer:innen gar nicht erst gestellt, und der Server wiese sie
          ohnehin ab (BR-096). */}
      {club.data && (
        <ListSection
          title={t('health.clubTitle')}
          footnote={t('health.clubHint', { days: club.data.activeDays })}
        >
          <div className="app-stat-row">
            <StatCard value={club.data.members} label={t('health.members')} />
            <StatCard
              value={club.data.active}
              label={t('health.active')}
              accent="secondary"
            />
            <StatCard
              value={club.data.activated}
              label={t('health.activated')}
              accent="tertiary"
            />
          </div>
          {trend !== null && (
            <IonItem lines="none">
              <IonLabel className="ion-text-wrap">
                <IonNote>
                  {t(trend >= 0 ? 'health.trendUp' : 'health.trendDown', {
                    count: Math.abs(trend),
                  })}
                </IonNote>
              </IonLabel>
            </IonItem>
          )}
        </ListSection>
      )}

      {/* FR-061: die Teamzahlen. Teams unter der Mindestgrösse liefert der
          Server nicht – dort wäre eine Quote die Aussage über eine Person. */}
      {(teams.data ?? []).length > 0 && (
        <ListSection title={t('health.teamsTitle')} footnote={t('health.teamsHint')}>
          {(teams.data ?? []).map((team) => (
            <IonItem key={team.teamId} lines="none">
              <IonLabel className="ion-text-wrap">
                <h2>{team.teamName}</h2>
                <p>
                  {t('health.teamRates', {
                    answered: responseRate(team) ?? 0,
                    attended: attendanceRate(team) ?? 0,
                  })}
                </p>
                <IonNote>{t('health.teamSize', { count: team.members })}</IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* FR-068: die Verantwortungsverteilung. Eine Zahl, keine Namensliste –
          wer trägt, geht aus ihr nicht hervor (BR-095). */}
      {responsibility.data && responsibility.data.efforts > 0 && (
        <ListSection
          title={t('health.responsibilityTitle')}
          footnote={
            isConcentrated(responsibility.data)
              ? t('health.responsibilityTight')
              : t('health.responsibilityHint')
          }
        >
          <IonItem lines="none">
            <IonLabel className="ion-text-wrap">
              <h2>
                {t('health.carriers', {
                  carriers: responsibility.data.carriers,
                  members: responsibility.data.members,
                })}
              </h2>
              <IonNote>
                {t('health.efforts', {
                  count: responsibility.data.efforts,
                  contributors: responsibility.data.contributors,
                })}
              </IonNote>
            </IonLabel>
          </IonItem>
        </ListSection>
      )}

      {/* FR-069: Ämter, die Vorlauf brauchen. Der Weg führt in die Ämterliste –
          dort steht, wer sie hält, und dort wird die Nachfolge eingetragen. */}
      {offices.length > 0 && (
        <ListSection
          title={t('health.successionTitle')}
          footnote={t('health.successionHint')}
        >
          {offices.map((office) => (
            <IonItem
              key={office.roleId}
              button
              detail
              routerLink="/tabs/profile/offices"
            >
              <IonLabel className="ion-text-wrap">
                <h2>{office.title}</h2>
                <IonNote>
                  {office.isVacant
                    ? t('health.vacant')
                    : t('health.heldFor', { years: office.years ?? 0 })}
                </IonNote>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      {/* FR-075: der Definitionskatalog. Eine Kennzahl, deren Definition
          niemand kennt, ist eine Behauptung. */}
      {(definitions.data ?? []).length > 0 && (
        <ListSection
          title={t('health.definitionsTitle')}
          footnote={t('health.definitionsHint')}
        >
          {(definitions.data ?? []).map((entry) => (
            <IonItem key={entry.key} lines="none">
              <IonLabel className="ion-text-wrap">
                <p>{t(`health.definition.${entry.key}`, { value: entry.value })}</p>
              </IonLabel>
            </IonItem>
          ))}
        </ListSection>
      )}

      <HealthSignalModal
        signal={open}
        onDismiss={() => setOpenId(null)}
        onDone={(outcome) => {
          setOpenId(null);
          if (outcome === 'taken') {
            toast.failure(t('health.alreadyTaken'));
          } else if (outcome === 'deleted') {
            toast.success(t('health.resolved'));
          } else {
            toast.success(t('health.tookOver'));
          }
        }}
      />
    </AppPage>
  );
}
