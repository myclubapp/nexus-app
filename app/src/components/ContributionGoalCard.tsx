import {
  IonBadge,
  IonIcon,
  IonItem,
  IonLabel,
  IonNote,
  IonProgressBar,
} from '@ionic/react';
import { calendarOutline, checkmarkCircleOutline, listOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';
import { goalColor, goalProgress, plannedProgress } from '../lib/contributionGoal';
import { useMyContributionGoal } from '../hooks/useContributionGoal';
import { useNextContributions } from '../hooks/useGamification';
import { formatDate } from '../lib/format';

/**
 * Der eigene Fortschritt zum Saisonziel (UC-042, FR-161).
 *
 * Die Karte erscheint **nur**, wenn das Modul läuft und ein Ziel gilt: Der
 * Hook gibt sonst `null` (A2, A3, A7). Ein Balken ohne Ende wäre keine
 * Auskunft.
 *
 * Unter dem Balken stehen die nächsten passenden Beiträge – dieselbe Quelle
 * wie der Marktplatz (`next_contributions()`, BR-083). Das ist die Haltung aus
 * K3: Wer zurückliegt, bekommt ein Angebot, keine Mahnung (BR-201).
 *
 * **Drei Zahlen, nicht zwei (FR-198).** Zwischen dem Geleisteten und dem, was
 * man noch tun könnte, liegt das **Zugesagte**: die angemeldete Schicht, die
 * übernommene Aufgabe, das laufende Amt. Wer im November drei Schichten im
 * Kalender hat, stand vorher auf null und erfuhr erst am Saisonende, dass sein
 * Beitrag längst stand. Der Balken zeigt es als zweiten, blassen Abschnitt
 * (`buffer`), die Zeile darunter im Klartext – die **Ampel** bleibt am
 * Geleisteten (BR-265): Eine Zusage ist keine Leistung.
 */
export function ContributionGoalCard() {
  const { t } = useTranslation();
  const goal = useMyContributionGoal();
  // Der Hook läuft immer – Hooks lassen sich nicht an eine Bedingung hängen.
  // **Angezeigt** werden die Vorschläge nur, solange das Ziel offen ist: Wer
  // es erreicht hat, braucht keine Liste, was er noch tun könnte (BR-201).
  // BR-265: Unter einem Zielbalken darf nur stehen, was diesen Balken auch
  // bewegt. Ohne den Schalter schlüge die Karte Trainings vor (Säule 1) und
  // behauptete mit der Fussnote, sie zählten aufs Ziel.
  const suggestions = useNextContributions(3, true);
  const isOpen = Boolean(goal.data) && goal.data?.state !== 'reached';

  if (!goal.data) return null;

  const { earned, planned, goal: target, remaining, state } = goal.data;
  const color = goalColor(state);
  const items = isOpen ? (suggestions.data ?? []) : [];
  // Erreicht ist erreicht: Wer sein Ziel hat, braucht keine Vorschau mehr auf
  // das, was noch kommt.
  const showPlanned = planned > 0 && state !== 'reached';

  return (
    <ListSection
      title={t('seasonGoal.my.title')}
      footnote={
        state === 'reached'
          ? t('seasonGoal.my.reachedHint')
          : t('seasonGoal.my.openHint')
      }
    >
      <IonItem lines={items.length > 0 ? 'full' : 'none'}>
        {state === 'reached' && (
          <IonIcon
            slot="start"
            icon={checkmarkCircleOutline}
            color="success"
            aria-hidden="true"
          />
        )}
        <IonLabel>
          <h2>{t('seasonGoal.my.season', { season: goal.data.season })}</h2>
          <p>
            {state === 'reached'
              ? t('seasonGoal.my.reached')
              : t('seasonGoal.my.remaining', { points: remaining })}
          </p>
          {/* Der Balken bleibt bei voll stehen, auch wenn jemand sein Ziel
              übertrifft – `IonProgressBar` zeichnet über 1 hinaus. Der
              `buffer` trägt das Eingeplante: derselbe Balken, blasser, und
              deshalb ohne eigene Farbe. */}
          <IonProgressBar
            className="app-goal-bar"
            color={color}
            value={goalProgress(earned, target)}
            buffer={showPlanned ? plannedProgress(earned, planned, target) : 1}
          />
          {showPlanned && <p>{t('seasonGoal.my.planned', { points: planned })}</p>}
        </IonLabel>
        {/* §11 Nr. 18: nur die Zahl im Badge, der Wortlaut als `aria-label`. */}
        <IonBadge
          slot="end"
          color={color}
          aria-label={t('seasonGoal.my.badgeLabel', { earned, goal: target })}
        >
          {earned}/{target}
        </IonBadge>
      </IonItem>

      {items.map((item) => (
        <IonItem
          key={`${item.kind}-${item.refId}`}
          button
          detail
          routerLink={
            item.kind === 'task' ? '/tabs/marketplace' : '/tabs/agenda'
          }
        >
          <IonIcon
            slot="start"
            icon={item.kind === 'task' ? listOutline : calendarOutline}
            color="medium"
            aria-hidden="true"
          />
          <IonLabel>
            <h3>{item.title}</h3>
            {item.whenAt && <p>{formatDate(item.whenAt)}</p>}
          </IonLabel>
          {item.points !== null && (
            <IonNote slot="end" color="primary">
              +{item.points}
            </IonNote>
          )}
        </IonItem>
      ))}
    </ListSection>
  );
}
