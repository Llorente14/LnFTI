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

const validation = loadModule("src/lib/claims/validation.ts");
const reportId = "19000000-0000-4000-8000-000000000001";

test("valid 20+ character evidence passes", () => {
  const parsed = validation.ownershipEvidenceSchema.parse("  unique scratch near zipper  ");

  assert.equal(parsed, "unique scratch near zipper");
});

test("whitespace-only evidence fails", () => {
  assert.throws(() => validation.ownershipEvidenceSchema.parse("       "), /minimal 20/);
});

test("evidence below 20 characters fails", () => {
  assert.throws(() => validation.ownershipEvidenceSchema.parse("short private note"), /minimal 20/);
});

test("evidence above 2000 characters fails", () => {
  assert.throws(() => validation.ownershipEvidenceSchema.parse("x".repeat(2001)), /maksimal 2000/i);
});

test("invalid report UUID fails", () => {
  assert.throws(
    () => validation.claimSubmissionSchema.parse({ reportId: "not-a-uuid", ownershipEvidence: "unique scratch near zipper" }),
    /ID laporan/,
  );
});

test("claim status labels map correctly", () => {
  assert.equal(validation.CLAIM_STATUS_LABELS.PENDING, "Menunggu Peninjauan");
  assert.equal(validation.CLAIM_STATUS_LABELS.APPROVED, "Disetujui");
  assert.equal(validation.CLAIM_STATUS_LABELS.COMPLETED, "Selesai");
});

test("only PENDING claims are cancellable", () => {
  assert.equal(validation.isCancellableClaimStatus("PENDING"), true);
  assert.equal(validation.isCancellableClaimStatus("APPROVED"), false);
  assert.equal(validation.isCancellableClaimStatus("CANCELLED"), false);
});

test("internal login-next path is generated safely", () => {
  assert.equal(
    validation.buildClaimLoginHref(reportId),
    `/login?next=${encodeURIComponent(`/reports/${reportId}?claim=1`)}`,
  );
  assert.equal(validation.buildClaimLoginHref("https://evil.example/reports/1"), "/login");
});
