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

function loadModule(path, customRequire = require) {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", transpile(path));

  evaluateModule(moduleRecord.exports, moduleRecord, customRequire);

  return moduleRecord.exports;
}

const constants = loadModule("src/lib/reports/constants.ts");
const filters = loadModule("src/lib/reports/public-filters.ts", (specifier) => {
  if (specifier === "@/lib/reports/constants") {
    return constants;
  }

  return require(specifier);
});

test("valid filter parameters are accepted", () => {
  const parsed = filters.parsePublicReportFilters({
    q: "dompet",
    type: "LOST",
    category: "Dompet",
    status: "PUBLISHED",
    date_from: "2026-01-01",
    date_to: "2026-01-31",
    page: "2",
  });

  assert.equal(parsed.isValid, true);
  assert.equal(parsed.type, "LOST");
  assert.equal(parsed.category, "Dompet");
  assert.equal(parsed.page, 2);
});

test("unknown report type is rejected safely", () => {
  const parsed = filters.parsePublicReportFilters({ type: "PRIVATE" });

  assert.equal(parsed.isValid, false);
  assert.equal(parsed.type, "");
});

test("unknown category is rejected safely", () => {
  const parsed = filters.parsePublicReportFilters({ category: "Rahasia" });

  assert.equal(parsed.isValid, false);
  assert.equal(parsed.category, "");
});

test("invalid date range is rejected", () => {
  const parsed = filters.parsePublicReportFilters({
    date_from: "2026-02-01",
    date_to: "2026-01-01",
  });

  assert.equal(parsed.isValid, false);
});

test("search input is trimmed and length-limited", () => {
  const parsed = filters.parsePublicReportFilters({
    q: `  ${"dompet_%(),".repeat(20)}  `,
  });

  assert.ok(parsed.q.length <= filters.MAX_SEARCH_LENGTH);
  assert.doesNotMatch(parsed.q, /[%_,()]/);
});

test("pagination below 1 becomes page 1", () => {
  assert.equal(filters.parsePublicReportFilters({ page: "-10" }).page, 1);
  assert.equal(filters.parsePublicReportFilters({ page: "0" }).page, 1);
});

test("pagination preserves filters in generated links", () => {
  const parsed = filters.parsePublicReportFilters({
    q: "dompet",
    type: "FOUND",
    category: "Dompet",
    page: "2",
  });

  assert.equal(
    filters.buildReportsHref(parsed, { page: 3 }),
    "/reports?q=dompet&type=FOUND&category=Dompet&page=3",
  );
});

test("invalid report UUID is rejected before querying", () => {
  assert.equal(filters.isValidReportId("not-a-uuid"), false);
  assert.equal(filters.isValidReportId("2d2d0000-0000-0000-0000-000000000017"), true);
});
