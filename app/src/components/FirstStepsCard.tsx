import { IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import {
  calendarOutline,
  globeOutline,
  personAddOutline,
  trophyOutline,
} from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
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
    >
      {steps.map((step) => (
        <IonItem key={step.key} button detail routerLink={step.href}>
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
