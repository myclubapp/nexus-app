#!/bin/sh
# Xcode Cloud, Schritt "Post-Clone".
#
# Das Web-Bundle (app/ios/App/App/public/) ist nicht eingecheckt – es entsteht
# hier. Der Schritt läuft vor "Resolve package dependencies", deshalb erzeugt
# `cap sync ios` an dieser Stelle auch CapApp-SPM/Package.swift neu, bevor SPM
# darauf zugreift.
set -e

# Die Vite-Variablen kommen aus den Umgebungsvariablen des Workflows, weil
# app/.env.local nicht im Repository liegt. Fehlen sie, baut Vite eine App
# ohne Backend – das soll hier laut scheitern statt still durchzugehen.
for var in VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY VITE_APP_SCHEME VITE_WEB_REDIRECT_URL; do
  eval "value=\$$var"
  if [ -z "$value" ]; then
    echo "Fehler: Umgebungsvariable $var ist im Xcode-Cloud-Workflow nicht gesetzt." >&2
    exit 1
  fi
done

# Node ist im Xcode-Cloud-Image nicht vorinstalliert.
if ! command -v node > /dev/null 2>&1; then
  export HOMEBREW_NO_AUTO_UPDATE=1
  export HOMEBREW_NO_INSTALL_CLEANUP=1
  brew install node
fi

cd "$CI_PRIMARY_REPOSITORY_PATH/app"

npm ci
npm run build
npx cap sync ios
