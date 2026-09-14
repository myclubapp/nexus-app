import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { isConfigured, supabase } from '../lib/supabase';
import {
  MEDIA_MAX_BYTES,
  MEDIA_MIME_TYPES,
  isSupportedImage,
  mediaPath,
  shrinkImage,
  type MediaKind,
} from '../lib/image';
import { useClub } from './useClub';

/**
 * Die beiden Buckets aus `0083`. Stehen einmal, damit Pfad und Policy
 * zusammenbleiben.
 *
 * **`club-logo` ist öffentlich, `club-photos` nicht** – und das ist der
 * ganze Unterschied zwischen einem Zeichen, mit dem ein Verein nach aussen
 * auftritt, und dem Gesicht einer Person. Ein Team- oder Profilbild bekommt
 * nur, wer im selben Verein ist und wem die App eine ablaufende Signatur
 * ausstellt (`useSignedMediaUrl()`).
 */
export const LOGO_BUCKET = 'club-logo';
export const PHOTO_BUCKET = 'club-photos';

export function bucketFor(kind: MediaKind): string {
  return kind === 'logo' ? LOGO_BUCKET : PHOTO_BUCKET;
}

/**
 * Wie lange eine signierte Adresse gilt, und wie lange die App sie
 * wiederverwendet.
 *
 * Eine Stunde ist lang genug, dass niemand beim Blättern in einer langen
 * Liste in ein abgelaufenes Bild läuft, und kurz genug, dass eine Adresse,
 * die versehentlich weitergegeben wird, nicht überdauert. Nachgeladen wird
 * nach der halben Zeit – eine abgelaufene Adresse im `src` wäre ein leeres
 * Bild, das niemand erklären kann.
 */
export const SIGNED_URL_TTL = 3600;

/**
 * Die öffentliche Adresse des Vereinslogos.
 *
 * Nur für das Logo: Sein Bucket ist öffentlich, weil es **vor** der Anmeldung
 * lädt (Einladungsseite, White-Label) – dort gibt es niemanden, für den
 * signiert werden könnte.
 *
 * Ein Wert, der schon mit `http` beginnt, kommt unverändert zurück: Das Logo
 * darf eine fremde Adresse sein (UC-034), und ein Bestand aus früheren Zeiten
 * soll nicht plötzlich ins Leere zeigen.
 */
export function logoUrl(pathOrUrl: string | null | undefined): string | null {
  const value = (pathOrUrl ?? '').trim();
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(value).data.publicUrl;
}

// ---------------------------------------------------------------------------
// Signierte Adressen – gebündelt.
//
// Eine Mitgliederliste zeigt zweihundert Avatare. Zweihundert einzelne
// Signieranfragen wären zweihundert Netzaufrufe; `createSignedUrls` kann sie
// in einem erledigen. Deshalb sammelt diese Warteschlange alle Pfade, die im
// selben Augenblick gebraucht werden, und löst sie mit **einem** Aufruf ein.
// ---------------------------------------------------------------------------

type Waiting = { resolve: (url: string | null) => void };

const queue = new Map<string, Waiting[]>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushQueue() {
  flushTimer = null;
  const paths = [...queue.keys()];
  const waiting = new Map(queue);
  queue.clear();
  if (paths.length === 0) return;

  const settle = (path: string, url: string | null) => {
    for (const entry of waiting.get(path) ?? []) entry.resolve(url);
  };

  try {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error || !data) {
      for (const path of paths) settle(path, null);
      return;
    }
    const byPath = new Map(
      data.map((entry) => [entry.path ?? '', entry.error ? null : entry.signedUrl]),
    );
    for (const path of paths) settle(path, byPath.get(path) ?? null);
  } catch {
    // Kein Bild ist besser als ein kaputtes: Die Initialen treten an seine
    // Stelle, und niemand sieht einen Fehler, den niemand beheben kann.
    for (const path of paths) settle(path, null);
  }
}

function signPath(path: string): Promise<string | null> {
  return new Promise((resolve) => {
    const list = queue.get(path) ?? [];
    list.push({ resolve });
    queue.set(path, list);
    // Ein Tick reicht: Alle Zeilen einer Liste rendern im selben Durchgang.
    flushTimer ??= setTimeout(() => void flushQueue(), 0);
  });
}

/**
 * Die Adresse zu einem Team- oder Profilbild – signiert und ablaufend.
 *
 * `null`, solange sie unterwegs ist, und `null`, wenn es keine gibt. Beides
 * führt zur selben Anzeige: die Initialen bzw. gar kein Bild. Ein Wert, der
 * mit `http` beginnt, kommt unverändert zurück (Bestand, fremder Verweis).
 */
