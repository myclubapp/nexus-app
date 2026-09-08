#!/usr/bin/env node
/**
 * Prüft, dass alle Sprachdateien denselben Schlüsselbaum haben.
 * Konvention aus der bestehenden myclub-App: Neue UI-Texte werden immer in
 * allen vier Sprachen ergänzt – sonst fällt eine Sprache still auf Deutsch
 * zurück und niemand merkt es.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const REFERENCE = 'de';

function flatten(value, prefix = '') {
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return entry && typeof entry === 'object' && !Array.isArray(entry)
      ? flatten(entry, path)
      : [path];
  });
}

const files = readdirSync(localesDir).filter((name) => name.endsWith('.json'));
const keysByLanguage = new Map();

for (const file of files) {
  const language = file.replace(/\.json$/, '');
  const content = JSON.parse(readFileSync(join(localesDir, file), 'utf8'));
  keysByLanguage.set(language, new Set(flatten(content)));
}

const reference = keysByLanguage.get(REFERENCE);
if (!reference) {
  console.error(`Referenzsprache ${REFERENCE}.json fehlt.`);
  process.exit(1);
}

let failed = false;
for (const [language, keys] of keysByLanguage) {
  if (language === REFERENCE) continue;

  const missing = [...reference].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !reference.has(key));

  if (missing.length > 0) {
    failed = true;
    console.error(`\n${language}.json – fehlende Schlüssel (${missing.length}):`);
    for (const key of missing) console.error(`  - ${key}`);
  }
  if (extra.length > 0) {
    failed = true;
    console.error(`\n${language}.json – unbekannte Schlüssel (${extra.length}):`);
    for (const key of extra) console.error(`  + ${key}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log(`i18n ok – ${keysByLanguage.size} Sprachen, ${reference.size} Schlüssel.`);
