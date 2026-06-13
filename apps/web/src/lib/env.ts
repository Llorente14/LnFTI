const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

type PublicEnvInput = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
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
    payload &&
    typeof payload === "object" &&
    "role" in payload &&
    payload.role === "anon"
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
