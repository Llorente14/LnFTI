import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const envSource = readFileSync("src/lib/env.ts", "utf8");
const envModule = ts.transpileModule(envSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

function loadEnvExports() {
  const moduleRecord = { exports: {} };
  const requireStub = () => {
    throw new Error("env.ts should not require external modules in unit tests.");
  };
  const evaluateModule = new Function("exports", "module", "require", "process", "globalThis", envModule);

  evaluateModule(moduleRecord.exports, moduleRecord, requireStub, process, globalThis);

  return moduleRecord.exports;
}

const { getPublicEnv, validatePublicEnv } = loadEnvExports();

function legacyJwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

test("public env reads NEXT_PUBLIC values through static references", () => {
  assert.doesNotMatch(envSource, /process\.env\[/);
  assert.match(envSource, /process\.env\.NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(envSource, /process\.env\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
});

test("valid public env accepts https Supabase URL and publishable key", () => {
  assert.deepEqual(
    validatePublicEnv({
      supabaseUrl: "https://project-ref.supabase.co/",
      supabasePublishableKey: "sb_publishable_example",
    }),
    {
      supabaseUrl: "https://project-ref.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    },
  );
});

test("public env rejects missing required values", () => {
  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: undefined,
        supabasePublishableKey: "sb_publishable_example",
      }),
    /Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL/,
  );

  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "https://project-ref.supabase.co",
        supabasePublishableKey: undefined,
      }),
    /Missing required environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
  );
});

test("public env rejects invalid Supabase URLs", () => {
  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "not-a-url",
        supabasePublishableKey: "sb_publishable_example",
      }),
    /NEXT_PUBLIC_SUPABASE_URL must be a valid URL/,
  );

  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "http://project-ref.supabase.co",
        supabasePublishableKey: "sb_publishable_example",
      }),
    /NEXT_PUBLIC_SUPABASE_URL must use https/,
  );
});

test("public env rejects invalid publishable and secret keys", () => {
  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "https://project-ref.supabase.co",
        supabasePublishableKey: "anon-key-placeholder",
      }),
    /must be a Supabase publishable key/,
  );

  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "https://project-ref.supabase.co",
        supabasePublishableKey: "sb_secret_example",
      }),
    /must not contain a secret or service-role key/,
  );
});

test("public env allows only legacy JWTs with role anon", () => {
  const anonJwt = legacyJwt("anon");
  const serviceRoleJwt = legacyJwt("service_role");

  assert.equal(
    validatePublicEnv({
      supabaseUrl: "https://project-ref.supabase.co",
      supabasePublishableKey: anonJwt,
    }).supabasePublishableKey,
    anonJwt,
  );

  assert.throws(
    () =>
      validatePublicEnv({
        supabaseUrl: "https://project-ref.supabase.co",
        supabasePublishableKey: serviceRoleJwt,
      }),
    /legacy JWT must have role=anon/,
  );
});

test("getPublicEnv validates current process env values", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project-ref.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_example";

  try {
    assert.deepEqual(getPublicEnv(), {
      supabaseUrl: "https://project-ref.supabase.co",
      supabasePublishableKey: "sb_publishable_example",
    });
  } finally {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    }

    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  }
});
