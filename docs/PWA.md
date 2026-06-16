# LnFTI PWA

LnFTI uses a lightweight native PWA setup. No Workbox, `next-pwa`, Serwist, Background Sync, Web Push, notification flow, or offline mutation queue is used.

## Files

- Manifest: `apps/web/src/app/manifest.webmanifest`
- Service worker: `apps/web/public/sw.js`
- Offline page: `apps/web/src/app/offline/page.tsx`
- Registration component: `apps/web/src/components/pwa/service-worker-registration.tsx`
- Icons: `apps/web/public/icons/lnfti-192.png`, `lnfti-512.png`, `lnfti-maskable-512.png`, `apple-touch-icon.png`

## Registration

The service worker registers `/sw.js` once from the root layout, only in production and only when `navigator.serviceWorker` is available. Browsers without service-worker support keep using the normal web app.

`next.config.ts` serves `/sw.js` with:

- `Content-Type: application/javascript; charset=utf-8`
- `Cache-Control: public, max-age=0, must-revalidate`
- `Service-Worker-Allowed: /`

## Cache Strategy

Cache names are versioned in `sw.js`:

- `lnfti-offline-v1`
- `lnfti-static-v1`

Precached assets:

- `/offline`
- `/manifest.webmanifest`
- `/icons/lnfti-192.png`
- `/icons/lnfti-512.png`
- `/icons/lnfti-maskable-512.png`
- `/icons/apple-touch-icon.png`

Navigation requests use network first. If the network fails, the worker returns cached `/offline`. Successful HTML navigation responses are not stored, so authenticated pages remain network-dependent.

Same-origin immutable assets under `/_next/static/` use cache first. The worker ignores API, auth, `_rsc`, Server Action, `_next/image`, cross-origin, signed-query, and non-GET requests.

## Privacy Boundary

The worker intentionally does not cache `/admin`, `/me`, `/report/new`, report detail HTML, claim data, handover data, signed Supabase image responses, audit logs, or authenticated user pages. Offline form submission is not supported. Status changes still require the existing online RPC and Realtime flows.

## Local Production Smoke

```bash
cd apps/web
npm ci
npm run build
npm start
```

Open the app in a browser and inspect DevTools Application:

- Manifest has LnFTI name, colors, and 192/512/maskable icons.
- `/sw.js` is active with scope `/`.
- Native install option is available where the browser supports it.
- Offline navigation shows `/offline`.
- Hard-refreshing private pages while offline shows generic offline fallback, not cached private HTML.

## Cache Bumps And Stale Workers

When changing precached assets or service-worker behavior, bump `CACHE_VERSION` in `apps/web/public/sw.js`.

To inspect or remove stale workers locally, open DevTools Application, check Service Workers and Cache Storage, then use **Unregister** and delete only LnFTI caches.

No remote database push is needed for PWA changes.