export function useSignedMediaUrl(path: string | null | undefined): string | null {
  const value = (path ?? '').trim();
  const external = value.startsWith('http://') || value.startsWith('https://');

  const query = useQuery({
    queryKey: ['signed-media-url', value],
    enabled: Boolean(value) && !external && isConfigured,
    // Deutlich kürzer als die Gültigkeit – wie beim Factsheet (0070).
    staleTime: (SIGNED_URL_TTL / 2) * 1000,
    gcTime: SIGNED_URL_TTL * 1000,
    queryFn: () => signPath(value),
  });

  if (!value) return null;
  if (external) return value;
  return query.data ?? null;
}

/**
 * Ein Bild vom Gerät holen (UC-045, Schritt 2).
 *
 * Zwei Wege, weil die Plattformen zwei sind:
 *
 * - **Nativ** über `Camera.getPhoto` mit `CameraSource.Prompt`. Das ist das
 *   Blatt, das iOS und Android selbst zeigen: «Foto aufnehmen» oder
 *   «Mediathek». Die Berechtigung holt das Plugin dabei selbst ein – die
 *   Zweckangaben stehen in `Info.plist` und `AndroidManifest.xml`.
 * - **Im Browser** ein gewöhnliches `<input type="file" accept="image/*">`.
 *   Auf einem Telefon bietet auch das die Kamera an, und es spart
 *   `@ionic/pwa-elements` – eine weitere Abhängigkeit im Hauptchunk, der
 *   ohnehin an der Precache-Grenze liegt.
 *
 * Gibt `null`, wenn die Person abbricht – auf beiden Wegen. Ein Abbruch ist
 * kein Fehler und bekommt keine Meldung.
 */
export async function pickImage(): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    let photo;
    try {
      photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: 90,
        // Zuschneiden auf dem Gerät: iOS und Android bringen den Zuschneider
        // mit, und ein Profilbild ist rund – wer den Ausschnitt nicht wählen
        // kann, steht schief im Kreis.
        allowEditing: true,
      });
    } catch {
      // **Das Plugin wirft beim Abbrechen** («User cancelled photos app») –
      // es gibt kein Ergebnis ohne `webPath`. Ohne dieses `catch` sähe jede
      // Person, die den Bildwähler schliesst, einen roten Toast mit
      // englischem Plugin-Text. Ein Abbruch ist kein Fehler.
      return null;
    }
    if (!photo.webPath) return null;

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    return new File([blob], `foto.${photo.format || 'jpg'}`, {
      type: blob.type || 'image/jpeg',
    });
  }

  return new Promise<File | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = MEDIA_MIME_TYPES.join(',');
    input.style.display = 'none';
    document.body.append(input);

    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(file);
    };

    input.onchange = () => finish(input.files?.[0] ?? null);
    // `cancel` gibt es erst ab Chrome 113, Firefox 116 und Safari 17. Auf
    // allem Älteren feuert weder `change` noch `cancel`, das Versprechen
    // bliebe offen und der Knopf für immer im Ladezustand. Der zweite Weg:
    // Kommt der Fokus ins Fenster zurück und ist bis dahin nichts gewählt,
    // war es ein Abbruch. Die kurze Verzögerung lässt `change` den Vortritt –
    // es feuert in manchen Browsern nach dem Fokus.
    input.oncancel = () => finish(null);
    window.addEventListener(
      'focus',
      () => window.setTimeout(() => finish(null), 400),
      { once: true },
    );

    input.click();
  });
}

/**
 * Ein Bild in den Vereinsspeicher legen und seine Adresse zurückgeben.
 *
 * Verkleinert **vor** dem Hochladen (`shrinkImage`): Was als Zwölf-Megabyte-
 * Foto beginnt, liegt danach bei ein paar hundert Kilobyte. Die Grenze des
 * Buckets (5 MiB) fängt ab, was sich nicht verkleinern liess, und meldet es.
 *
 * Der Pfad entscheidet über das Recht, nicht dieser Hook: `can_write_club_media()`
 * in `0083` liest ihn und lässt den Vorstand ans Logo, die Trainer:in an ihr
 * Team und jede Person an ihr eigenes Bild.
 */
