import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/lib/admin/claim-review.ts", "utf8");

test("category filtering uses an inner report join", () => {
  assert.equal(source.includes("claims_report_id_fkey!inner"), true);
  assert.equal(source.includes('eq("report.category", filters.category)'), true);
});

test("overdue filtering is applied before pagination", () => {
  const overdueFilter = source.indexOf('lt("created_at", claimOverdueCutoffIso())');
  const pagination = source.indexOf('range(from, to)');

  assert.notEqual(overdueFilter, -1);
  assert.notEqual(pagination, -1);
  assert.equal(overdueFilter < pagination, true);
});

test("dashboard recent activity requests newest-first ordering", () => {
  assert.equal(source.includes('getPendingClaims({ status: "ALL", page: 1, order: "newest" })'), true);
});

test("dashboard overdue count is not limited to one page", () => {
  assert.equal(source.includes("countOverduePendingClaims()"), true);
  assert.equal(source.includes("pendingForOverdue.claims.filter"), false);
});
