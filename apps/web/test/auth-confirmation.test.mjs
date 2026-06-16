import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function evaluateModule(source, requireStub = require) {
  const moduleRecord = { exports: {} };
  const evaluate = new Function("exports", "module", "require", source);

  evaluate(moduleRecord.exports, moduleRecord, requireStub);

  return moduleRecord.exports;
}

const validationExports = evaluateModule(transpile("src/lib/auth/validation.ts"));
const confirmationExports = evaluateModule(transpile("src/lib/auth/confirmation.ts"), (specifier) => {
  if (specifier === "@/lib/auth/validation") {
    return validationExports;
  }

  return require(specifier);
});

const {
  buildConfirmationCallbackUrl,
  buildConfirmationFailureUrl,
  buildConfirmationRedirectUrl,
  isAllowedConfirmationType,
} = confirmationExports;

test("confirmation route accepts only signup and email token types", () => {
  assert.equal(isAllowedConfirmationType("signup"), true);
  assert.equal(isAllowedConfirmationType("email"), true);

  for (const type of ["invite", "magiclink", "recovery", "email_change", "sms", "", null]) {
    assert.equal(isAllowedConfirmationType(type), false, `${type} must be rejected`);
  }
});

test("confirmation redirects use configured APP_ORIGIN only", () => {
  const appOrigin = "https://lnfti.example";

  assert.equal(
    buildConfirmationCallbackUrl(appOrigin, "/me/profile"),
    "https://lnfti.example/auth/confirm?next=%2Fme%2Fprofile",
  );
  assert.equal(
    buildConfirmationCallbackUrl(appOrigin, "https://evil.example"),
    "https://lnfti.example/auth/confirm?next=%2Fme%2Fprofile",
  );
  assert.equal(
    buildConfirmationRedirectUrl(appOrigin, "/me/profile"),
    "https://lnfti.example/me/profile",
  );
  assert.equal(
    buildConfirmationRedirectUrl(appOrigin, "https://evil.example"),
    "https://lnfti.example/me/profile",
  );
  assert.equal(
    buildConfirmationFailureUrl(appOrigin),
    "https://lnfti.example/login?message=confirmation_failed",
  );
});

test("registration action does not derive origin from spoofable request headers", () => {
  const actionSource = readFileSync("src/lib/auth/actions.ts", "utf8");
  const routeSource = readFileSync("src/app/auth/confirm/route.ts", "utf8");

  assert.doesNotMatch(actionSource, /x-forwarded-host|x-forwarded-proto|headers\(\)|host\)/);
  assert.match(actionSource, /getAppOrigin/);
  assert.doesNotMatch(routeSource, /new URL\([^,]+,\s*request\.url/);
  assert.match(routeSource, /getAppOrigin/);
});

test("auth actions use one confirmation callback for signup and resend", () => {
  const actionSource = readFileSync("src/lib/auth/actions.ts", "utf8");

  assert.match(actionSource, /email_not_confirmed/);
  assert.match(actionSource, /LOGIN_EMAIL_NOT_CONFIRMED_ERROR/);
  assert.match(actionSource, /supabase\.auth\.resend/);
  assert.match(actionSource, /buildConfirmationCallbackUrl\(appOrigin, next\)/);
  assert.doesNotMatch(actionSource, /localhost/);
});

test("confirmation route copies Supabase SSR cookies onto redirect response", () => {
  const routeSource = readFileSync("src/app/auth/confirm/route.ts", "utf8");

  assert.match(routeSource, /createServerClient/);
  assert.match(routeSource, /cookiesToSet\.push/);
  assert.match(routeSource, /response\.cookies\.set/);
  assert.match(routeSource, /verifyOtp/);
});

test("check-email is reserved for Auth email confirmation state", () => {
  const serverSource = readFileSync("src/lib/auth/server.ts", "utf8");
  const profilePageSource = readFileSync("src/app/me/profile/page.tsx", "utf8");

  assert.match(serverSource, /email_confirmed_at/);
  assert.match(serverSource, /redirect\("\/auth\/check-email"\)/);
  assert.doesNotMatch(profilePageSource, /\/auth\/check-email/);
  assert.match(profilePageSource, /ProfileUnavailable/);
});
