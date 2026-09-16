import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Der Apple-Weg (UC-052, FR-199).
 *
 * Eigene Datei und nicht im Hook: Alles, was hier steht, spricht mit dem
 * Betriebssystem und lässt sich in jsdom nicht ausführen. So bleibt genau eine
 * Stelle zu ersetzen, wenn ein Test den nativen Weg braucht – und der Hook
 * bleibt lesbar.
 *
 * **Die Anmeldung ist kein Aufruf, sondern ein Gespräch.** `register()` gibt
 * nichts zurück; das Token kommt Augenblicke später als Ereignis. Zwischen
 * beidem liegt ein Netzwerkweg zu Apple, der auch scheitern kann – deshalb die
 * Frist unten. Ohne sie bliebe die Schaltfläche in der Ansicht für immer im
 * Ladezustand, wenn das Gerät gerade offline ist.
 */

/** Wie lange auf das Token von Apple gewartet wird. */
const REGISTRATION_TIMEOUT_MS = 15_000;

export type NativeRegistration =
  | { status: 'registered'; token: string }
  | { status: 'denied' };

export async function registerNativePush(): Promise<NativeRegistration> {
  const permission = await PushNotifications.requestPermissions();
  // A2: «Nicht erlauben» ist eine Antwort, kein Fehler. Die Inbox bleibt
  // vollständig (BR-117).
  if (permission.receive !== 'granted') return { status: 'denied' };

  return await new Promise<NativeRegistration>((resolve, reject) => {
    let settled = false;
    const handles: { remove: () => Promise<void> }[] = [];

    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void Promise.all(handles.map((handle) => handle.remove()));
      run();
    };

    const timer = setTimeout(() => {
      finish(() =>
        reject(new Error('Apple hat kein Gerätetoken geschickt – später erneut versuchen')),
      );
    }, REGISTRATION_TIMEOUT_MS);

    void (async () => {
      handles.push(
        await PushNotifications.addListener('registration', (token) => {
          finish(() => resolve({ status: 'registered', token: token.value }));
        }),
      );
      handles.push(
        await PushNotifications.addListener('registrationError', (error) => {
          finish(() => reject(new Error(String(error.error))));
        }),
      );

      // Erst anmelden, wenn beide Zuhörer stehen: Das Token kann schneller
      // zurückkommen, als die zweite `addListener`-Zusage einlöst.
      await PushNotifications.register();
    })().catch((cause) => finish(() => reject(cause)));
  });
}

/**
 * Das Antippen einer Meldung führt dorthin, wovon sie handelt.
 *
 * Die Adresse steht als `link` neben `aps` (siehe `_shared/apns.ts`). Ohne
 * diesen Zuhörer öffnete jede angetippte Meldung nur das Dashboard – und die
 * Meldung «Deine Rechnung ist fällig» liesse die Person suchen.
 */
export async function onNativePushAction(
  handler: (link: string) => void,
): Promise<() => void> {
  const handle = await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      const link = action.notification.data?.link;
      if (typeof link === 'string' && link.startsWith('/')) handler(link);
    },
  );

  return () => {
    void handle.remove();
  };
}
