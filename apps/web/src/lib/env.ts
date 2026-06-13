const SUPABASE_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY_ENV = "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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

function assertPublishableKey(value: string): string {
  if (value.startsWith("sb_secret_") || value.toLowerCase().includes("service_role")) {
    throw new Error(`${SUPABASE_PUBLISHABLE_KEY_ENV} must not contain a secret or service-role key.`);
  }

  if (!(value.startsWith("sb_publishable_") || value.startsWith("eyJ"))) {
    throw new Error(
      `${SUPABASE_PUBLISHABLE_KEY_ENV} must be a Supabase publishable key, or a legacy anon JWT for local development.`,
    );
  }

  return value;
}

export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: assertSupabaseUrl(readRequiredEnv(SUPABASE_URL_ENV)),
    supabasePublishableKey: assertPublishableKey(readRequiredEnv(SUPABASE_PUBLISHABLE_KEY_ENV)),
  };
}
