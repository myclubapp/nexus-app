/**
 * Die Fehlermeldung aus einer Edge Function lesen.
 *
 * supabase-js macht aus jeder Antwort ausserhalb von 2xx einen
 * `FunctionsHttpError` und lässt `data` leer. Ohne dieses Auspacken sähe der
 * Vorstand «non-2xx status code» statt der Meldung, die der Dienst geschickt
 * hat – und die sagt, was zu korrigieren ist.
 */
export async function functionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: Response }).context;
  if (context && typeof context.json === 'function') {
    try {
      const body = await context.json();
      if (typeof body?.error === 'string') return body.error;
    } catch {
      // Antwort ohne JSON-Rumpf: Es bleibt die Meldung von supabase-js.
    }
  }
  return error instanceof Error ? error.message : String(error);
}
