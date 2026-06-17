import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const importActions = readFileSync("src/app/admin/inventory/import/actions.ts", "utf8");
const exportServer = readFileSync("src/lib/inventory-export/server.ts", "utf8");
const parser = readFileSync("src/lib/inventory-import/workbook-parser.ts", "utf8");
const normalizer = readFileSync("src/lib/inventory-import/row-normalizer.ts", "utf8");
const cleanupRoute = readFileSync("src/app/admin/inventory/cleanup/route.ts", "utf8");
const reviewMigration = readFileSync("../../supabase/migrations/20260617120000_inventory_import_export_review_fixes.sql", "utf8");
const integrityMigration = readFileSync("../../supabase/migrations/20260617121000_inventory_import_export_integrity.sql", "utf8");

test("import commit is job-bound and removes unused permanent images", () => {
  assert.match(importActions, /\.eq\("import_job_id", jobId\)/);
  assert.match(importActions, /result\.validation_status === "SKIPPED"/);
  assert.match(importActions, /removeStorageObjects\(supabase, "report-images", \[permanentItemPath\]\)/);
  assert.match(importActions, /markImportRowFailed/);
});

test("parser and editable normalizer fingerprint normalized DPM status", () => {
  assert.match(parser, /rawStatus: normalizedRawStatus/);
  assert.match(normalizer, /rawStatus: normalizedRawStatus/);
});

test("export respects Jakarta day boundaries and skips CSV binary downloads", () => {
  assert.match(exportServer, /`\$\{from\}T00:00:00\+07:00`/);
  assert.match(exportServer, /format === "XLSX" && itemImagePath/);
  assert.match(exportServer, /pickupEvidenceMetadata/);
});

test("database validates fingerprints, mappings, audit calls, and counters", () => {
  assert.match(reviewMigration, /inventory_import_rows_imported_fingerprint_uidx/);
  assert.match(reviewMigration, /normalized inventory mapping mismatch/);
  assert.match(reviewMigration, /unsupported inventory audit entity/);
  assert.match(integrityMigration, /inventory row fingerprint mismatch/);
  assert.match(integrityMigration, /create constraint trigger inventory_import_rows_reconcile_job/);
  assert.match(integrityMigration, /failed_rows = failed_count/);
});

test("expiry cleanup uses Storage API and does not delete storage metadata directly", () => {
  assert.match(cleanupRoute, /inventory_pickup_evidence/);
  assert.match(cleanupRoute, /preservedEvidence/);
  assert.match(cleanupRoute, /\.from\(INVENTORY_IMPORT_BUCKET\)\.remove\(stagingPaths\)/);
  assert.match(cleanupRoute, /\.from\(INVENTORY_EXPORT_BUCKET\)\.remove\(paths\)/);
  assert.doesNotMatch(reviewMigration, /delete\s+from\s+storage\.objects/i);
  assert.doesNotMatch(integrityMigration, /delete\s+from\s+storage\.objects/i);
});
