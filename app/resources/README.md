# Quellbilder für Symbole und Startbild

Aus diesen Dateien entstehen alle App-Symbole und Startbilder – für iOS,
Android und die installierte Web-Fassung. Erzeugt werden sie mit:

```bash
npm run assets:generate
```

Dahinter stecken zwei Schritte: `capacitor-assets generate --ios --android`
für die nativen Projekte und `scripts/post-assets.mjs` für das, was das
Werkzeug nicht kann (dunkles App-Symbol für iOS, Symbole in `public/`).
Beides läuft mit dem einen Befehl; von Hand nachziehen muss man nichts.

| Datei                          | Wofür                                                        |
| ------------------------------ | ------------------------------------------------------------ |
| `icon.png`                     | das myclub-«M» auf weissem Grund, 1024² – Grundlage von allem |
| `icon-dark.png`                | dasselbe «M» auf schwarzem Grund, für iOS im Dunkelmodus      |
| `splash.png`                   | Startbild: das «M» auf einem Farbverlauf, 2732²               |
| `android/icon-foreground.png`  | Vordergrund des adaptiven Android-Symbols                     |
| `android/icon-background.png`  | dessen Hintergrund                                            |

Alle stammen aus der Ionic-Angular-App (`github.com/myclubapp/app`,
`resources/`). Ein Vektor-Original gibt es nicht – auch die `.svg`-Dateien
des Altbestands tragen nur ein eingebettetes PNG. Wer das Logo neu zeichnet,
ersetzt hier die Quellbilder und lässt den Befehl laufen.

## Was zu wissen ist

**Das Startbild hat keine dunkle Fassung.** Im Altbestand waren `splash.png`
und `splash-dark.png` byte-identisch – es gab nie ein eigenes dunkles Motiv.
Ohne `splash-dark.png` hier nimmt `capacitor-assets` für beide Erscheinungen
dasselbe Bild. Soll der Dunkelmodus einmal ein eigenes Motiv bekommen, legt
man es als `splash-dark.png` daneben.

**Das Startbild wiegt viel.** Ein 2732²-PNG mit Verlauf sind 6,9 MB, und der
Asset-Katalog von iOS hält sechs Fassungen davon – rund 40 MB im Baum. Das
ist der Stand, den `capacitor-assets` anlegt. Wer das drücken will, erzeugt
das Startbild als JPEG; der Katalog nimmt das Format an.

**Die Symbole der Web-Fassung heissen fest.** `pwa-64x64.png`,
`pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`,
`apple-touch-icon-180x180.png` und `favicon-96x96.png` stehen so im Manifest
in `vite.config.ts` und in `index.html`. Wer einen Namen ändert, ändert ihn
an drei Stellen: hier, im Skript und in der Konfiguration.
