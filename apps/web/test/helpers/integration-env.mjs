import assert from "node:assert/strict";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  assert.ok(value, `${name} is required`);
  return value;
}

function assertLocalUrl(name, value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }

  assert.ok(LOCAL_HOSTNAMES.has(url.hostname), `${name} must target localhost or 127.0.0.1`);
  assert.equal(url.username, "", `${name} must not include credentials`);
  assert.equal(url.password, "", `${name} must not include credentials`);

  return url.toString().replace(/\/$/, "");
}

function assertLocalHost(name, value) {
  assert.ok(LOCAL_HOSTNAMES.has(value), `${name} must target localhost or 127.0.0.1`);
  return value;
}

export function isMvpIntegrationEnabled() {
  return process.env.RUN_MVP_INTEGRATION === "1";
}

export function requireLocalIntegrationEnv() {
  const env = {
    supabaseUrl: assertLocalUrl("NEXT_PUBLIC_SUPABASE_URL", readRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")),
    supabasePublishableKey: readRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    appUrl: assertLocalUrl("NEXT_APP_URL", readRequiredEnv("NEXT_APP_URL")),
    mailpitUrl: assertLocalUrl("MAILPIT_URL", readRequiredEnv("MAILPIT_URL")),
    db: {
      host: assertLocalHost("SUPABASE_DB_HOST", readRequiredEnv("SUPABASE_DB_HOST")),
      port: Number.parseInt(readRequiredEnv("SUPABASE_DB_PORT"), 10),
      user: readRequiredEnv("SUPABASE_DB_USER"),
      password: readRequiredEnv("SUPABASE_DB_PASSWORD"),
      database: readRequiredEnv("SUPABASE_DB_NAME"),
    },
    aiServiceUrl: assertLocalUrl("AI_SERVICE_URL", readRequiredEnv("AI_SERVICE_URL")),
    aiInternalApiToken: readRequiredEnv("AI_INTERNAL_API_TOKEN"),
  };

  assert.ok(Number.isInteger(env.db.port) && env.db.port > 0, "SUPABASE_DB_PORT must be a valid port");
  assert.ok(env.aiInternalApiToken.length >= 32, "AI_INTERNAL_API_TOKEN must be generated at runtime");
  assert.doesNotMatch(env.supabasePublishableKey, /service_role|sb_secret_/i);

  return env;
}
