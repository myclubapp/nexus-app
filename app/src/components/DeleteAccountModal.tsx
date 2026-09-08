import { useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { useAdminBlockers, useDeleteAccount } from '../hooks/useAccount';
import { ListSection } from './ListSection';
import { InlineError } from './StateViews';

interface DeleteAccountModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

/**
 * Der Inhalt des Löschblatts – bewusst als eigene Komponente.
 *
 * `IonModal` rendert in jsdom seinen Inhalt gar nicht (docs/TESTING.md); an
 * dieser Trennung hängt, dass die Erklärung und die Sperre für den einzigen
 * Vorstand überhaupt prüfbar sind.
 */
export function DeleteAccountContent({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();
  const blockers = useAdminBlockers();
  const deleteAccount = useDeleteAccount();
  const [confirmation, setConfirmation] = useState('');

  const requiredWord = t('deleteAccount.confirmWord');
  const isConfirmed =
    confirmation.trim().toLocaleUpperCase() === requiredWord.toLocaleUpperCase();
  const blocked = (blockers.data?.length ?? 0) > 0;

  return (
    <>
      {/* Schritt 2: in klarer Sprache, was geschieht. */}
      <div className="app-hint">
        <IonText>
          <p>{t('deleteAccount.intro')}</p>
        </IonText>
      </div>

      <ListSection title={t('deleteAccount.removedTitle')}>
        {(['profile', 'contact', 'notifications', 'private'] as const).map((key) => (
          <IonItem key={key}>
            <IonLabel className="ion-text-wrap">{t(`deleteAccount.removed.${key}`)}</IonLabel>
          </IonItem>
        ))}
      </ListSection>

      <ListSection
        title={t('deleteAccount.keptTitle')}
        footnote={t('deleteAccount.keptFootnote')}
      >
        <IonItem>
          <IonLabel className="ion-text-wrap">{t('deleteAccount.kept.points')}</IonLabel>
        </IonItem>
      </ListSection>

      {/* A1: Der Verein darf nicht ohne Vorstand zurückbleiben. */}
      {blocked ? (
        <>
          <ListSection
            title={t('deleteAccount.blockedTitle')}
            footnote={t('deleteAccount.blockedHint')}
          >
            <IonList>
              {blockers.data!.map((blocker) => (
                <IonItem key={blocker.clubId}>
                  <IonLabel className="ion-text-wrap">{blocker.clubName}</IonLabel>
                </IonItem>
              ))}
            </IonList>
          </ListSection>

          <div className="app-actions">
            <IonButton expand="block" fill="outline" onClick={onDismiss}>
              {t('common.close')}
            </IonButton>
          </div>
        </>
      ) : (
        <>
          <ListSection footnote={t('deleteAccount.confirmHint', { word: requiredWord })}>
            <IonItem>
              <IonInput
                label={t('deleteAccount.confirmLabel', { word: requiredWord })}
                labelPlacement="stacked"
                autocapitalize="characters"
                autocomplete="off"
                value={confirmation}
                onIonInput={(e) => setConfirmation(e.detail.value ?? '')}
              />
            </IonItem>
          </ListSection>

          {deleteAccount.error && (
            <InlineError message={(deleteAccount.error as Error).message} />
          )}

          <div className="app-actions">
            <IonButton
              expand="block"
              color="danger"
              disabled={!isConfirmed || deleteAccount.isPending}
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? (
                <IonSpinner name="crescent" />
              ) : (
                t('deleteAccount.confirmAction')
              )}
            </IonButton>
            <IonNote>{t('deleteAccount.irreversible')}</IonNote>
          </div>
        </>
      )}
    </>
  );
}

/**
 * Konto löschen (UC-006).
 *
 * Kein `FormModal`: Der bestätigende Knopf ist hier zerstörerisch und gehört
 * nicht an die Stelle, an der sonst «Speichern» steht. Statt eines Häkchens
 * verlangt die Bestätigung ein getipptes Wort – Schritt 3 der Spezifikation
 * fordert eine **ausdrückliche** Bestätigung, und ein Tap daneben ist keine.
 */
export function DeleteAccountModal({ isOpen, onDismiss }: DeleteAccountModalProps) {
  const { t } = useTranslation();

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>{t('common.cancel')}</IonButton>
          </IonButtons>
          <IonTitle>{t('deleteAccount.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Der Inhalt wird bei jedem Öffnen neu aufgebaut, damit ein früher
            getipptes Bestätigungswort nicht stehen bleibt. */}
        {isOpen && <DeleteAccountContent onDismiss={onDismiss} />}
      </IonContent>
    </IonModal>
  );
}
