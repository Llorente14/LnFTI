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

const validation = loadModule("src/lib/admin/report-review-validation.ts");
const reportId = "18000000-0000-4000-8000-000000000001";

test("decision schema accepts valid approval", () => {
  const parsed = validation.reportReviewSchema.parse({
    reportId,
    decision: "APPROVE",
    reason: "Looks valid",
  });

  assert.equal(parsed.decision, "APPROVE");
});

test("decision schema accepts valid rejection", () => {
  const parsed = validation.reportReviewSchema.parse({
    reportId,
    decision: "REJECT",
    reason: "Missing detail",
  });

  assert.equal(parsed.decision, "REJECT");
});

test("short reason is rejected", () => {
  assert.throws(
    () => validation.reportReviewSchema.parse({ reportId, decision: "APPROVE", reason: "no" }),
    /minimal 5/,
  );
});

test("custody values are validated", () => {
  const parsed = validation.custodyStatusSchema.parse({
    reportId,
    currentCustodyStatus: "UNKNOWN",
    newCustodyStatus: "AT_DPM",
    reason: "Stored safely",
  });

  assert.equal(parsed.newCustodyStatus, "AT_DPM");
});

test("no-op custody helper is rejected", () => {
  assert.throws(
    () =>
      validation.custodyStatusSchema.parse({
        reportId,
        currentCustodyStatus: "UNKNOWN",
        newCustodyStatus: "UNKNOWN",
        reason: "Same status",
      }),
    /tidak berubah/,
  );
});

test("invalid report UUID is rejected", () => {
  assert.throws(
    () => validation.reportReviewSchema.parse({ reportId: "not-a-uuid", decision: "APPROVE", reason: "Looks valid" }),
    /ID laporan/,
  );
});
