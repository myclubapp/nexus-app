import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.myclub.nexus.app',
  appName: 'myclub nexus',
  webDir: 'dist',
  ios: {
    scheme: 'App',
  },
  android: {
    adjustMarginsForEdgeToEdge: 'auto',
  },
  plugins: {
    // iOS registers with APNs directly; Android uses UnifiedPush/ntfy, which
    // is wired up outside this plugin (Architektur §3.3).
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 800,
      // Die Grundfarbe aus theme/variables.css, kein Farbsprung beim Start.
      backgroundColor: '#339bde',
      showSpinner: false,
    },
    Keyboard: {
      // `ionic`: nur `ion-app` wird verkleinert – die Einstellung, die
      // Capacitor für Ionic-Apps vorsieht.
      resize: 'ionic',
    },
  },
};

export default config;
