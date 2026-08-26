# SOUNDMASCHINE

Free music streaming for Manuel and Maya. One HTML file, no build step, no API keys, no account, no subscription.

**Every track plays in full.** There is no preview source in this app by design — nothing here serves a 30-second clip.

## Run it

Open `index.html` in any browser. That's the whole install.

Serve it over `http://` or `https://`, or open it as a local file. It will not work inside a sandboxed preview frame, because it loads everything live from three public services.

## Where the music comes from

| Source | What it gives | Quality |
|---|---|---|
| Audius | Complete tracks, on demand, searchable | 320k MP3 |
| Internet Archive | Complete albums — netlabels, live sets, Great 78 originals | Up to 24-bit FLAC |
| Radio Browser | Live stations, continuous | Up to 320 kbps |

All three are keyless and send CORS headers, so the page talks to them directly from the browser with no server and no proxy in between.

### A note on Audius track availability

Audius search returns a lot of entries whose audio is gone — they still carry a title, artwork and play counts, but the stream 404s. On one `drum and bass` query, nine of ten results were dead. The `is_streamable` flag is what actually tracks this (`is_delete` alone misses some), so the app filters on it, over-fetches to compensate, and leads browse shelves with `/v1/tracks/trending`, which returned 10 live tracks out of 10 on every genre tested.

## Audio quality

Every track is labelled with what it actually is — `24-BIT FLAC`, `FLAC`, `320k MP3`, `192k OGG`, `LIVE` — rather than promising a tier it cannot deliver. The Lossless tab filters the Internet Archive with `format:(Flac)`, so everything listed there is genuinely lossless. FLAC decodes natively in Chrome, Firefox, Edge and Safari 11+.

## Profiles

**Manuel** — Alternative, HardCore, Drum & Bass, Dub and Reggae. Home leads with Audius, because that is where those genres actually live. Lossless preferred, VU-meter amber accent.

**Maya** — 80s, Rock'n'Roll, Charts and oldies. Home leads with the radio dial, because that is where those genres actually live: Classic Vinyl HD at 320k, Heart 80s, SomaFM Underground 80s. Rock'n'Roll originals come from the Great 78 Project, digitised from the original shellac. Neon magenta accent.

Each profile keeps its own playlists, history and settings. Switch from the top of the sidebar.

## Your data

Nothing is uploaded anywhere. Playlists, history and settings live in this browser's LocalStorage, per profile. Settings has an Export button that hands you a JSON file. No account, no tracking, no analytics.

## Keyboard

`Space` play/pause · `/` focus search · `Shift+←` / `Shift+→` previous/next

## Deploy

Any static host works — the repo is a single file with no build.

**Netlify:** New site → Import from Git → pick this repo. Leave the build command empty, publish directory `.`. No environment variables needed.

**Netlify Drop:** drag `index.html` onto https://app.netlify.com/drop.

**GitHub Pages:** Settings → Pages → deploy from `main` / root.

## Known limits

- Radio stations that only serve `http://` are filtered out on an `https://` page, because browsers block mixed content. Opening the file locally shows more stations.
- The spectrum analyser runs on Audius and Internet Archive, which send CORS headers. Radio streams do not, and routing those through Web Audio would silence them, so the visualiser animates in sync instead. If the analyser path ever fails, playback retries once without it — the track matters more than the graphic.
- Audius carries Manuel's genres well and Maya's poorly. Searching it for "schlager" returns a Skrillex remix. That is why her profile leads with radio instead.

## Browsers

Chrome/Chromium 90+, Firefox 88+, Safari 14+, Edge 90+, and mobile Safari and Chrome.
