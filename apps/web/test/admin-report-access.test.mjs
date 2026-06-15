import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const queuePage = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const detailPage = readFileSync("src/app/admin/reports/[id]/page.tsx", "utf8");
const actions = readFileSync("src/app/admin/reports/[id]/actions.ts", "utf8");

test("verifier report queue requires verifier or admin role", () => {
  const guardCall = 'await requireRole(["verifier", "admin"], "/admin/reports")';
  const queryCall = "const result = await getPendingReviewReports";

  assert.ok(queuePage.includes(guardCall));
  assert.ok(queuePage.indexOf(guardCall) < queuePage.indexOf(queryCall));
});

test("verifier report detail requires role before private queries", () => {
  const guardCall = 'await requireRole(["verifier", "admin"], `/admin/reports/${id}`)';
  const queryCall = "getVerifierReportDetail(normalizedId)";

  assert.ok(detailPage.includes(guardCall));
  assert.ok(detailPage.indexOf(guardCall) < detailPage.indexOf(queryCall));
});

test("review and custody mutations invalidate public report pages", () => {
  assert.ok(actions.includes("function revalidatePublicReport(reportId: string)"));
  assert.ok(actions.includes('revalidatePath("/reports")'));
  assert.ok(actions.includes('revalidatePath(`/reports/${reportId}`)'));
  assert.equal(actions.split("revalidatePublicReport(reportId);").length - 1, 2);
});
