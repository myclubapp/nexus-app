import { IonButton, IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import {
  calendarOutline,
  globeOutline,
  personAddOutline,
  trophyOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { CLUB_SETUP_ROUTE } from '../lib/clubSetup';
import { ListSection } from './ListSection';

interface FirstStepsCardProps {
  /** Vereinsname, damit die Überschrift den frisch gegründeten Verein benennt. */
  clubName: string;
  /**
   * Bietet zusätzlich an, die News von der Vereins-Website zu holen (UC-038).
   * Nur solange keine Website verbunden ist – danach fällt das Angebot weg und
   * es stehen wieder genau drei Schritte da.
   */
  offerNewsImport?: boolean;
}

/**
 * Der Startbildschirm nach der Gründung (UC-001, Schritt 10).
 *
 * Drei Angebote, nicht mehr: Wer gerade einen Verein angelegt hat, braucht
 * einen ersten Termin, Mitglieder und den Blick auf die Punkteregeln. Eine
 * längere Liste wäre wieder eine Konfigurationsaufgabe – genau das, was der
 * Zero-Config-Start vermeiden soll (K7, BR-002).
 *
 * Die einzige Ausnahme ist der Website-Import (UC-038). Er steht hier, weil er
 * nur einmal im Leben eines Vereins etwas nützt: beim Aufsetzen, wenn der Feed
 * noch leer ist. Sobald eine Website verbunden ist, verschwindet die Zeile
 * wieder – das Angebot wächst nicht zur Konfigurationsliste an.
 */
export function FirstStepsCard({ clubName, offerNewsImport = false }: FirstStepsCardProps) {
  const { t } = useTranslation();

  const steps = [
    {
      key: 'event',
      icon: calendarOutline,
      href: '/tabs/agenda',
    },
    {
      key: 'invite',
      icon: personAddOutline,
      href: '/tabs/profile/invite',
    },
    {
      key: 'rules',
      icon: trophyOutline,
      href: '/tabs/profile/rules',
    },
    ...(offerNewsImport
      ? ([{ key: 'news', icon: globeOutline, href: '/tabs/profile/news' }] as const)
      : []),
  ] as const;

  return (
    <ListSection
      title={t('firstSteps.title', { club: clubName })}
      footnote={t('firstSteps.footnote')}
      /* UC-051: der Weg in den Einrichtungs-Assistenten – als Knopf in der
         Überschrift und **nicht** als vierte Zeile. Die Karte bleibt bei drei
         Angeboten (BR-002, BR-171); der Assistent ist kein viertes Angebot,
         sondern der Weg, der sie alle nacheinander abfragt. */
      action={
        <IonButton fill="clear" size="small" routerLink={CLUB_SETUP_ROUTE}>
          {t('firstSteps.setup')}
        </IonButton>
      }
    >
      {/* Jeder Schritt liegt in einem anderen Tab: `root` startet ihn dort
          ohne Fremd-History, statt vorwärts hineinzuschieben. */}
      {steps.map((step) => (
        <IonItem key={step.key} button detail routerLink={step.href} routerDirection="root">
          <IonIcon slot="start" icon={step.icon} color="primary" aria-hidden="true" />
          <IonLabel className="ion-text-wrap">
            <h2>{t(`firstSteps.${step.key}.title`)}</h2>
            <IonNote>{t(`firstSteps.${step.key}.hint`)}</IonNote>
          </IonLabel>
        </IonItem>
      ))}
    </ListSection>
  );
}
