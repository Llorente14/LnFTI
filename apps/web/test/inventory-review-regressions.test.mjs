import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importActions = readFileSync("src/app/admin/inventory/import/actions.ts", "utf8");
const exportActions = readFileSync("src/app/admin/inventory/export/actions.ts", "utf8");
const downloadRoute = readFileSync("src/app/admin/inventory/export/[jobId]/download/route.ts", "utf8");
const reviewMigration = readFileSync("../../supabase/migrations/20260617120000_inventory_import_export_review_fixes.sql", "utf8");

test("duplicate import cleanup removes an unused permanent image", () => {
  assert.match(importActions, /result\.validation_status === "SKIPPED"/);
  assert.match(importActions, /removeStorageObjects\(supabase, "report-images", \[permanentItemPath\]\)/);
});

test("commit rows are bound to the submitted import job", () => {
  assert.match(importActions, /\.eq\("import_job_id", jobId\)/);
});

test("export range starts at Jakarta midnight and CSV skips binary image downloads", () => {
  assert.match(exportActions, /`\$\{from\}T00:00:00\+07:00`/);
  assert.match(exportActions, /format === "XLSX" && itemImagePath/);
});

test("expired download removes the private object before marking the job expired", () => {
  const removeIndex = downloadRoute.indexOf(".remove([job.storage_path])");
  const expireIndex = downloadRoute.indexOf('status: "EXPIRED"');
  assert.ok(removeIndex >= 0 && expireIndex > removeIndex);
});

test("review migration hardens dedupe, mappings, audit, and avoids direct storage metadata deletion", () => {
  assert.match(reviewMigration, /inventory_import_rows_imported_fingerprint_uidx/);
  assert.match(reviewMigration, /normalized inventory mapping mismatch/);
  assert.match(reviewMigration, /unsupported inventory audit entity/);
  assert.doesNotMatch(reviewMigration, /delete\s+from\s+storage\.objects/i);
});
