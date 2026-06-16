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

function loadModule(path) {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", transpile(path));

  evaluateModule(moduleRecord.exports, moduleRecord, require);

  return moduleRecord.exports;
}

const profileVerification = loadModule("src/lib/auth/profile-verification.ts");

test("verified profile status accepts production lowercase enum value", () => {
  assert.equal(profileVerification.isVerifiedProfileStatus("verified"), true);
  assert.equal(profileVerification.isVerifiedStudentProfile({
    role: "student",
    verification_status: "verified",
  }), true);
});

test("verified profile helper rejects non-verified status values", () => {
  for (const status of ["unverified", "pending", "rejected", "PENDING_EMAIL", null, undefined]) {
    assert.equal(profileVerification.isVerifiedProfileStatus(status), false);
    assert.equal(profileVerification.isVerifiedStudentProfile({
      role: "student",
      verification_status: status,
    }), false);
  }
});

test("verified profile helper keeps AI proxy student-only", () => {
  for (const role of ["verifier", "admin", null, undefined]) {
    assert.equal(profileVerification.isVerifiedStudentProfile({
      role,
      verification_status: "verified",
    }), false);
  }

  assert.equal(profileVerification.isVerifiedStudentProfile(null), false);
});

test("AI profile authorization keeps generic denials and confirmed-email requirement", () => {
  const source = readFileSync("src/lib/ai/proxy-request.ts", "utf8");

  assert.match(source, /!user\.email_confirmed_at/);
  assert.match(source, /AiProxyRequestError\(401, "UNAUTHORIZED", "Permintaan tidak diizinkan\."\)/);
  assert.match(source, /AiProxyRequestError\(403, "FORBIDDEN", "Permintaan tidak diizinkan\."\)/);
  assert.match(source, /isVerifiedStudentProfile\(profile\)/);
});

test("web source avoids direct uppercase verification status comparisons", () => {
  const files = [
    "src/lib/ai/proxy-request.ts",
    "src/lib/claims/queries.ts",
    "src/app/reports/[id]/claim-actions.ts",
    "src/lib/admin/handover-validation.ts",
    "src/app/me/profile/page.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /(verification_status|claimantVerificationStatus)\s*(?:={2,3}|!==|!=)\s*["']VERIFIED["']/,
      `${file} must use profile verification helper`,
    );
  }
});
