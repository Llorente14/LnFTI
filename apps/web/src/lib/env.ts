const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const APP_ORIGIN_ENV = "APP_ORIGIN";
const AI_SERVICE_URL_ENV = "AI_SERVICE_URL";
const AI_INTERNAL_API_TOKEN_ENV = "AI_INTERNAL_API_TOKEN";
const AI_REQUEST_TIMEOUT_MS_ENV = "AI_REQUEST_TIMEOUT_MS";
const INSECURE_AI_TOKEN_PLACEHOLDERS = new Set([
  "replace_with_at_least_32_random_characters",
]);

type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type PublicEnvInput = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
};

type AppEnvInput = {
  appOrigin: string | undefined;
};

export type AiServiceEnv = {
  aiServiceUrl: string;
  aiInternalApiToken: string;
  aiRequestTimeoutMs: number;
};

type AiServiceEnvInput = {
  aiServiceUrl: string | undefined;
  aiInternalApiToken: string | undefined;
  aiRequestTimeoutMs: string | undefined;
};

function readRequiredValue(name: string, value: string | undefined): string {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return trimmedValue;
}

function assertSupabaseUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${SUPABASE_URL_ENV} must be a valid URL.`);
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(url.hostname);
  const isSupabaseLocalApi = url.hostname === "host.docker.internal";

  if (url.protocol !== "https:" && !(url.protocol === "http:" && (isLocalHost || isSupabaseLocalApi))) {
    throw new Error(`${SUPABASE_URL_ENV} must use https, except for local Supabase development.`);
  }

  return url.toString().replace(/\/$/, "");
}

function assertAppOrigin(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${APP_ORIGIN_ENV} must be a valid URL.`);
  }

  if (url.username || url.password) {
    throw new Error(`${APP_ORIGIN_ENV} must not include username or password.`);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${APP_ORIGIN_ENV} must include only scheme, host, and optional port.`);
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol === "http:" && !isLocalHost) {
    throw new Error(`${APP_ORIGIN_ENV} may use http only for localhost or 127.0.0.1.`);
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost)) {
    throw new Error(`${APP_ORIGIN_ENV} must use https outside local development.`);
  }

  return url.origin;
}

function assertOriginUrl(name: string, value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.username || url.password) {
    throw new Error(`${name} must not include username or password.`);
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${name} must include only scheme, host, and optional port.`);
  }

  const isLocalHost = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol === "http:" && !isLocalHost) {
    throw new Error(`${name} may use http only for localhost or 127.0.0.1.`);
  }

  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalHost)) {
    throw new Error(`${name} must use https outside local development.`);
  }

  return url.origin;
}

function assertAiToken(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length < 32) {
    throw new Error(`${AI_INTERNAL_API_TOKEN_ENV} must be at least 32 characters.`);
  }

  if (INSECURE_AI_TOKEN_PLACEHOLDERS.has(trimmedValue)) {
    throw new Error(`${AI_INTERNAL_API_TOKEN_ENV} must be a generated secret, not an example placeholder.`);
  }

  return trimmedValue;
}

function assertAiTimeout(value: string | undefined): number {
  const rawValue = value?.trim() || "120000";
  const timeoutMs = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(timeoutMs) || String(timeoutMs) !== rawValue || timeoutMs < 5_000 || timeoutMs > 300_000) {
    throw new Error(`${AI_REQUEST_TIMEOUT_MS_ENV} must be an integer from 5000 to 300000.`);
  }

  return timeoutMs;
}

function decodeLegacyJwtPayload(value: string): unknown {
  const parts = value.split(".");

  if (parts.length !== 3) {
    throw new Error(`${SUPABASE_PUBLISHABLE_KEY_ENV} legacy JWT must have three parts.`);
  }

  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const paddedPayload = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");

  try {
    return JSON.parse(globalThis.atob(paddedPayload));
  } catch {
    throw new Error(`${SUPABASE_PUBLISHABLE_KEY_ENV} legacy JWT payload must be valid JSON.`);
  }
}

function assertLegacyAnonJwt(value: string): string {
  const payload = decodeLegacyJwtPayload(value);

  if (
    payload
    && typeof payload === "object"
    && "role" in payload
    && payload.role === "anon"
  ) {
    return value;
  }

  throw new Error(`${SUPABASE_PUBLISHABLE_KEY_ENV} legacy JWT must have role=anon.`);
}

function assertPublishableKey(value: string): string {
  if (value.startsWith("sb_secret_") || value.toLowerCase().includes("service_role")) {
    throw new Error(`${SUPABASE_PUBLISHABLE_KEY_ENV} must not contain a secret or service-role key.`);
  }

  if (value.startsWith("sb_publishable_")) {
    return value;
  }

  if (value.startsWith("eyJ")) {
    return assertLegacyAnonJwt(value);
  }

  throw new Error(
    `${SUPABASE_PUBLISHABLE_KEY_ENV} must be a Supabase publishable key, or a legacy anon JWT for local development.`,
  );
}

export function validatePublicEnv(input: PublicEnvInput): PublicEnv {
  return {
    supabaseUrl: assertSupabaseUrl(readRequiredValue(SUPABASE_URL_ENV, input.supabaseUrl)),
    supabasePublishableKey: assertPublishableKey(
      readRequiredValue(SUPABASE_PUBLISHABLE_KEY_ENV, input.supabasePublishableKey),
    ),
  };
}

export function getPublicEnv(): PublicEnv {
  return validatePublicEnv({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function validateAppEnv(input: AppEnvInput): { appOrigin: string } {
  return {
    appOrigin: assertAppOrigin(readRequiredValue(APP_ORIGIN_ENV, input.appOrigin)),
  };
}

export function getAppOrigin(): string {
  return validateAppEnv({
    appOrigin: process.env.APP_ORIGIN,
  }).appOrigin;
}

export function validateAiServiceEnv(input: AiServiceEnvInput): AiServiceEnv {
  return {
    aiServiceUrl: assertOriginUrl(AI_SERVICE_URL_ENV, readRequiredValue(AI_SERVICE_URL_ENV, input.aiServiceUrl)),
    aiInternalApiToken: assertAiToken(readRequiredValue(AI_INTERNAL_API_TOKEN_ENV, input.aiInternalApiToken)),
    aiRequestTimeoutMs: assertAiTimeout(input.aiRequestTimeoutMs),
  };
}
