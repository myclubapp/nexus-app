/**
 * Der Zugang zum Vereins-SMTP – einmal für alle Functions, die Mail
 * verschicken (`send-mail`, `invoice-run`, `auth-mail`).
 *
 * Vorher stand dieselbe Handvoll Zeilen in jeder Function; mit der
 * Anmeldemail wäre es die dritte Abschrift geworden. Der Hinweis auf Port 465
 * ist teuer erkauft: STARTTLS auf 587 scheiterte in der Edge-Laufzeit.
 */
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export interface SmtpConfig {
  hostname: string;
  port: number;
  username: string;
  password: string;
  from: string;
  fromName: string;
}

/**
 * Liest den Zugang aus den Secrets; nennt die **erste fehlende** Variable.
 *
 * Gibt eine Zeichenkette zurück statt zu werfen: Der Aufrufer antwortet damit
 * mit 503 und einer Zeile, die sagt, was fehlt. Ein Lauf, der still nichts
 * tut, wäre nach zwei Wochen unbemerkt.
 */
export function readSmtpConfig(): SmtpConfig | string {
  const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'MAIL_FROM'] as const;
  for (const name of required) {
    if (!Deno.env.get(name)) return `Secret ${name} fehlt`;
  }
  const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
  if (!Number.isInteger(port) || port <= 0) return 'Secret SMTP_PORT ist keine Portnummer';
  return {
    hostname: Deno.env.get('SMTP_HOST')!,
    port,
    username: Deno.env.get('SMTP_USER')!,
    password: Deno.env.get('SMTP_PASSWORD')!,
    from: Deno.env.get('MAIL_FROM')!,
    fromName: Deno.env.get('MAIL_FROM_NAME') ?? 'myclub',
  };
}

export function openClient(config: SmtpConfig): SMTPClient {
  return new SMTPClient({
    connection: {
      hostname: config.hostname,
      port: config.port,
      // 465 spricht TLS von Anfang an; 587 beginnt im Klartext und wechselt
      // per STARTTLS – denomailer tut das von selbst, wenn `tls` falsch ist.
      tls: config.port === 465,
      auth: { username: config.username, password: config.password },
    },
  });
}

/**
 * Der Absender, wie er im Postfach steht.
 *
 * Der **Name** trägt den Verein, die Adresse bleibt die des Dienstes: Ein
 * fremder Absender aus einer Domain, die nicht unsere ist, fiele durch SPF
 * und DKIM und landete im Spam. «Kadetten (myclub)» sagt beides.
 */
export function fromHeader(config: SmtpConfig, clubName: string | null): string {
  const name = clubName ? `${clubName} (${config.fromName})` : config.fromName;
  // Anführungszeichen und Zeilenumbrüche haben in einem Kopffeld nichts zu
  // suchen – ein Vereinsname kommt aus einem Eingabefeld.
  const clean = name.replace(/["\\\r\n]/g, ' ').trim();
  return `"${clean}" <${config.from}>`;
}

/**
 * denomailer liest die Antworten des Servers in einer eigenen Schleife. Weist
 * der Server ein Kommando ab, wirft die Schleife ausserhalb jedes `await` –
 * eine unbehandelte Ablehnung, die den ganzen Isolate beendet, und der
 * Aufrufer sieht nur ein leeres 503. Hier wird sie abgefangen und geloggt;
 * der Fehler erreicht den Aufrufer über das gescheiterte `send()`.
 */
export function catchSmtpRejections(): void {
  globalThis.addEventListener('unhandledrejection', (event) => {
    console.error('SMTP: unbehandelte Ablehnung', event.reason);
    event.preventDefault();
  });
}
