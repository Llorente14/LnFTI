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
