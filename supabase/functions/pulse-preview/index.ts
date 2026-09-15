/**
 * Die Vorschau des Vereins-Pulses (UC-050, FR-189).
 *
 * **Warum eine eigene Function.** `send-mail` hält den
 * `service_role`-Schlüssel und hat genau ein Tor, ganz vorne: Wer kein
 * Dienst-Token vorweist, kommt nicht hinein. Ein zweiter Vertrauensgrad
 * daneben hiesse, dass dieses Tor je Betriebsart entscheiden muss – und eine
 * falsch einsortierte frühe Rückgabe wäre ein Mitglied, das den Versandlauf
 * anstösst. Diese Function hat einen einzigen Vertrauensgrad: das Token der
 * Aufruferin. Gerendert wird trotzdem dasselbe Blatt, es steht in
 * `_shared/pulse_sheet.ts`.
 *
 * **Die Rollenprüfung steht nicht hier.** Sie steht in der Policy aus `0044`:
 * Einen Entwurf sieht nur der Vorstand, einen versendeten Puls jedes Mitglied
 * des Vereins. `pulse_payload()` ist `security invoker` und liest unter den
 * Rechten der Aufruferin – kommt nichts zurück, gibt es keine Vorschau. Eine
 * zweite Prüfung hier wäre eine zweite Wahrheit.
 *
 * **Sie sendet nichts** (BR-249): kein Versand, kein `sent_at`, keine
 * Verbindungszählung, und der Entwurf wird nicht angefasst. `keep` ist die
 * Auswahl des Vorstands, damit die Vorschau zeigt, was die Freigabe
 * verschicken würde.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { LOCALES, type Locale, type MailBrand } from '../_shared/mail.ts';
import { renderPulseSheet } from '../_shared/pulse_sheet.ts';
import { appLink, channelFootnote, toSheetPayload } from '../send-mail/template.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Nur POST' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Nicht angemeldet' }, 401);

  let body: { pulseId?: string; locale?: string; keep?: string[] };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage' }, 400);
  }

  const pulseId = body.pulseId?.trim();
  if (!pulseId) return json({ error: 'pulseId ist nötig' }, 400);
  const locale: Locale = LOCALES.includes(body.locale as Locale) ? (body.locale as Locale) : 'de';

  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    },
  );

  const { data: user, error: userError } = await caller.auth.getUser();
  if (userError || !user?.user) return json({ error: 'Nicht angemeldet' }, 401);

  // Die Nutzlast – und mit ihr die Entscheidung, ob es eine Vorschau gibt.
  const { data: raw, error } = await caller.rpc('pulse_payload', {
    p_pulse_id: pulseId,
    p_locale: locale,
    p_keep: body.keep ?? null,
  });
  if (error) return json({ error: error.message }, 400);

  const payload = toSheetPayload(raw);
  if (!payload) {
    // Kein Recht, kein Puls oder nichts mehr übrig – für die Aufruferin
    // dasselbe. Die Oberfläche sagt «nichts zu zeigen», nicht «verboten»:
    // Welche Entwürfe es gibt, ist selbst eine Auskunft.
    return json({ error: 'Zu diesem Puls gibt es keine Vorschau' }, 404);
  }

  // Der Auftritt des Vereins und der eigene Name – damit die Vorschau aussieht
  // wie das, was ankommt, und nicht wie ein Muster.
  const { data: pulse, error: pulseError } = await caller
    .from('club_pulses')
    .select('club_id')
    .eq('id', pulseId)
    .maybeSingle();
  // Kein Abbruch: Die Nutzlast steht schon, und ein Blatt ohne Kopfband ist
  // besser als keine Vorschau. Aber auch nicht stillschweigend – sonst sieht
  // niemand, wenn ein Rechte- oder Pfadfehler dahintersteckt.
  if (pulseError) console.warn('Vorschau ohne Verein:', pulseError.message);

  let brand: MailBrand = { clubName: null, color: null, logoUrl: null };
  let displayName: string | null = null;

  if (pulse?.club_id) {
    const { data: club, error: clubError } = await caller
      .from('clubs')
      .select('name, settings')
      .eq('id', pulse.club_id)
      .maybeSingle();
    if (clubError) console.warn('Vorschau ohne Auftritt:', clubError.message);
    const settings = (club?.settings ?? {}) as Record<string, unknown>;
    const theme = (settings.theme ?? {}) as Record<string, unknown>;
    brand = {
      clubName: club?.name ?? null,
      color: (theme.primary as string) ?? null,
      logoUrl: (settings.logoUrl as string) ?? null,
    };

    const { data: member, error: memberError } = await caller
      .from('club_members')
      .select('display_name')
      .eq('club_id', pulse.club_id)
      .eq('user_id', user.user.id)
      .maybeSingle();
    if (memberError) console.warn('Vorschau ohne Anrede:', memberError.message);
    displayName = member?.display_name ?? null;
  }

  const appUrl = Deno.env.get('APP_URL') ?? null;
  const footnote = channelFootnote(locale);
  const settingsUrl = appLink(appUrl, '/tabs/profile/notifications');

  const sheet = renderPulseSheet({
    brand,
    locale,
    displayName,
    payload,
    appUrl,
    footnote: footnote.text,
    footnoteLink: settingsUrl ? { label: footnote.settingsLabel, url: settingsUrl } : null,
  });

  // Nur, was die Ansicht liest. Die Textfassung des Blatts und die
  // Kopfbandfarbe entstehen mit, werden aber nirgends gebraucht – ein Feld,
  // das niemand liest, ist ein Versprechen, das niemand hält.
  return json({ subject: sheet.subject, html: sheet.html });
});
