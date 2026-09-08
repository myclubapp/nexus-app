import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.myclub.nexus',
  appName: 'myclub',
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
      backgroundColor: '#1d4ed8',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body',
    },
  },
};

export default config;
