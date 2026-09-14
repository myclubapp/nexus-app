import { IonAvatar } from '@ionic/react';
import { useSignedMediaUrl } from '../hooks/useMedia';
import { initials } from '../lib/member';

interface MemberAvatarProps {
  displayName: string;
  /**
   * `club_members.avatar_url`. Seit UC-045 steht dort der **Pfad** im
   * privaten Vereinsspeicher; `useSignedMediaUrl()` holt dafür eine
   * ablaufende Adresse – gebündelt, eine Anfrage für die ganze Liste. Eine
   * Adresse wird unverändert übernommen; der Bestand und fremde Verweise
   * bleiben damit gültig.
   */
  avatarUrl?: string | null;
  /** Ionic-Slot in einem `IonItem`; Standard `start`, wie in jeder Personenzeile. */
  slot?: 'start' | 'end';
}

/**
 * Der Avatar einer Person – Bild, sonst Initialen.
 *
 * Nachbau des `app-user-list-item` der bestehenden myclub-App: Dort steht in
 * jeder Personenzeile links ein Avatar. Hier ist er ein eigenes Bauteil,
 * damit Mitgliederliste, Teamliste und Rangliste dieselbe Zeile zeigen
 * (guidelines §1, «Wiederverwenden vor Neubauen»).
 *
 * Ohne Bild stehen Initialen, nicht eine graue Silhouette: Zwei Buchstaben
 * unterscheiden zwei Personen, eine Silhouette nicht. Das Bild steht in
 * `club_members.avatar_url`; seit UC-045 lädt es die Person selbst im
 * Profil-Blatt hoch (`ImagePicker`). **Hier wird der Pfad zur Adresse** –
 * an genau einer Stelle, weil jede Personenzeile der App durch dieses
 * Bauteil geht. Solange die Signatur unterwegs ist, stehen die Initialen;
 * ein Platzhalter, der zum Bild springt, flackert in einer langen Liste.
 */
export function MemberAvatar({ displayName, avatarUrl, slot = 'start' }: MemberAvatarProps) {
  const src = useSignedMediaUrl(avatarUrl);
  return (
    <IonAvatar slot={slot} className="app-avatar" aria-hidden="true">
      {src ? (
        <img src={src} alt="" />
      ) : (
        <span className="app-avatar__initials">{initials(displayName)}</span>
      )}
    </IonAvatar>
  );
}
