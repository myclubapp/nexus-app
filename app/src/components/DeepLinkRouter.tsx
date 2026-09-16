import { useEffect, useRef } from 'react';
import { useIonRouter } from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { deepLinkTarget } from '../lib/deepLink';
import { onNativePushAction } from '../lib/nativePush';

/**
 * Führt die App an den Ort, den ein Link von aussen nennt.
 *
 * Das Betriebssystem öffnet die App, wenn die Adresse zu den beanspruchten
 * Pfaden gehört (Universal Links auf iOS, App Links auf Android) – mehr tut es
 * nicht. Ohne diesen Zuhörer startet die App auf der Seite, auf der sie zuletzt
 * stand, und der Link aus der E-Mail fühlt sich an wie ein blosses Öffnen der
 * App.
 *
 * Muss im Router stehen, weil er `useIonRouter` braucht. `useAuth` sitzt
 * darüber und hat einen eigenen `appUrlOpen`-Zuhörer für den Anmeldelink;
 * beide dürfen nebeneinander laufen, weil `deepLinkTarget` den Anmeldelink
 * ausdrücklich nicht beansprucht.
 */
export function DeepLinkRouter() {
  const router = useIonRouter();
  // Der Router-Wert wechselt mit jeder Navigation; der Zuhörer soll trotzdem
  // nur einmal angemeldet werden und stets den aktuellen Stand lesen.
  const latest = useRef(router);
  useEffect(() => {
    latest.current = router;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // `'root'` und nicht `'forward'`: Der Link kommt von aussen, es gibt keinen
    // Weg zurück, den eine Zurück-Pfeil-Animation andeuten dürfte.
    const go = (url: string | null | undefined) => {
      const target = url ? deepLinkTarget(url) : null;
      if (target) latest.current.push(target, 'root');
    };

    // Startet der Link die App erst, kann `appUrlOpen` schon gefeuert haben,
    // bevor dieser Zuhörer steht. `getLaunchUrl()` holt genau diesen Fall nach.
    void CapacitorApp.getLaunchUrl().then((launch) => go(launch?.url));

    const handle = CapacitorApp.addListener('appUrlOpen', ({ url }) => go(url));
    return () => {
      void handle.then((listener) => listener.remove());
    };
  }, []);

  /**
   * Dasselbe für die angetippte Push-Meldung (UC-052).
   *
   * Eigener Effekt und nicht im obigen: Eine Push-Meldung trägt keine
   * vollständige Adresse, sondern den fertigen Pfad aus `notifications.link` –
   * sie muss `deepLinkTarget` nicht passieren, und die beanspruchten Präfixe
   * gelten für sie nicht. Nur iOS: Auf Android gibt es den Kanal nicht
   * (`lib/push.ts`), und ein Zuhörer auf ein Plugin ohne Dienst wäre eine
   * Zusage ohne Deckung.
   */
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'ios') return;

    let dispose: (() => void) | null = null;
    let cancelled = false;

    void onNativePushAction((link) => latest.current.push(link, 'root')).then((off) => {
      if (cancelled) off();
      else dispose = off;
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);

  return null;
}
