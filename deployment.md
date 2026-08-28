# MUSIKMASCHINE — Stand und Deployment

**Live:** https://soundmaschine-app.netlify.app
**Repo:** https://github.com/manuelstoll1234/soundmaschine
**Netlify:** Site ID `ad7d8845-b9a2-4272-9156-2fb294ecde74`, Team „manuel-stoll's team"
**Auf dem Mac:** `~/Development/soundmaschine/`

Die alte URL `snazzy-melba-f87883.netlify.app` ist tot. Das frühere Netlify-Konto
hatte sein Credit-Limit erreicht, Production Deploys waren pausiert — Pushes kamen
bei GitHub an, wurden aber nie gebaut. Konto gewechselt, Continuous Deployment neu
verknüpft.

## Dateien im Repo

| Datei | Rolle |
|---|---|
| `index.html` | Was ausgeliefert wird. HTML + CSS + eingebettetes JS |
| `app.js` | Quelle des JS-Teils |
| `playlists.json` | 56 Spotify-Playlists, 3677 Titel. Wird nur bei Bedarf geladen |
| `build.sh` | Backt `app.js` in `index.html` |
| `logo-neon.png` | Logo in der Kopfzeile |

**Wichtig:** Das CSS lebt nur in `index.html`, nicht in `app.js`. `build.sh` ersetzt
ausschliesslich den `<script>`-Block. Wer CSS ändert, ändert `index.html` direkt.

## Ablauf

```
# JS ändern
vi app.js
./build.sh                 # macht node --check, bricht bei Syntaxfehler ab

# CSS ändern
vi index.html              # nur im <style>-Block

# prüfen, bevor committet wird
grep -c "<script>" index.html    # muss 1 sein
grep -c "var USERS" index.html   # muss 1 sein
grep -c "</style>" index.html    # muss 1 sein

git add -A && git commit -m "kurz" && git push origin main
```

Zeigt einer der drei Zähler mehr als 1, ist die Datei beschädigt — `git checkout index.html`.

Commit-Nachrichten: kurze Stichworte.

## Aufbau

**Drei Tabs** auf dem Handy (unter 880 px): Start · Suchen · Bibliothek.
Am Schreibtisch stattdessen die Seitenleiste mit sechs Punkten (zusätzlich Radio,
Lossless, Einstellungen). Auf dem Handy führt ☰ zur selben Leiste.

**Start** — Kachelraster „Zuletzt gehört" (zweispaltig), darunter waagrecht
scrollende Regale: Sammlungen, Radio, Deine Spotify-Listen.

**Suchen** — leerer Zustand zeigt 10 Genre-Kacheln. Bei Eingabe: Top-Treffer als
eigene Karte, darunter Tracks, Alben, Sender. Sortierung über `relScore()`, nicht
in der Reihenfolge, die Audius liefert.

**Bibliothek** — eigene Playlists, Spotify-Import, Verlauf.

**Mini-Player** schwebt eingerückt über der Tab-Leiste. Auf dem Handy nur Cover,
Titel, Play und Weiter — die übrigen Knöpfe wären auf 56 px Höhe nicht treffbar.

## Quellen

| Quelle | Rolle | Qualität |
|---|---|---|
| Audius | Vollständige Titel, durchsuchbar | 320k MP3 |
| Internet Archive | Ganze Alben, lossless über `format:(Flac)` | bis 24-Bit FLAC |
| Radio Browser | Live-Sender über `byTag()` | bis 320 kbps |
| Open-Meteo → wttr.in | Aussentemperatur Nänikon, Kopfzeile | — |

Alle ohne Schlüssel, alle CORS-sauber.

## Spotify-Playlists

`playlists.json` enthält Titel, Interpret und Album — **keine abspielbaren Dateien.**
Antippen sucht denselben Song auf Audius (`matchSp()`, Interpret zählt stärker als
Titel) und spielt den besten Treffer. Findet sich keiner, sagt die App das.

Audius ist eine Plattform für selbst hochladende Künstler. Eagles, AC/DC oder Donna
Summer sind dort nicht. Bei bekannten Titeln kommt oft „nicht gefunden" — das ist
keine Fehlfunktion, sondern der Katalog.

## Innentemperatur (Home Assistant)

Eingerichtet unter Einstellungen → Innentemperatur. URL, Entity-ID und Token liegen
im localStorage des jeweiligen Geräts, **nicht** in `index.html`.

Zeigt in der Praxis `⌂✕`, solange HA nur lokal erreichbar ist: eine HTTPS-Seite darf
kein `http://…` abfragen, und Netlifys Server kommen ohnehin nicht ins Heimnetz.
Funktioniert erst mit gültigem HTTPS von aussen (Nabu Casa oder eigene Domain).

## Fallen, die schon zugeschnappt sind

- **Audius liefert tote Tracks.** Titel, Cover, Abspielzahlen sehen gesund aus, der
  Stream antwortet mit 404. `is_streamable` ist das Feld, das das abbildet;
  `is_delete` allein übersieht Fälle. Die App filtert darauf und holt 5× über.
- **Web Audio macht Radio stumm.** Ein Element ohne CORS-Header durch
  `createMediaElementSource` zu leiten, erzeugt Stille. Zwei `<audio>`-Elemente:
  eines schlicht für Radio, eines mit `crossorigin` für Audius und Archive.
- **`#menuBtn` trug ein inline `display:none`.** Unter 880 px war die Navigation
  dadurch unerreichbar — kein Nutzerwechsel, keine Seitenleiste. Sichtbarkeit
  gehört in die Media Query, nicht ins Markup.
- **`viewport-fit=cover` ohne `safe-area-inset-top`** schiebt die Kopfzeile unter
  die Statusleiste.
- **Kein `overscroll-behavior`** lässt die Wischgeste das ganze Dokument ziehen.
- **`parseFloat("6:52")` ergibt 6.** Archive-Längen kommen als `m:ss` oder Sekunden.
- **Checksummen zählten als lossless.** Archive liefert `.ffp`-Dateien, deren Format
  weiterhin „Flac" lautet.
- **Ein Regex über eine Einzeiler-Funktion frisst alles bis zur nächsten `}`-Zeile.**
  Beim Aufräumen deshalb die Trefferlänge prüfen, nicht blind schneiden.

## Testen

`node --check` findet nur Syntaxfehler. Für Laufzeitverhalten hilft jsdom mit
eingefrorenem `fetch`. **Layout prüft das nicht** — jsdom rechnet keine Media
Queries. Safe Area, Überdehnen und Safaris Zoom beim Fokus zeigen sich nur auf dem
Gerät.

## Offen

- Der Signal-Drawer (R128, VU/RTA, Ambilight) ist im Code, aber auf dem Handy nicht
  erreichbar — die Knöpfe sind im Mini-Player ausgeblendet.
- `PAGES.lossless` und `PAGES.radio` hängen nur an der Seitenleiste, nicht an den Tabs.
