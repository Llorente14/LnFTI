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

const validation = loadModule("src/lib/admin/handover-validation.ts");
const claimId = "21100000-0000-4000-8000-000000000001";

test("valid handover form passes and trims fields", () => {
  const parsed = validation.handoverFormSchema.parse({
    claimId,
    handoverLocation: "  Pos DPM FTI  ",
    notes: "  Identitas sudah dicek  ",
  });

  assert.equal(parsed.handoverLocation, "Pos DPM FTI");
  assert.equal(parsed.notes, "Identitas sudah dicek");
});

test("location below 3 characters fails", () => {
  assert.throws(() => validation.handoverFormSchema.parse({ claimId, handoverLocation: "No", notes: "" }), /3-200/);
});

test("location above 200 characters fails", () => {
  assert.throws(() => validation.handoverFormSchema.parse({ claimId, handoverLocation: "x".repeat(201), notes: "" }), /3-200/);
});

test("notes above 1000 characters fail", () => {
  assert.throws(() => validation.handoverFormSchema.parse({ claimId, handoverLocation: "Pos DPM", notes: "x".repeat(1001) }), /1000/);
});

test("invalid claim UUID fails", () => {
  assert.throws(() => validation.handoverFormSchema.parse({ claimId: "bad-id", handoverLocation: "Pos DPM", notes: "" }), /ID klaim/);
});

test("eligibility helper accepts approved matching found claim for verified claimant", () => {
  assert.equal(validation.isHandoverEligible({
    claimStatus: "APPROVED",
    reportType: "FOUND",
    reportStatus: "MATCHING",
    custodyStatus: "AT_DPM",
    claimantVerificationStatus: "VERIFIED",
    hasHandover: false,
  }), true);
});

test("eligibility helper rejects unverified claimant", () => {
  assert.equal(validation.isHandoverEligible({
    claimStatus: "APPROVED",
    reportType: "FOUND",
    reportStatus: "MATCHING",
    custodyStatus: "AT_DPM",
    claimantVerificationStatus: "UNVERIFIED",
    hasHandover: false,
  }), false);
});

test("eligibility helper rejects non-approved or completed states", () => {
  assert.equal(validation.isHandoverEligible({
    claimStatus: "PENDING",
    reportType: "FOUND",
    reportStatus: "MATCHING",
    custodyStatus: "AT_DPM",
    claimantVerificationStatus: "VERIFIED",
    hasHandover: false,
  }), false);
  assert.equal(validation.isHandoverEligible({
    claimStatus: "COMPLETED",
    reportType: "FOUND",
    reportStatus: "RESOLVED",
    custodyStatus: "HANDED_OVER",
    claimantVerificationStatus: "VERIFIED",
    hasHandover: true,
  }), false);
});
