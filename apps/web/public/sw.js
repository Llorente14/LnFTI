const CACHE_VERSION = "v1";
const OFFLINE_URL = "/offline";
const MANIFEST_URL = "/manifest.webmanifest";
const OFFLINE_CACHE_NAME = `lnfti-offline-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `lnfti-static-${CACHE_VERSION}`;
const CACHE_NAMES = [OFFLINE_CACHE_NAME, STATIC_CACHE_NAME];
const ICON_URLS = [
  "/icons/lnfti-192.png",
  "/icons/lnfti-512.png",
  "/icons/lnfti-maskable-512.png",
  "/icons/apple-touch-icon.png",
];
const PRECACHE_ASSETS = [OFFLINE_URL, MANIFEST_URL, ...ICON_URLS];

function isLnftiCache(cacheName) {
  return cacheName.startsWith("lnfti-offline-") || cacheName.startsWith("lnfti-static-");
}

function hasSensitiveQuery(url) {
  return url.searchParams.has("token")
    || url.searchParams.has("signature")
    || url.searchParams.has("X-Amz-Signature")
    || url.searchParams.has("_rsc");
}

function shouldIgnoreRequest(request) {
  const url = new URL(request.url);

  return request.method !== "GET"
    || url.origin !== self.location.origin
    || url.pathname === "/sw.js"
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/auth/")
    || url.pathname.startsWith("/storage/")
    || url.pathname.startsWith("/_next/image")
    || hasSensitiveQuery(url)
    || request.headers.has("rsc")
    || request.headers.has("next-action");
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isNextStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isPwaAsset(url) {
  return url.origin === self.location.origin && PRECACHE_ASSETS.includes(url.pathname);
}

function canCacheResponse(response) {
  return response.ok && response.type === "basic";
}

async function offlineFallback() {
  const cache = await caches.open(OFFLINE_CACHE_NAME);
  const cached = await cache.match(OFFLINE_URL);

  return cached ?? new Response(
    "<!doctype html><html lang=\"id\"><meta charset=\"utf-8\"><title>Anda sedang offline</title><body><h1>Anda sedang offline</h1><p>LnFTI memerlukan koneksi internet.</p></body></html>",
    {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineFallback();
  }
}

async function handleCacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (canCacheResponse(response)) {
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => isLnftiCache(cacheName) && !CACHE_NAMES.includes(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (shouldIgnoreRequest(request)) {
    return;
  }

  const url = new URL(request.url);

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isNextStaticAsset(url)) {
    event.respondWith(handleCacheFirst(request, STATIC_CACHE_NAME));
    return;
  }

  if (isPwaAsset(url)) {
    event.respondWith(handleCacheFirst(request, OFFLINE_CACHE_NAME));
  }
});
