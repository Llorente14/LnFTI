import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const parser = readFileSync("src/lib/inventory-import/workbook-parser.ts", "utf8");
const normalizer = readFileSync("src/lib/inventory-import/row-normalizer.ts", "utf8");
const cleanupRoute = readFileSync("src/app/admin/inventory/cleanup/route.ts", "utf8");
const integrityMigration = readFileSync("../../supabase/migrations/20260617121000_inventory_import_export_integrity.sql", "utf8");

test("parser and editable normalizer fingerprint the normalized DPM status", () => {
  assert.match(parser, /rawStatus: normalizedRawStatus/);
  assert.match(normalizer, /rawStatus: normalizedRawStatus/);
});

test("database validates fingerprints and reconciles job counters after row changes", () => {
  assert.match(integrityMigration, /inventory row fingerprint mismatch/);
  assert.match(integrityMigration, /create constraint trigger inventory_import_rows_reconcile_job/);
  assert.match(integrityMigration, /failed_rows = failed_count/);
});

test("storage cleanup uses the Storage API and preserves imported pickup evidence", () => {
  assert.match(cleanupRoute, /inventory_pickup_evidence/);
  assert.match(cleanupRoute, /preservedEvidence/);
  assert.match(cleanupRoute, /\.storage\.from\(INVENTORY_IMPORT_BUCKET\)\.remove\(paths\)/);
  assert.match(cleanupRoute, /\.storage\.from\(INVENTORY_EXPORT_BUCKET\)\.remove\(paths\)/);
});

test("expiry SQL never deletes storage metadata directly", () => {
  assert.doesNotMatch(integrityMigration, /delete\s+from\s+storage\.objects/i);
  assert.match(integrityMigration, /storage_cleanup/);
});
