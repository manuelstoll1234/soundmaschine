# SOUNDMASCHINE

Free music streaming for Manuel and Maya. One HTML file, no build step, no API keys, no account, no subscription.

## Run it

Open `index.html` in any browser. That's the whole install.

It must be served over `http://` or `https://`, or opened as a local file — it will not work inside a sandboxed preview frame, because it loads everything live from three public services.

## Where the music comes from

| Source | What it gives | Quality |
|---|---|---|
| iTunes Search | Metadata, album art, previews | 30-second AAC clips |
| Internet Archive | Complete tracks — live sets, netlabels, open music | Up to 24-bit FLAC |
| Radio Browser | Live stations, continuous playback | Up to 320 kbps, some FLAC |

All three are keyless and send CORS headers, so the page talks to them directly from the browser with no server and no proxy in between.

**On the 30-second previews:** iTunes only serves clips. That is a hard limit of the service, not a setting. For full-length listening use the Radio and Lossless tabs, which stream complete audio.

## Audio quality

Every track is labelled with what it actually is — `24-BIT FLAC`, `FLAC`, `320k MP3`, `PREVIEW`, `LIVE` — rather than promising a quality tier it cannot deliver. The Lossless tab filters the Internet Archive with `format:(Flac)`, so everything listed there is genuinely lossless. FLAC decodes natively in Chrome, Firefox, Edge and Safari 11+.

## Profiles

Manuel gets Alternative, HardCore, Drum & Bass, Reggae and Dub, with lossless preferred and a VU-meter amber accent. Maya gets 80s, Rock'n'Roll, Schlager and Charts in neon magenta. Each profile keeps its own playlists, history and settings. Switch from the top of the sidebar.

## Your data

Nothing is uploaded anywhere. Playlists, history and settings live in this browser's LocalStorage, per profile. Settings has an Export button that hands you a JSON file. There is no account, no tracking and no analytics.

## Keyboard

`Space` play/pause · `/` focus search · `Shift+←` / `Shift+→` previous/next

## Deploy

Any static host works — the repo is a single file with no build.

**Netlify:** New site → Import from Git → pick this repo. Leave the build command empty and set the publish directory to `.`. No environment variables are needed.

**Netlify Drop:** drag `index.html` onto https://app.netlify.com/drop.

**GitHub Pages:** Settings → Pages → deploy from `main` / root.

## Known limits

- iTunes previews are 30 seconds. Nothing can change that.
- Radio stations that only serve `http://` are filtered out on an `https://` page, because browsers block mixed content. Opening the file locally shows more stations.
- The spectrum analyser runs on Internet Archive tracks. Radio and preview streams send no CORS headers, and routing those through Web Audio would silence them, so the visualiser animates in sync instead of analysing. Playback reliability wins over a real spectrum.

## Browsers

Chrome/Chromium 90+, Firefox 88+, Safari 14+, Edge 90+, and mobile Safari and Chrome.
