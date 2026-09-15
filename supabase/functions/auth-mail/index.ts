/**
 * Die Anmeldemails des Vereins (UC-048, FR-182).
 *
 * Supabase Auth verschickt Anmeldelink, Bestätigung und Passwortlink sonst
 * selbst – aus einer festen Vorlage, in **einer** Sprache und ohne jeden
 * Vereinsbezug. Das war die erste Mail, die ein neues Mitglied bekam, und die
 * einzige, die nicht nach dem Verein aussah.
 *
 * Mit dem Hook «Send Email» (`[auth.hook.send_email]` in `config.toml`) gibt
 * GoTrue den Versand hier ab: Es schickt den Anlass, die Person und den Token,
 * diese Function baut daraus die Mail im Vereins-Look und verschickt sie über
 * denselben SMTP wie alle anderen (`_shared/smtp.ts`).
 *
 * **Diese Function steht auf dem Weg zur Anmeldung.** Antwortet sie mit einem
 * Fehler, bekommt niemand mehr einen Link. Deshalb:
 *   * **Der Versand läuft hinter der Antwort.** Supabase gibt einem HTTP-Hook
 *     ein Budget von fünf Sekunden für den ganzen Aufruf, Wiederholungen
 *     eingerechnet. Ein SMTP-Gespräch – Verbindung, TLS, Anmeldung, DATA –
 *     passt da nicht verlässlich hinein, und ein Zeitüberlauf wäre der
 *     schlechteste Ausgang: Die Person sähe einen Fehler **und** bekäme die
 *     Mail. Geprüft wird deshalb vorne, was schnell geht (Signatur, Rumpf,
 *     Secrets); der Rest läuft in `EdgeRuntime.waitUntil()` weiter, nachdem
 *     die Antwort schon draussen ist.
 *   * Kein Fehler bricht den Versand, der sich vermeiden lässt: Sprache,
 *     Verein, Logo – jedes davon fällt einzeln auf einen Standard zurück.
 *   * Ein gescheitertes SMTP-Gespräch steht danach nur noch im Log der
 *     Function. Das ist der Preis für den Punkt oben – und der Grund, warum
 *     die Zeile dort ausdrücklich `console.error` ist und nicht verschluckt
 *     wird.
 *   * Der Hook lässt sich in `config.toml` abschalten; GoTrue verschickt dann
 *     wieder selbst.
 *
 * **Die Signatur wird geprüft.** Der Endpunkt läuft ohne `verify_jwt` – er
 * muss, denn GoTrue schickt kein Token. Statt dessen signiert es den Rumpf
 * nach «Standard Webhooks» mit dem Secret `SEND_EMAIL_HOOK_SECRET`. Ohne
 * gültige Signatur antwortet die Function mit 401: Sonst könnte jeder im
 * Internet Mails im Namen des Vereins auslösen.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { authAction, authMail } from './template.ts';
import { confirmUrl, verifySignature } from './hook.ts';
import { catchSmtpRejections, fromHeader, openClient, readSmtpConfig } from '../_shared/smtp.ts';
import { LOCALES, type Locale, type MailBrand } from '../_shared/mail.ts';

catchSmtpRejections();

interface HookPayload {
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Die Form, in der GoTrue einen Fehler erwartet. */
function hookError(message: string, status: number): Response {
  return json({ error: { http_code: status, message } }, status);
}

// --- Sprache und Verein -----------------------------------------------------

function localeOf(value: unknown): Locale | null {
  return typeof value === 'string' && LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return hookError('Nur POST', 405);

  const body = await request.text();

  const secret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  if (!secret) return hookError('Secret SEND_EMAIL_HOOK_SECRET fehlt', 503);

  const problem = await verifySignature(secret, request.headers, body);
  if (problem) {
    console.error('auth-mail: Signatur abgewiesen –', problem);
    return hookError('Signatur ungültig', 401);
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(body) as HookPayload;
  } catch {
    return hookError('Rumpf ist kein JSON', 400);
  }

  const to = payload.user?.email;
  const tokenHash = payload.email_data?.token_hash;
  if (!to || !tokenHash) return hookError('Rumpf ohne Adresse oder Token', 400);

  const config = readSmtpConfig();
  if (typeof config === 'string') return hookError(config, 503);

  // Ohne die Projektadresse gäbe es keinen Bestätigungslink. In der
  // Edge-Laufzeit steht sie immer – fehlt sie doch, ist eine benannte Antwort
  // besser als eine Ausnahme aus `new URL()`.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return hookError('SUPABASE_URL fehlt', 503);

  const action = authAction(payload.email_data?.email_action_type);
  const metadata = payload.user?.user_metadata ?? {};
  const link = confirmUrl(
    supabaseUrl,
    tokenHash,
    action,
    payload.email_data?.redirect_to ?? null,
  );

  // Alles Weitere läuft **hinter** der Antwort (siehe Kopf): Verein holen,
  // Blatt bauen, über SMTP verschicken.
  const deliver = async () => {
    // Sprache und Verein sind Beiwerk: Scheitert die Abfrage, geht die Mail
    // trotzdem hinaus – auf Deutsch und in der Grundfarbe.
    let locale: Locale = localeOf(metadata.locale) ?? 'de';
    let brand: MailBrand = { clubName: null, color: null, logoUrl: null };

    try {
      const supabase = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data, error } = await supabase.rpc('mail_brand', {
        p_user_id: payload.user?.id ?? null,
        // Der Einladungscode kommt aus den Anmeldedaten der App und ist damit
        // Eingabe: `mail_brand()` prüft ihn gegen `invites`, statt ihm zu glauben.
        p_invite_code: typeof metadata.invite_code === 'string' ? metadata.invite_code : null,
      });
      if (error) throw new Error(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        locale = localeOf(row.locale) ?? locale;
        brand = {
          clubName: row.club_name ?? null,
          color: row.club_color ?? null,
          logoUrl: row.club_logo ?? null,
        };
      }
    } catch (cause) {
      console.error('auth-mail: Verein nicht ermittelt, Mail geht ohne', cause);
    }

    const mail = authMail({
      action,
      locale,
      brand,
      confirmUrl: link,
      token: payload.email_data?.token ?? null,
      year: new Date().getFullYear(),
    });

    const client = openClient(config);
    try {
      await client.send({
        from: fromHeader(config, brand.clubName),
        to,
        subject: mail.subject,
        content: mail.text,
        html: mail.html,
      });
      console.log(`auth-mail: ${action} an ${to} verschickt`);
    } catch (cause) {
      // Der einzige Ort, an dem dieser Fehler auftaucht. Ohne die Zeile wäre
      // ein SMTP-Ausfall eine Anmeldung, die stumm nie ankommt.
      console.error('auth-mail: Versand gescheitert', action, to,
        cause instanceof Error ? cause.message : String(cause));
    } finally {
      try { await client.close(); } catch { /* Verbindung schon zu */ }
    }
  };

  const runtime = (globalThis as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(deliver());
  } else {
    // Ohne die Edge-Laufzeit (lokal, `deno run`) gibt es kein `waitUntil` –
    // dann lieber warten als die Aufgabe mit dem Isolate verlieren.
    await deliver();
  }

  return json({});
});
