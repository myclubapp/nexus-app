import { useState } from 'react';
import { IonAvatar, IonButton, IonIcon, IonItem, IonLabel, IonSpinner } from '@ionic/react';
import { imageOutline } from 'ionicons/icons';
import { useTranslation } from 'react-i18next';
import { useToast } from '../hooks/useToast';
import { logoUrl, pickImage, useSignedMediaUrl, useUploadMedia } from '../hooks/useMedia';
import type { MediaKind } from '../lib/image';
import { ListSection } from './ListSection';

interface ImagePickerProps {
  /** Überschrift des Abschnitts. */
  title: string;
  /** Was darunter steht – etwa, wer das Bild zu sehen bekommt. */
  footnote?: string;
  kind: MediaKind;
  /** Team- oder Mitgliedskennung; beim Vereinslogo `null`. */
  ownerId: string | null;
  /** Was heute hinterlegt ist – Pfad oder Adresse, beides wird angezeigt. */
  url: string | null;
  /**
   * Wird mit Pfad **und** Adresse gerufen – oder mit `null` beim Entfernen.
   * Welchen der beiden Werte die Ansicht ablegt, entscheidet ihre Spalte:
   * Profilbild und Teambild führen den Pfad (`0083`), das Vereinslogo die
   * Adresse.
   */
  onChange: (value: { path: string; url: string } | null) => void;
  /** Rund wie ein Avatar (Profilbild) oder breit (Teambild)? */
  shape?: 'avatar' | 'wide';
  disabled?: boolean;
}

/**
 * Ein Bild wählen, aufnehmen oder wegnehmen (UC-045).
 *
 * **Ein Bauteil für alle drei Bilder** – Vereinslogo, Teambild, Profilbild.
 * Sie unterscheiden sich in Form und Reichweite, nicht im Ablauf: auswählen,
 * verkleinern, hochladen, Adresse zurückgeben (guidelines §1,
 * «Wiederverwenden vor Neubauen»).
 *
 * Das Bauteil schreibt **nichts** an eine Tabelle. Es legt die Datei ab und
 * meldet die Adresse; wohin die gehört – `settings.logoUrl`, `teams.photo_url`
 * oder `club_members.avatar_url` –, entscheidet die aufrufende Ansicht über
 * ihren eigenen, geprüften Weg (`set_team_photo()`, `set_member_avatar()`).
 *
 * Kein `ManageSection`: Das Bild ist ein Feld des Formulars, kein
 * Verwaltungsweg des Details (guidelines §11 Nr. 19). Das Entfernen steht
 * deshalb hier, in derselben Zeile, und nicht unten in Rot.
 */
export function ImagePicker({
  title,
  footnote,
  kind,
  ownerId,
  url,
  onChange,
  shape = 'avatar',
  disabled = false,
}: ImagePickerProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const upload = useUploadMedia();
  const [isPicking, setPicking] = useState(false);

  const busy = isPicking || upload.isPending;
  // Was in der Spalte steht, ist ein Pfad; angezeigt wird eine Adresse. Das
  // Logo liegt öffentlich, Team- und Profilbild brauchen eine Signatur – der
  // Hook läuft immer, gibt beim Logo aber nichts zurück (Regel der Hooks:
  // keine Bedingung davor).
  const signed = useSignedMediaUrl(kind === 'logo' ? null : url);
  const preview = kind === 'logo' ? logoUrl(url) : signed;

  async function choose() {
    setPicking(true);
    try {
      const file = await pickImage();
      // Ein Abbruch ist kein Fehler und bekommt keine Meldung.
      if (!file) return;

      const next = await upload.mutateAsync({ kind, ownerId, file });
      // «Hochgeladen», nicht «gespeichert»: Die Datei liegt, die Spalte ist
      // damit noch nicht geschrieben. Das meldet die aufrufende Ansicht –
      // beim Logo erst, wenn jemand das Formular speichert.
      onChange(next);
      toast.success(t('media.uploaded'));
    } catch (cause) {
      // Nur eigene, übersetzte Texte. Was aus dem Plugin oder der
      // Storage-API kommt, ist englisch und für niemanden hier gedacht
      // (guidelines §8).
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'tooLarge') toast.failure(t('media.tooLarge'));
      else if (message === 'unsupported') toast.failure(t('media.unsupported'));
      else toast.failure(t('common.error'));
    } finally {
      setPicking(false);
    }
  }

  return (
    <ListSection title={title} footnote={footnote}>
      {shape === 'wide' && preview && (
        <IonItem lines="none">
          {/* `alt=""`: Das Bild trägt keine Aussage, die der Titel daneben
              nicht schon trägt – ein zweiter Vorlesetext wäre Lärm. */}
          <img className="app-image-wide" src={preview} alt="" />
        </IonItem>
      )}

      <IonItem>
        {shape === 'avatar' && (
          <IonAvatar slot="start" className="app-avatar" aria-hidden="true">
            {preview ? (
              <img
                src={preview}
                alt=""
                className={kind === 'logo' ? 'app-image-contain' : undefined}
              />
            ) : (
              // Ein Symbol statt eines «+»: Ein Literal im JSX ist auch als
              // Zeichen ein Benutzertext (guidelines §11 Nr. 7).
              <IonIcon icon={imageOutline} />
            )}
          </IonAvatar>
        )}

        <IonLabel className="ion-text-wrap">
          {url ? t('media.present') : t('media.none')}
        </IonLabel>

        {busy ? (
          <IonSpinner slot="end" aria-label={t('common.loading')} />
        ) : (
          <IonButton slot="end" fill="clear" disabled={disabled} onClick={() => void choose()}>
            {url ? t('media.change') : t('media.choose')}
          </IonButton>
        )}
      </IonItem>

      {/* Das Entfernen bekommt seinen Wortlaut in die Zeile, nicht nur einen
          roten Knopf am Rand – eine Zeile ohne Text liest sich wie eine
          leere. */}
      {url && !busy && (
        <IonItem>
          <IonLabel className="ion-text-wrap" color="medium">
            {t('media.removeHint')}
          </IonLabel>
          <IonButton
            slot="end"
            fill="clear"
            color="danger"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            {t('media.remove')}
          </IonButton>
        </IonItem>
      )}
    </ListSection>
  );
}
