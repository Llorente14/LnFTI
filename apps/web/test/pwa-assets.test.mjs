import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const manifestPath = "src/app/manifest.webmanifest";
const swPath = "public/sw.js";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readPngSize(path) {
  const png = readFileSync(path);

  assert.equal(png.toString("ascii", 1, 4), "PNG");

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

test("manifest file exists and is valid JSON", () => {
  assert.equal(existsSync(manifestPath), true);
  assert.equal(readJson(manifestPath).lang, "id");
});

test("manifest contains required install fields", () => {
  const manifest = readJson(manifestPath);

  assert.equal(manifest.name, "LnFTI — Untar Lost & Found");
  assert.equal(manifest.short_name, "LnFTI");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
});

test("manifest uses LnFTI theme and background colors", () => {
  const manifest = readJson(manifestPath);

  assert.equal(manifest.theme_color, "#6B1220");
  assert.equal(manifest.background_color, "#FAF8F7");
});

test("manifest includes required icon declarations", () => {
  const manifest = readJson(manifestPath);
  const iconSizes = new Set(manifest.icons.map((icon) => icon.sizes));

  assert.equal(iconSizes.has("192x192"), true);
  assert.equal(iconSizes.has("512x512"), true);
  assert.equal(manifest.icons.some((icon) => icon.purpose === "maskable"), true);
  assert.equal(manifest.icons.every((icon) => icon.src.startsWith("/icons/")), true);
});

test("png files have declared dimensions", () => {
  assert.deepEqual(readPngSize("public/icons/lnfti-192.png"), { width: 192, height: 192 });
  assert.deepEqual(readPngSize("public/icons/lnfti-512.png"), { width: 512, height: 512 });
  assert.deepEqual(readPngSize("public/icons/lnfti-maskable-512.png"), { width: 512, height: 512 });
  assert.deepEqual(readPngSize("public/icons/apple-touch-icon.png"), { width: 180, height: 180 });
});

test("service worker exists and references offline route", () => {
  const sw = readFileSync(swPath, "utf8");

  assert.equal(existsSync(swPath), true);
  assert.match(sw, /const OFFLINE_URL = "\/offline"/);
  assert.match(sw, /const CACHE_VERSION = "v1"/);
  assert.match(sw, /lnfti-offline-/);
  assert.match(sw, /lnfti-static-/);
});

test("service worker avoids broad private-route precaching", () => {
  const sw = readFileSync(swPath, "utf8");
  const precacheBlock = sw.match(/const PRECACHE_ASSETS = \[[^\]]+\]/s)?.[0] ?? "";

  assert.doesNotMatch(precacheBlock, /\/admin|\/me|\/report\/new|\/login|\/register|\/auth|\/api/);
  assert.doesNotMatch(precacheBlock, /supabase|storage|_next/);
});

test("service worker excludes private and dynamic request classes", () => {
  const sw = readFileSync(swPath, "utf8");

  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/auth\/"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/_next\/image"\)/);
  assert.match(sw, /request\.headers\.has\("rsc"\)/);
  assert.match(sw, /request\.headers\.has\("next-action"\)/);
});

test("service worker cache lookup stays scoped to selected cache", () => {
  const sw = readFileSync(swPath, "utf8");

  assert.match(sw, /const cache = await caches\.open\(cacheName\)/);
  assert.match(sw, /await cache\.match\(request\)/);
  assert.doesNotMatch(sw, /caches\.match\(request\)/);
});

test("root layout and Next config wire PWA registration and headers", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const nextConfig = readFileSync("next.config.ts", "utf8");

  assert.match(layout, /ServiceWorkerRegistration/);
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.match(nextConfig, /source: "\/sw\.js"/);
  assert.match(nextConfig, /Service-Worker-Allowed/);
  assert.match(nextConfig, /must-revalidate/);
});

test("public PWA bootstrap routes bypass session refresh", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");

  assert.match(proxy, /"\/offline"/);
  assert.match(proxy, /"\/manifest\.webmanifest"/);
  assert.match(proxy, /"\/sw\.js"/);
  assert.match(proxy, /PWA_PUBLIC_PATHS\.has\(request\.nextUrl\.pathname\)/);
  assert.match(proxy, /return NextResponse\.next\(\)/);
});
