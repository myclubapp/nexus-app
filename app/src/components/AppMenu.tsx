import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonMenu,
  IonMenuToggle,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useClub } from '../hooks/useClub';
import { ClubAdminLinks, hasAdminLinks } from './ClubAdminLinks';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ListSection } from './ListSection';

/**
 * Die `id` des Hauptbereichs. `IonSplitPane` sucht sein Hauptfeld unter seinen
 * **direkten** Kindern anhand dieser `id`; `IonMenu` bezieht sich mit
 * `contentId` auf dieselbe. Deshalb steht sie an einer Stelle.
 */
export const APP_CONTENT_ID = 'main';

/**
 * Die Seitenleiste der App.
 *
 * Sie hat zwei Erscheinungsformen, und beide besorgt `IonSplitPane` in
 * `App.tsx`: Ab `lg` (992 px) steht sie dauerhaft neben dem Inhalt – der
 * Laptop- und Tablet-Fall –, darunter fährt sie über den `IonMenuButton` in
 * der Kopfzeile ein. Kein eigener Umbruch, keine zweite Variante.
 *
 * Inhaltlich ist sie **nicht** die Hauptnavigation: Die fünf Bereiche bleiben
 * im Tab-Balken. Hier steht, was auf dem Telefon unter «Profil» begraben ist –
 * Konto, Vereinswechsel, Verwaltung, Sprache, Abmelden.
 *
 * Ohne Verein rendert sie nichts. Damit ist auf dem Anmelde- und dem
 * Onboarding-Bildschirm kein Menü registriert, und der `IonMenuButton` in
 * `AppPage` blendet sich dort von selbst aus.
 */
export function AppMenu() {
  const { t } = useTranslation();
  const { signOut, user } = useAuth();
  const { activeClub, activeMembership, memberships, setActiveClub, isAdmin, isTrainer } =
    useClub();

  if (!activeClub) return null;

  return (
    <IonMenu contentId={APP_CONTENT_ID} menuId="app" side="start">
      <IonHeader translucent>
        <IonToolbar>
          {/* FR-111: Das Logo gehört dorthin, wo der Verein sich selbst
              begegnet – neben seinen Namen. Ohne diese Stelle wäre es eine
              Einstellung, die nichts bewirkt. */}
          {activeClub.settings?.logoUrl && (
            <img
              slot="start"
              className="app-club-logo"
              src={activeClub.settings.logoUrl}
              alt={activeClub.name}
            />
          )}
          <IonTitle>{activeClub.name}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Ein `IonMenuToggle` je Abschnitt, nicht je Zeile: Läge es um die
            einzelnen `IonItem`, wäre jede Zeile Einzelkind ihres Wrappers und
            die Trennlinien der eingefassten Liste fielen weg. `autoHide=false`
            hält den Inhalt sichtbar, wenn das Menü als Spalte steht. */}
        <IonMenuToggle autoHide={false}>
          <ListSection>
            <IonItem button routerLink="/tabs/profile" detail>
              <IonLabel className="ion-text-wrap">
                <h2>{activeMembership?.display_name ?? user?.email}</h2>
                <IonNote>{t('profile.title')}</IonNote>
              </IonLabel>
            </IonItem>
          </ListSection>
        </IonMenuToggle>

        {/* Der Vereinswechsel steht bewusst ausserhalb des Umschalters: Ein
            Klick auf die Auswahl soll das Menü nicht zuklappen, bevor die
            Auswahlliste überhaupt offen ist. */}
        {memberships.length > 1 && (
          <ListSection>
            <IonItem>
              <IonSelect
                label={t('menu.switchClub')}
                value={activeMembership?.club_id}
                onIonChange={(e) => setActiveClub(e.detail.value as string)}
                cancelText={t('common.cancel')}
                okText={t('common.ok')}
              >
                {memberships.map((membership) => (
                  <IonSelectOption key={membership.club_id} value={membership.club_id}>
                    {membership.club.name}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          </ListSection>
        )}

        {/* Seit UC-023 auch für Trainer:innen: Die Vereins-Gesundheit gehört
            ihnen für ihr Team (BR-096). Was darin steht, entscheidet
            `ClubAdminLinks` – hier steht nur, ob der Abschnitt überhaupt
            erscheint. */}
        {hasAdminLinks(isAdmin, isTrainer, activeClub.settings) && (
          <IonMenuToggle autoHide={false}>
            <ListSection title={t('menu.administration')}>
              <ClubAdminLinks />
            </ListSection>
          </IonMenuToggle>
        )}

        <ListSection title={t('profile.settings')}>
          <IonItem>
            <LanguageSwitcher />
          </IonItem>
        </ListSection>

        <IonMenuToggle autoHide={false}>
          <div className="app-actions">
            <IonButton expand="block" fill="outline" onClick={() => void signOut()}>
              {t('auth.logout')}
            </IonButton>
          </div>
        </IonMenuToggle>
      </IonContent>
    </IonMenu>
  );
}
