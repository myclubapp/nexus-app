import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { env, isConfigured } from './env';
import type { Database } from './database.types';

/**
 * Auf dem Gerät muss die Sitzung einen Neustart überstehen. Capacitor
 * Preferences ist der native Speicher, den die Architektur dafür vorsieht;
 * im Browser bleibt es bei localStorage, das supabase-js von sich aus nimmt.
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
      // Ein Anmeldelink trägt einen PKCE-Code, den die App selbst tauscht –
      // im Browser wie über den appUrlOpen-Listener von Capacitor.
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