export function useUploadMedia() {
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      kind: MediaKind;
      /** Team- oder Mitgliedskennung; beim Logo `null`. */
      ownerId: string | null;
      file: File;
    }): Promise<{ path: string; url: string }> => {
      if (!activeClub) throw new Error('Kein aktiver Verein');
      if (!isConfigured) throw new Error('Kein Zugang zum Vereinsspeicher');

      const file = await shrinkImage(input.file, input.kind);
      // Liess sich das Bild nicht verkleinern (HEIC vom iPhone), kommt die
      // Ursprungsdatei zurück. Dann hier abweisen – der Bucket täte es auch,
      // aber mit einer englischen Meldung aus der Storage-API.
      if (!isSupportedImage(file.type)) {
        throw new Error('unsupported');
      }
      if (file.size > MEDIA_MAX_BYTES) {
        throw new Error('tooLarge');
      }

      // Die Art bestimmt den Bucket: Ein Logo in den öffentlichen, ein Team-
      // oder Profilbild in den privaten. Die Policies pinnen dieselbe Regel
      // noch einmal – ein Profilbild kommt in `club-logo` gar nicht hinein.
      const bucket = bucketFor(input.kind);
      const path = mediaPath(input.kind, activeClub.id, input.ownerId, file.name);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);

      // Der Pfad gehört in die Spalte (Profilbild, Teambild). Die Adresse gibt
      // es nur für das Logo – bei den privaten Bildern wird sie bei jedem
      // Anzeigen frisch signiert und taugt nicht als gespeicherter Wert.
      return {
        path,
        url: input.kind === 'logo' ? (logoUrl(path) ?? '') : '',
      };
    },
  });
}

/**
 * Ein Bild wieder wegnehmen.
 *
 * Erst die Spalte leeren, dann die Datei löschen: Umgekehrt zeigte die Liste
 * für einen Moment auf eine Adresse, hinter der nichts mehr liegt. Schlägt das
 * Löschen der Datei fehl, bleibt eine verwaiste Datei im Speicher – das ist
 * kein Fehler, den die Person sehen müsste.
 */
async function removeFile(pathOrUrl: string | null | undefined, bucket: string) {
  if (!pathOrUrl) return;
  // Ein Pfad kommt direkt (Profilbild, Teambild), eine Adresse wird zerlegt
  // (Vereinslogo). Was weder das eine noch das andere ist, wird nicht
  // angefasst – eine fremde Adresse hat hier nichts zu löschen.
  let path = pathOrUrl;
  if (pathOrUrl.startsWith('http')) {
    const marker = `/${bucket}/`;
    const at = pathOrUrl.indexOf(marker);
    if (at < 0) return;
    path = pathOrUrl.slice(at + marker.length).split('?')[0];
  }
  const { error } = await supabase.storage
    .from(bucket)
    .remove([decodeURIComponent(path)]);
  if (error) {
    // Bewusst ohne Toast: Eine verwaiste Datei ist nichts, was die Person
    // beheben könnte. Aber nicht unbemerkt – sonst sieht niemand, wenn ein
    // Rechte- oder Pfadfehler dahintersteckt.
    console.warn('Datei im Vereinsspeicher nicht gelöscht:', error.message);
  }
}

/** Das Profilbild setzen oder wegnehmen (`set_member_avatar`, 0083). */
export function useSetMemberAvatar() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      memberId: string;
      url: string | null;
      /** Die bisherige Adresse – ihre Datei wird danach gelöscht. */
      previousUrl?: string | null;
    }) => {
      const { error } = await supabase.rpc('set_member_avatar', {
        p_member_id: input.memberId,
        // Kein Pfad heisst «Bild wegnehmen» (0086) – der Parameter darf
        // deshalb fehlen, statt als `null` hineingelogen zu werden.
        p_url: input.url ?? undefined,
      });
      if (error) {
        // Die Datei liegt schon, die Spalte kennt sie nicht: aufräumen, statt
        // eine verwaiste Datei zurückzulassen.
        await removeFile(input.url, PHOTO_BUCKET);
        throw new Error(error.message);
      }
      if (input.previousUrl && input.previousUrl !== input.url) {
        await removeFile(input.previousUrl, PHOTO_BUCKET);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['members', activeClub?.id] });
      await queryClient.invalidateQueries({ queryKey: ['memberships'] });
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      await queryClient.invalidateQueries({ queryKey: ['contribution-overview'] });
    },
  });
}

/** Das Teambild setzen oder wegnehmen (`set_team_photo`, 0083). */
export function useSetTeamPhoto() {
  const queryClient = useQueryClient();
  const { activeClub } = useClub();

  return useMutation({
    mutationFn: async (input: {
      teamId: string;
      url: string | null;
      previousUrl?: string | null;
    }) => {
      const { error } = await supabase.rpc('set_team_photo', {
        p_team_id: input.teamId,
        p_url: input.url ?? undefined,
      });
      if (error) {
        await removeFile(input.url, PHOTO_BUCKET);
        throw new Error(error.message);
      }
      if (input.previousUrl && input.previousUrl !== input.url) {
        await removeFile(input.previousUrl, PHOTO_BUCKET);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams', activeClub?.id] });
    },
  });
}

/** Die Datei eines ersetzten Vereinslogos wegräumen (die Spalte schreibt UC-034). */
export function useRemoveMediaFile() {
  return useMutation({
    mutationFn: (url: string | null | undefined) => removeFile(url, LOGO_BUCKET),
  });
}
