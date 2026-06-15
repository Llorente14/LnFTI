import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const queuePage = readFileSync("src/app/admin/reports/page.tsx", "utf8");
const detailPage = readFileSync("src/app/admin/reports/[id]/page.tsx", "utf8");
const actions = readFileSync("src/app/admin/reports/[id]/actions.ts", "utf8");

test("verifier report queue requires verifier or admin role", () => {
  assert.match(queuePage, /requireRole\(\["verifier", "admin"\], "\/admin\/reports"\)/);
  assert.ok(
    queuePage.indexOf("requireRole") < queuePage.indexOf("getPendingReviewReports"),
    "role guard must run before querying the verifier queue",
  );
});

test("verifier report detail requires role before private queries", () => {
  assert.match(detailPage, /requireRole\(\["verifier", "admin"\], `\/admin\/reports\/\$\{id\}`\)/);
  assert.ok(
    detailPage.indexOf("await requireRole") < detailPage.indexOf("getVerifierReportDetail(normalizedId)"),
    "role guard must run before reading private report detail",
  );
});

test("review and custody mutations invalidate public report pages", () => {
  assert.match(actions, /function revalidatePublicReport\(reportId: string\)/);
  assert.match(actions, /revalidatePath\("\/reports"\)/);
  assert.match(actions, /revalidatePath\(`\/reports\/\$\{reportId\}`\)/);
  assert.equal((actions.match(/revalidatePublicReport\(reportId\);/g) ?? []).length, 2);
});
