/**
 * Typisierter Zugriff auf die Vite-Umgebung. Fehlt eine nötige Variable,
 * scheitert der Start laut – statt später mit unklaren Laufzeitfehlern.
 */
type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Deep-Link-Schema für den Rücksprung des Anmeldelinks auf iOS und Android. */
  appScheme: string;
  /** Web-Adresse für den Rücksprung des Anmeldelinks im Browser und in der PWA. */
  webRedirectUrl: string;
  /**
   * Öffentlicher VAPID-Schlüssel für Web Push (UC-028, A1).
   *
   * Leer heisst: Das Gerät lässt sich nicht anmelden, und die Ansicht sagt das.
   * Der **private** Teil gehört dem Versanddienst und kommt in dieser App
   * nirgends vor.
   */
  vapidPublicKey: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    if (import.meta.env.DEV) {
      console.warn(
        `[env] ${name} is not set. Copy .env.example to .env.local and fill it in.`,
      );
    }
    return '';
  }
  return value;
}

export const env: AppEnv = {
  supabaseUrl: required('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: required(
    'VITE_SUPABASE_ANON_KEY',
    import.meta.env.VITE_SUPABASE_ANON_KEY,
  ),
  appScheme: import.meta.env.VITE_APP_SCHEME ?? 'ch.myclub.nexus',
  webRedirectUrl:
    import.meta.env.VITE_WEB_REDIRECT_URL ??
    (typeof window !== 'undefined' ? window.location.origin : ''),
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '',
};

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey);
