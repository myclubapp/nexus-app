#!/bin/sh
# Xcode Cloud, Schritt "Post-Clone".
#
# Das Web-Bundle (app/ios/App/App/public/) ist nicht eingecheckt – es entsteht
# hier. Der Schritt läuft vor "Resolve package dependencies", deshalb erzeugt
# `cap sync ios` an dieser Stelle auch CapApp-SPM/Package.swift neu, bevor SPM
# darauf zugreift.
#
# CapApp-SPM/Package.swift zeigt mit relativen Pfaden nach
# app/node_modules/@capacitor/*. Bricht dieses Skript ab, fehlt node_modules,
# und der nächste Schritt meldet zehn nicht auflösbare Pakete. Diese Meldung
# ist die Folge, nicht die Ursache – der Grund steht immer hier im Protokoll.
set -e

step() {
  echo ""
  echo "── $1"
}

# Die Vite-Variablen kommen aus den Umgebungsvariablen des Workflows, weil
# app/.env.local nicht im Repository liegt.
#
# Zwingend sind nur die beiden Supabase-Werte: Ohne sie baut Vite eine App
# ohne Backend, und das soll laut scheitern statt still durchzugehen. Die
# übrigen Variablen haben in src/lib/env.ts einen Rückfallwert – sie hier zu
# verlangen, hätte den Build an einem Wert scheitern lassen, der bestimmungs-
# gemäss leer bleibt (VITE_WEB_REDIRECT_URL heisst leer: window.location.origin).
step "Umgebungsvariablen prüfen"
missing=""
for var in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    missing="$missing $var"
  fi
done
if [ -n "$missing" ]; then
  echo "Fehler: im Xcode-Cloud-Workflow fehlen die Umgebungsvariablen:$missing" >&2
  echo "Setzen unter: Xcode Cloud → Workflow bearbeiten → Environment → Environment Variables." >&2
  exit 1
fi
for var in VITE_APP_SCHEME VITE_WEB_REDIRECT_URL VITE_VAPID_PUBLIC_KEY; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "Hinweis: $var ist nicht gesetzt – src/lib/env.ts nimmt den Rückfallwert."
  fi
done

# Node ist im Xcode-Cloud-Image nicht vorinstalliert. Und wenn doch, dann
# womöglich zu alt: Vite 8 verlangt 20.19+ oder 22.12+. Eine zu alte Version
# scheitert erst später und unverständlich, deshalb die Prüfung statt eines
# blossen `command -v node`.
step "Node bereitstellen"
node_is_usable() {
  command -v node > /dev/null 2>&1 || return 1
  node -e 'const [a,b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 12) || (a === 20 && b >= 19) ? 0 : 1)'
}
if node_is_usable; then
  echo "Node $(node -v) ist vorhanden."
else
  echo "Node fehlt oder ist zu alt – Installation über Homebrew."
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  brew install node
  # Auf Apple Silicon liegt das Ergebnis in /opt/homebrew/bin; steht der Pfad
  # nicht schon im PATH, findet die Shell das eben installierte Node nicht.
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  hash -r
  node_is_usable || {
    echo "Fehler: auch nach der Installation ist Node zu alt: $(node -v 2>&1)" >&2
    exit 1
  }
fi
echo "node $(node -v), npm $(npm -v)"

cd "$CI_PRIMARY_REPOSITORY_PATH/app"

step "npm ci"
npm ci --no-audit --no-fund

step "vite build"
npm run build

# Nicht über npx: npx würde ein fehlendes Paket still aus der Registry nach-
# laden. Der Pfad zeigt, dass die CLI aus dem eben installierten Baum kommt.
step "cap sync ios"
./node_modules/.bin/cap sync ios

step "Fertig – das Web-Bundle liegt in ios/App/App/public."
