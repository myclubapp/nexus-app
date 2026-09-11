import { IonAvatar } from '@ionic/react';
import { initials } from '../lib/member';

interface MemberAvatarProps {
  displayName: string;
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
 * unterscheiden zwei Personen, eine Silhouette nicht. Das Bild kommt heute als
 * Verweis (`club_members.avatar_url`); ein Upload wartet auf den
 * Vereinsspeicher (UC-008, Aufgabe 14).
 */
export function MemberAvatar({ displayName, avatarUrl, slot = 'start' }: MemberAvatarProps) {
  return (
    <IonAvatar slot={slot} className="app-avatar" aria-hidden="true">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" />
      ) : (
        <span className="app-avatar__initials">{initials(displayName)}</span>
      )}
    </IonAvatar>
  );
}
