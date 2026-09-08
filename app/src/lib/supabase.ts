import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { env, isConfigured } from './env';
import type { Database } from './database.types';

/**
 * On device the session must survive an app restart. Capacitor Preferences is
 * the native-backed store recommended by the architecture document; in the
 * browser we fall back to localStorage, which supabase-js uses by default.
 */
const capacitorStorage = {
  getItem: async (key: string) => (await Preferences.get({ key })).value,
  setItem: async (key: string, value: string) => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string) => {
    await Preferences.remove({ key });
  },
};

/**
 * createClient() wirft, wenn URL oder Key leer sind. Ohne diesen Platzhalter
 * bliebe die App beim ersten Start ohne .env.local weiss, statt den Hinweis
 * aus isConfigured anzuzeigen.
 */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  env.supabaseUrl || PLACEHOLDER_URL,
  env.supabaseAnonKey || PLACEHOLDER_KEY,
  {
    auth: {
      storage: Capacitor.isNativePlatform() ? capacitorStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // Magic links arrive as a PKCE code that we exchange ourselves, both in
      // the browser and via the Capacitor appUrlOpen deep link listener.
      detectSessionInUrl: !Capacitor.isNativePlatform(),
      flowType: 'pkce',
    },
  },
);

export { isConfigured };

/** Redirect target for magic links – deep link on device, origin on web. */
export function authRedirectUrl(): string {
  return Capacitor.isNativePlatform()
    ? `${env.appScheme}://auth/callback`
    : `${env.webRedirectUrl}/auth/callback`;
}
