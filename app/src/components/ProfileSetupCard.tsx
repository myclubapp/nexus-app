import { IonIcon, IonItem, IonLabel, IonNote } from '@ionic/react';
import { personCircleOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { PROFILE_SETUP_ROUTE } from '../lib/profileSetup';
import { ListSection } from './ListSection';

/**
 * Der Weg zurück in den Profil-Assistenten (UC-053, BR-270).
 *
 * **Eine Zeile, kein Mahnmal.** Sie steht auf dem Dashboard, solange das
 * Profil unangetastet ist – also weder ein Bild noch einen selbst gewählten
 * Namen trägt –, und verschwindet, sobald eines von beidem da ist. Damit ist
 * sie in zwei Fingertipps loszuwerden, und wer den Assistenten übersprungen
 * hat, findet ihn trotzdem wieder.
 *
 * Bewusst **neben** `FirstStepsCard` und nicht darin: Die «Erste
 * Schritte»-Karte gehört dem frisch gegründeten **Verein** und sieht nur der
 * Vorstand; diese Zeile gehört der Person und betrifft jedes Mitglied.
 */
export function ProfileSetupCard() {
  const { t } = useTranslation();

  return (
    <ListSection>
      <IonItem button detail routerLink={PROFILE_SETUP_ROUTE}>
        <IonIcon slot="start" icon={personCircleOutline} color="primary" aria-hidden="true" />
        <IonLabel className="ion-text-wrap">
          <h2>{t('profileSetup.card.title')}</h2>
          <IonNote>{t('profileSetup.card.hint')}</IonNote>
        </IonLabel>
      </IonItem>
    </ListSection>
  );
}
