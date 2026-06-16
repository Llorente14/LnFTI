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

const relevance = loadModule("src/lib/realtime/event-relevance.ts");
const constants = loadModule("src/lib/realtime/constants.ts");
const debounce = loadModule("src/lib/realtime/debounce.ts");

test("claim INSERT is relevant to admin claim queue", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "INSERT",
    table: "claims",
    new: { claim_status: "PENDING" },
  }, "admin-claim-queue"), true);
});

test("claim UPDATE is relevant to claimant refresh", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "UPDATE",
    table: "claims",
    new: { claim_status: "COMPLETED" },
  }, "claimant-claims"), true);
});

test("report review transition is relevant to admin report refresh", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "UPDATE",
    table: "reports",
    new: { report_status: "PUBLISHED" },
  }, "admin-report-queue"), true);
});

test("resolved report is ignored by the report review queue", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "UPDATE",
    table: "reports",
    new: { report_status: "RESOLVED" },
  }, "admin-report-queue"), false);
});

test("handover INSERT is relevant to claimant and admin handover refresh", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "INSERT",
    table: "handovers",
    new: { id: "handover-id" },
  }, "always"), true);
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "INSERT",
    table: "handovers",
    new: { id: "handover-id" },
  }, "admin-handover-queue"), true);
});

test("unrelated status is ignored where applicable", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "UPDATE",
    table: "reports",
    new: { report_status: "DRAFT", custody_status: "UNKNOWN" },
  }, "admin-handover-queue"), false);
});

test("DELETE event is ignored", () => {
  assert.equal(relevance.isRealtimePayloadRelevant({
    eventType: "DELETE",
    table: "claims",
    old: { claim_status: "PENDING" },
  }, "admin-claim-queue"), false);
});

test("debounce coalesces repeated refresh requests", () => {
  let callbackCount = 0;
  let lastCallback = null;
  let clearedCount = 0;
  let nextTimerId = 0;
  const timers = {
    setTimeout(callback) {
      lastCallback = callback;
      nextTimerId += 1;
      return nextTimerId;
    },
    clearTimeout() {
      clearedCount += 1;
    },
  };
  const debouncer = debounce.createRefreshDebouncer(() => {
    callbackCount += 1;
  }, 400, timers);

  debouncer.schedule();
  debouncer.schedule();
  assert.equal(clearedCount, 1);
  assert.equal(debouncer.hasPending(), true);
  lastCallback();
  assert.equal(callbackCount, 1);
  assert.equal(debouncer.hasPending(), false);
});

test("channel configuration uses row and workflow status filters", () => {
  const userId = "53522000-0000-4000-8000-000000000001";
  const myClaims = constants.buildMyClaimsRealtimeConfig(userId);
  const claimDetail = constants.buildAdminClaimDetailRealtimeConfig(
    "22000000-0000-4000-8000-000000000001",
    "22000000-0000-4000-8000-000000000002",
  );
  const reportQueue = constants.buildAdminReportQueueRealtimeConfig();
  const handoverQueue = constants.buildAdminHandoverQueueRealtimeConfig();

  assert.equal(myClaims.channelName, `my-claims-status-${userId}`);
  assert.deepEqual(myClaims.subscriptions.map((item) => [item.table, item.event, item.filter]), [
    ["claims", "UPDATE", undefined],
    ["handovers", "INSERT", `recipient_id=eq.${userId}`],
  ]);
  assert.ok(claimDetail.subscriptions.some((item) => item.table === "reports" && item.filter === "id=eq.22000000-0000-4000-8000-000000000002"));
  assert.ok(reportQueue.subscriptions.every((item) => item.filter === "report_status=in.(PENDING_REVIEW,PUBLISHED,REJECTED)"));
  assert.ok(handoverQueue.subscriptions.some((item) => item.table === "claims" && item.filter === "claim_status=in.(APPROVED,COMPLETED)"));
  assert.ok(handoverQueue.subscriptions.some((item) => item.table === "reports" && item.filter === "report_status=in.(MATCHING,RESOLVED)"));
  assert.equal(claimDetail.subscriptions.some((item) => item.event === "*"), false);
});

test("boundary cleanup removes created channel and clears pending debounce", () => {
  const boundary = readFileSync("src/components/realtime/realtime-refresh-boundary.tsx", "utf8");

  assert.match(boundary, /debouncer\.cancel\(\)/);
  assert.match(boundary, /removeChannel\(channel\)/);
  assert.doesNotMatch(boundary, /removeAllChannels/);
});

test("boundary authenticates realtime before subscribing", () => {
  const boundary = readFileSync("src/components/realtime/realtime-refresh-boundary.tsx", "utf8");

  assert.match(boundary, /auth\.getSession\(\)/);
  assert.match(boundary, /realtime\.setAuth\(data\.session\.access_token\)/);
});
