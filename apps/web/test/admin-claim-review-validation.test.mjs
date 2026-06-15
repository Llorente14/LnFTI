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

const validation = loadModule("src/lib/admin/claim-review-validation.ts");
const claims = loadModule("src/lib/claims/validation.ts");
const claimId = "20000000-0000-4000-8000-000000000001";

test("valid APPROVE input passes", () => {
  const parsed = validation.claimReviewFormSchema.parse({ claimId, decision: "APPROVE", reason: "Valid owner proof" });

  assert.equal(parsed.decision, "APPROVE");
});

test("valid REJECT input passes", () => {
  const parsed = validation.claimReviewFormSchema.parse({ claimId, decision: "REJECT", reason: "Evidence mismatch" });

  assert.equal(parsed.decision, "REJECT");
});

test("short reason fails", () => {
  assert.throws(() => validation.claimReviewFormSchema.parse({ claimId, decision: "APPROVE", reason: "no" }), /5-500/);
});

test("invalid decision fails", () => {
  assert.throws(() => validation.claimReviewFormSchema.parse({ claimId, decision: "HOLD", reason: "Valid reason" }), /Keputusan/);
});

test("invalid claim UUID fails", () => {
  assert.throws(() => validation.claimReviewFormSchema.parse({ claimId: "bad-id", decision: "REJECT", reason: "Valid reason" }), /ID klaim/);
});

test("overdue helper works at three-day threshold", () => {
  const now = new Date("2026-06-15T12:00:00.000Z");

  assert.equal(validation.isClaimOverdue("2026-06-12T12:00:00.000Z", now), false);
  assert.equal(validation.isClaimOverdue("2026-06-12T11:59:59.000Z", now), true);
});

test("decision-status labels remain correct", () => {
  assert.equal(claims.CLAIM_STATUS_LABELS.APPROVED, "Disetujui");
  assert.equal(claims.CLAIM_STATUS_LABELS.REJECTED, "Ditolak");
});
