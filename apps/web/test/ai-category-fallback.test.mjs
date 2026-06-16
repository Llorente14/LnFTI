import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schemasSource = readFileSync("src/lib/ai/schemas.ts", "utf8");
const normalizeFunction = schemasSource.match(
  /export function normalizeYoloResponse\([\s\S]*?^}/m,
)?.[0] ?? "";

test("mouse detection aliases map to Elektronik", () => {
  for (const label of ["mouse", "computer mouse", "wireless mouse", "optical mouse", "gaming mouse"]) {
    assert.ok(schemasSource.includes(`${JSON.stringify(label)}: "Elektronik"`));
  }
});

test("YOLO normalization falls back to ordered detection labels only when suggestion is empty", () => {
  assert.match(normalizeFunction, /shouldUseLabelFallback/);
  assert.match(normalizeFunction, /parsed\.suggested_category === null/);
  assert.match(normalizeFunction, /parsed\.suggested_category\.trim\(\) === ""/);
  assert.match(normalizeFunction, /deriveSuggestedCategory\(detections\.map/);
  assert.match(schemasSource, /mapDetectionLabelToReportCategory/);
  assert.match(schemasSource, /replace\(\/\[_-\]\+\/g, " "\)/);
});

test("valid upstream category remains preferred over label fallback", () => {
  assert.match(normalizeFunction, /upstreamSuggestedCategory\.success/);
  assert.match(normalizeFunction, /upstreamSuggestedCategory\.data/);
  assert.match(normalizeFunction, /deriveSuggestedCategory/);
  assert.ok(
    normalizeFunction.indexOf("upstreamSuggestedCategory.data")
      < normalizeFunction.indexOf("deriveSuggestedCategory"),
  );
});

test("unknown non-empty upstream category remains discarded", () => {
  assert.match(normalizeFunction, /: null,/);
});
