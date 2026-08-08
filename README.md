# H2O–8 — installable web app

Everything lives in this folder. No build step, no server code, no accounts.

## Files

- `index.html` — the app shell and all styling
- `app.js` — the whole app: logging, history, reminders, settings
- `manifest.webmanifest` — name, icons, standalone display
- `sw.js` — service worker; caches the app so it opens offline
- `icon-*.png` — Home Screen icons (orange field, ink "8")

## Get it on your phone

1. Put this `app/` folder on any static host over **HTTPS** — GitHub Pages, Netlify
   drop, Cloudflare Pages, Vercel. HTTPS is required or the service worker and
   notifications won't run. (`file://` and plain `http://` will not work.)
2. Open the URL in **Safari** on your iPhone. Chrome/Firefox on iOS cannot install
   to the Home Screen.
3. Share → **Add to Home Screen**. It launches full-screen with no browser chrome.
4. Open it once while online so the service worker caches everything; after that it
   works with no connection.

## Where your data lives

`localStorage` on that one phone, under the key `h2o8.v1`. Nothing is sent anywhere.
Consequences worth knowing:

- No sync. A second device is a separate log.
- Deleting the Home Screen icon **and** clearing Safari website data erases the log.
  Export CSV from Setup before you do either.
- Setup → Erase all data wipes it deliberately.

## Reminders — the honest version

iOS only delivers web-app notifications when the app has been added to the Home
Screen (iOS 16.4+), and it schedules them opportunistically. This app arms its
reminders whenever it is running; if iOS has fully evicted it for a long stretch, a
nudge can be skipped. The log itself is never affected. If reminders turn out to
matter more than convenience, that is the reason to move to a native build.

## Fonts

Archivo and IBM Plex Mono load from Google Fonts and are cached by the service
worker after the first online visit. If you want them guaranteed offline from the
very first launch, drop the `.woff2` files next to `index.html`, replace the
`<link>` with local `@font-face` rules, and add the files to `SHELL` in `sw.js`.
