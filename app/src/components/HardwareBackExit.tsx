import { useEffect, useRef } from 'react';
import { useIonRouter } from '@ionic/react';
import type { BackButtonEvent } from '@ionic/core';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * Die Zurück-Taste auf Android an der Wurzel der App.
 *
 * Ionic bedient die Taste selbst: erst Overlays, dann das Menü, dann die
 * Navigation. Steht die App aber schon auf ihrer ersten Seite, tut ihr
 * eigener Handler nichts mehr – die Taste ist tot, die App lässt sich damit
 * nicht verlassen. Die Ionic-Doku sieht dafür genau diesen Handler vor:
 * Priorität −1, also nach allen eigenen, und `exitApp()`, sobald es nichts
 * mehr gibt, wohin man zurückkönnte.
 *
 * Nur auf dem Gerät: Im Browser gibt es keine Hardware-Taste, und `exitApp`
 * gäbe es dort auch nicht.
 */
export function HardwareBackExit() {
  const router = useIonRouter();
  // Der Router-Wert wechselt mit jeder Navigation; der Zuhörer soll trotzdem
  // nur einmal angemeldet werden und stets den aktuellen Stand lesen.
  const latest = useRef(router);
  useEffect(() => {
    latest.current = router;
  });

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const onBackButton = (event: Event) => {
      (event as BackButtonEvent).detail.register(-1, () => {
        if (!latest.current.canGoBack()) void CapacitorApp.exitApp();
      });
    };
    document.addEventListener('ionBackButton', onBackButton);
    return () => document.removeEventListener('ionBackButton', onBackButton);
  }, []);

  return null;
}
