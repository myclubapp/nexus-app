import { IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import { calendarOutline, personAddOutline, trophyOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { ListSection } from './ListSection';

interface FirstStepsCardProps {
  /** Vereinsname, damit die Überschrift den frisch gegründeten Verein benennt. */
  clubName: string;
}

/**
 * Der Startbildschirm nach der Gründung (UC-001, Schritt 9).
 *
 * Genau drei Angebote, nicht mehr: Wer gerade einen Verein angelegt hat,
 * braucht einen ersten Termin, Mitglieder und den Blick auf die Punkteregeln.
 * Eine längere Liste wäre wieder eine Konfigurationsaufgabe – genau das, was
 * der Zero-Config-Start vermeiden soll (K7, BR-002).
 */
export function FirstStepsCard({ clubName }: FirstStepsCardProps) {
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
