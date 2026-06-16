#!/usr/bin/env node
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 15_000;

export function validateProductionUrl(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${name} must use HTTPS in production.`);
  }

  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`${name} must not target localhost.`);
  }

  if (url.username || url.password) {
    throw new Error(`${name} must not include credentials.`);
  }

  return url.origin;
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const timeout = timeoutSignal(timeoutMs);
  try {
    return await fetch(url, { ...options, signal: timeout.signal });
  } finally {
    timeout.clear();
  }
}

async function requireOk(label, url, timeoutMs, accept = (response) => response.ok) {
  const response = await fetchWithTimeout(url, { headers: { "User-Agent": "lnfti-production-smoke" } }, timeoutMs);
  if (!accept(response)) {
    throw new Error(`${label} returned HTTP ${response.status}.`);
  }
  return response;
}

async function verifyWeb(webOrigin, timeoutMs) {
  await requireOk("web homepage", `${webOrigin}/`, timeoutMs);
  await requireOk("public reports", `${webOrigin}/reports`, timeoutMs);

  const manifest = await requireOk("manifest", `${webOrigin}/manifest.webmanifest`, timeoutMs);
  const manifestContentType = manifest.headers.get("content-type") ?? "";
  if (!manifestContentType.includes("application/manifest+json") && !manifestContentType.includes("application/json")) {
    throw new Error("manifest response must be JSON.");
  }
  await manifest.json();

  await requireOk("offline page", `${webOrigin}/offline`, timeoutMs);
  const serviceWorker = await requireOk("service worker", `${webOrigin}/sw.js`, timeoutMs);
  const serviceWorkerContentType = serviceWorker.headers.get("content-type") ?? "";
  if (!serviceWorkerContentType.includes("javascript")) {
    throw new Error("service worker response must be JavaScript.");
  }
}

async function verifyAi(aiOrigin, timeoutMs) {
  await requireOk("AI health", `${aiOrigin}/api/v1/health`, timeoutMs);

  const formData = new FormData();
  formData.set("file", new Blob(["not-an-image"], { type: "image/png" }), "smoke.png");
  const response = await fetchWithTimeout(
    `${aiOrigin}/api/v1/images/detect`,
    {
      method: "POST",
      headers: { "User-Agent": "lnfti-production-smoke" },
      body: formData,
    },
    timeoutMs,
  );
  if (response.status !== 401 && response.status !== 403) {
    throw new Error(`unauthenticated AI detect returned HTTP ${response.status}.`);
  }
}

export async function runProductionVerification(env = process.env) {
  const timeoutMs = Number.parseInt(env.PRODUCTION_SMOKE_TIMEOUT_MS ?? `${DEFAULT_TIMEOUT_MS}`, 10);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) {
    throw new Error("PRODUCTION_SMOKE_TIMEOUT_MS must be 1000-60000.");
  }

  const webOrigin = validateProductionUrl("PRODUCTION_WEB_URL", env.PRODUCTION_WEB_URL);
  const aiOrigin = validateProductionUrl("PRODUCTION_AI_URL", env.PRODUCTION_AI_URL);

  await verifyWeb(webOrigin, timeoutMs);
  await verifyAi(aiOrigin, timeoutMs);

  return { webOrigin, aiOrigin };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProductionVerification()
    .then(({ webOrigin, aiOrigin }) => {
      console.log(`Production smoke passed for ${webOrigin} and ${aiOrigin}.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
