import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { chromium, expect } from "@playwright/test";

import { queryCount, queryOne, queryOptional, withDatabase } from "./helpers/integration-db.mjs";
import { isMvpIntegrationEnabled, requireLocalIntegrationEnv } from "./helpers/integration-env.mjs";
import {
  confirmAndVerifyTestUser,
  createInstitutionalIdentity,
  loginThroughUi,
  setTestUserRole,
  signUpTestUser,
} from "./helpers/integration-users.mjs";

const maybeTest = isMvpIntegrationEnabled() ? test : test.skip;
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

function datetimeLocalOneHourAgo() {
  const value = new Date(Date.now() - 60 * 60 * 1000);
  const offsetMs = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}

async function waitForReport(client, itemName) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    const report = await queryOptional(
      client,
      `
        select
          reports.*,
          auth.users.email as reporter_email,
          count(report_images.id)::int as image_count,
          min(report_images.storage_path) as storage_path
        from public.reports
        join auth.users on users.id = reports.reporter_id
        left join public.report_images on report_images.report_id = reports.id
        where reports.item_name = $1
        group by reports.id, auth.users.email
      `,
      [itemName],
    );

    if (report) {
      return report;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("MVP report was not persisted.");
}

async function assertPwaSmoke(appUrl) {
  for (const pathname of ["/manifest.webmanifest", "/offline", "/sw.js"]) {
    const response = await fetch(`${appUrl}${pathname}`);
    assert.equal(response.ok, true, `${pathname} should respond successfully`);
  }

  const serviceWorker = await fetch(`${appUrl}/sw.js`).then((response) => response.text());
  assert.doesNotMatch(serviceWorker, /\/admin|\/me\/claims|\/report\/new/);
}

async function assertFakeAiReady(env) {
  const ready = await fetch(`${env.aiServiceUrl}/ready`);
  assert.equal(ready.ok, true, "fake AI service must expose readiness");

  const body = new FormData();
  body.set("file", new Blob([ONE_PIXEL_PNG], { type: "image/png" }), "fixture.png");
  const unauthorized = await fetch(`${env.aiServiceUrl}/api/v1/images/detect`, {
    method: "POST",
    headers: { Authorization: "Bearer invalid-token" },
    body,
  });
  assert.equal(unauthorized.status, 401);
}

maybeTest("complete MVP flow verifies report, AI, claim, handover, public privacy, and PWA smoke", { timeout: 180_000 }, async (t) => {
  const env = requireLocalIntegrationEnv();
  const finder = createInstitutionalIdentity("Finder", "535");
  const claimant = createInstitutionalIdentity("Claimant", "825");
  const verifier = createInstitutionalIdentity("Verifier", "535");
  const runId = finder.nim.slice(-4);
  const itemName = `MVP Logitech Mouse ${runId}`;
  const publicDescription = `Mouse wireless hitam ditemukan dekat area belajar FTI ${runId}. Aman dilihat publik.`;
  const initialPrivate = `Stiker privat MVP ${runId}`;
  const ocrBlock = "LOGITECH\nM331";
  const claimEvidence = `Bukti privat klaim ${runId}: dongle tersimpan di pouch biru dan ada gores kecil dekat tombol samping.`;
  const handoverLocation = `Pos DPM FTI ${runId}`;
  const handoverNote = `Catatan test serah-terima ${runId}`;
  const tmp = await mkdtemp(path.join(tmpdir(), "lnfti-mvp-"));
  const imagePath = path.join(tmp, "fixture.png");
  let browser;

  await writeFile(imagePath, ONE_PIXEL_PNG);

  try {
    await assertFakeAiReady(env);
    await assertPwaSmoke(env.appUrl);

    const actorIds = await withDatabase(env, async (client) => {
      const finderId = await signUpTestUser(env, finder);
      const claimantId = await signUpTestUser(env, claimant);
      const verifierId = await signUpTestUser(env, verifier);

      await confirmAndVerifyTestUser(client, finderId);
      await confirmAndVerifyTestUser(client, claimantId);
      await confirmAndVerifyTestUser(client, verifierId);
      await setTestUserRole(client, verifierId, "verifier");

      return { finderId, claimantId, verifierId };
    });

    browser = await chromium.launch();
    const publicContext = await browser.newContext();
    const finderContext = await browser.newContext();
    const claimantContext = await browser.newContext();
    const verifierContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    const finderPage = await finderContext.newPage();
    const claimantPage = await claimantContext.newPage();
    const verifierPage = await verifierContext.newPage();

    const dialogMessages = [];
    for (const page of [finderPage, claimantPage, verifierPage]) {
      page.on("dialog", (dialog) => {
        dialogMessages.push(dialog.message());
        return dialog.accept();
      });
    }

    await t.test("account access boundaries", async () => {
      await publicPage.goto(`${env.appUrl}/report/new`);
      await publicPage.waitForURL("**/login?next=%2Freport%2Fnew");

      await loginThroughUi(finderPage, env, finder, "/report/new");
      await finderPage.getByRole("heading", { name: "Laporkan barang hilang atau temuan" }).waitFor();

      await loginThroughUi(claimantPage, env, claimant, "/me/claims");
      await claimantPage.getByRole("heading", { name: "Klaim saya" }).waitFor();

      const studentAdminResponse = await finderPage.goto(`${env.appUrl}/admin`);
      assert.equal(studentAdminResponse?.status(), 404);

      await loginThroughUi(verifierPage, env, verifier, "/admin");
      await verifierPage.getByRole("heading", { name: "Dashboard verifier" }).waitFor();
    });

    let report;
    await t.test("finder submits FOUND report with explicit AI suggestions", async () => {
      await finderPage.goto(`${env.appUrl}/report/new?type=FOUND`);
      await finderPage.getByText("Barang temuan").click();
      await finderPage.getByLabel("Nama barang").fill(itemName);
      await finderPage.getByLabel("Kategori").selectOption("Lainnya");
      await finderPage.getByLabel("Deskripsi publik").fill(publicDescription);
      await finderPage.getByLabel("Ciri privat kepemilikan").fill(initialPrivate);
      await finderPage.getByLabel("Kampus").fill("Kampus 1");
      await finderPage.getByLabel("Gedung").fill("Gedung R");
      await finderPage.getByLabel("Detail lokasi").fill(`Meja baca lantai 3 ${runId}`);
      await finderPage.getByLabel("Waktu kejadian").fill(datetimeLocalOneHourAgo());
      await finderPage.locator('input[type="file"]').setInputFiles(imagePath);
      await expect(finderPage.getByText("Kategori saran")).toHaveCount(0);
      await expect(finderPage.getByLabel("Kategori")).toHaveValue("Lainnya");

      await finderPage.getByRole("button", { name: "Analisis AI" }).click();
      await finderPage.getByText("Kategori saran").waitFor();
      const analysisPanel = finderPage.locator('[aria-live="polite"]').filter({ hasText: "Kategori saran" });
      await analysisPanel.getByText("Elektronik", { exact: true }).waitFor();
      await analysisPanel.getByText("laptop - 93%").waitFor();
      await analysisPanel.getByText("LOGITECH - 96%").waitFor();
      await analysisPanel.getByText("M331 - 92%").waitFor();
      await expect(finderPage.getByLabel("Kategori")).toHaveValue("Lainnya");
      await expect(finderPage.getByLabel("Ciri privat kepemilikan")).not.toHaveValue(/LOGITECH/);

      await finderPage.getByRole("button", { name: "Gunakan kategori Elektronik" }).click();
      await expect(finderPage.getByLabel("Kategori")).toHaveValue("Elektronik");
      await finderPage.getByRole("button", { name: "Tambahkan ke ciri privat" }).click();
      await expect(finderPage.getByLabel("Ciri privat kepemilikan")).toHaveValue(/LOGITECH\nM331/);
      await expect(finderPage.getByLabel("Deskripsi publik")).toHaveValue(publicDescription);
      await finderPage.getByLabel("Ciri privat kepemilikan").fill(`${initialPrivate}\n\nTeks terlihat pada foto:\n${ocrBlock}\nDicek manual.`);

      await finderPage.getByRole("button", { name: "Kirim laporan" }).click();
      await finderPage.waitForURL("**/me/reports?created=1");

      report = await withDatabase(env, (client) => waitForReport(client, itemName));
      assert.equal(report.reporter_id, actorIds.finderId);
      assert.equal(report.report_type, "FOUND");
      assert.equal(report.report_status, "PENDING_REVIEW");
      assert.equal(report.category, "Elektronik");
      assert.equal(report.public_description, publicDescription);
      assert.match(report.private_characteristics, /LOGITECH\nM331/);
      assert.equal(report.image_count, 1);
      assert.ok(report.storage_path.startsWith(`${report.id}/`));
      assert.equal(report.storage_path.includes(actorIds.finderId), false);
    });

    await t.test("database stores no raw AI metadata", async () => {
      await withDatabase(env, async (client) => {
        const aiColumnCount = await queryCount(
          client,
          `
            select count(*)
            from information_schema.columns
            where table_schema = 'public'
              and table_name in ('reports', 'report_images')
              and column_name ~ '(model|inference|ocr|confidence|full_text|detection)'
          `,
        );
        assert.equal(aiColumnCount, 0);
      });
    });

    await t.test("verifier approves report and public view stays private", async () => {
      await verifierPage.goto(`${env.appUrl}/admin/reports`);
      await verifierPage.getByText(itemName).waitFor();
      await verifierPage.locator("article").filter({ hasText: itemName }).getByRole("link", { name: "Review" }).click();
      await verifierPage.getByRole("heading", { name: itemName }).waitFor();
      await verifierPage.getByText(initialPrivate).waitFor();
      await verifierPage.locator("#review-reason").fill(`Laporan valid untuk MVP ${runId}`);
      await verifierPage.getByRole("button", { name: "Setujui" }).click();
      await verifierPage.getByText("Laporan disetujui dan dipublikasikan.").waitFor();

      const published = await withDatabase(env, async (client) => queryOne(
        client,
        `
          select report_status::text, published_at, reviewed_by
          from public.reports
          where id = $1
        `,
        [report.id],
      ));
      assert.equal(published.report_status, "PUBLISHED");
      assert.ok(published.published_at);
      assert.equal(published.reviewed_by, actorIds.verifierId);

      await publicPage.goto(`${env.appUrl}/reports?q=${encodeURIComponent(itemName)}`);
      await publicPage.getByText(itemName).waitFor();
      await publicPage.getByRole("link", { name: new RegExp(itemName) }).click();
      await publicPage.getByRole("heading", { name: itemName }).waitFor();
      await publicPage.getByText("Elektronik").waitFor();
      await publicPage.getByText(publicDescription).waitFor();
      await publicPage.locator("img").first().waitFor();
      await expect(publicPage.locator("body")).not.toContainText(initialPrivate);
      await expect(publicPage.locator("body")).not.toContainText("LOGITECH");
      await expect(publicPage.locator("body")).not.toContainText(finder.email);
      await expect(publicPage.locator("body")).not.toContainText(finder.nim);
      await expect(publicPage.locator("body")).not.toContainText(report.storage_path);
    });

    let claim;
    await t.test("claimant submits claim and verifier approval reaches claimant page by Realtime", async () => {
      await claimantPage.goto(`${env.appUrl}/reports/${report.id}`);
      await claimantPage.getByLabel("Bukti kepemilikan privat").fill(claimEvidence);
      await claimantPage.getByRole("button", { name: "Ajukan klaim" }).click();
      await claimantPage.getByRole("button", { name: "Konfirmasi kirim klaim" }).click();
      await claimantPage.waitForURL("**/me/claims?created=1");
      await claimantPage.getByText("Klaim berhasil dikirim").waitFor();
      await claimantPage.getByText(claimEvidence).waitFor();

      claim = await withDatabase(env, async (client) => queryOne(
        client,
        `
          select id, report_id, claimant_id, claim_status::text
          from public.claims
          where report_id = $1 and claimant_id = $2
        `,
        [report.id, actorIds.claimantId],
      ));
      assert.equal(claim.claim_status, "PENDING");

      await finderPage.goto(`${env.appUrl}/reports/${report.id}`);
      await expect(finderPage.locator("body")).not.toContainText(claimEvidence);

      await verifierPage.goto(`${env.appUrl}/admin/claims`);
      await verifierPage.getByText(itemName).waitFor();
      await verifierPage.locator("article").filter({ hasText: itemName }).getByRole("link", { name: "Review" }).click();
      await verifierPage.getByRole("heading", { name: itemName }).waitFor();
      await verifierPage.getByText(claimEvidence).waitFor();
      await verifierPage.getByLabel("Alasan keputusan").fill(`Bukti privat cocok untuk MVP ${runId}`);
      await verifierPage.getByRole("button", { name: "Setujui" }).click();
      await verifierPage.getByText("Klaim disetujui dan laporan masuk proses pencocokan.").waitFor();

      await claimantPage.getByText("Klaim disetujui. Serah-terima fisik belum selesai", { exact: false }).waitFor({ timeout: 30_000 });

      const approved = await withDatabase(env, async (client) => queryOne(
        client,
        `
          select
            claims.claim_status::text,
            claims.decided_by,
            claims.decided_at,
            reports.report_status::text,
            reports.custody_status::text,
            (select count(*)::int from public.handovers where claim_id = claims.id) as handover_count
          from public.claims
          join public.reports on reports.id = claims.report_id
          where claims.id = $1
        `,
        [claim.id],
      ));
      assert.equal(approved.claim_status, "APPROVED");
      assert.equal(approved.decided_by, actorIds.verifierId);
      assert.ok(approved.decided_at);
      assert.equal(approved.report_status, "MATCHING");
      assert.notEqual(approved.custody_status, "HANDED_OVER");
      assert.equal(approved.handover_count, 0);
    });

    await t.test("verifier completes transactional handover and claimant sees completion by Realtime", async () => {
      await verifierPage.goto(`${env.appUrl}/admin/claims/${claim.id}`);
      await verifierPage.getByLabel("Lokasi serah-terima").fill(handoverLocation);
      await verifierPage.getByLabel("Catatan serah-terima (opsional)").fill(handoverNote);
      await verifierPage.getByRole("button", { name: "Selesaikan serah-terima" }).click();
      assert.ok(dialogMessages.some((message) =>
        message.includes("menyelesaikan klaim")
        && message.includes("menyelesaikan laporan")
        && message.includes("custody HANDED_OVER")
      ));
      await verifierPage.getByText("Serah-terima selesai, klaim ditutup, dan laporan telah diselesaikan.").waitFor();

      await claimantPage.getByText("Barang sudah diserahkan kepada Anda.").waitFor({ timeout: 30_000 });
      await claimantPage.getByText(handoverLocation).waitFor();
      await claimantPage.getByText(handoverNote).waitFor();

      const finalState = await withDatabase(env, async (client) => queryOne(
        client,
        `
          select
            reports.report_type::text,
            reports.report_status::text,
            reports.custody_status::text,
            reports.resolved_at,
            claims.claim_status::text,
            claims.decided_by,
            handovers.report_id,
            handovers.id as handover_id,
            handovers.claim_id,
            handovers.recipient_id,
            handovers.verifier_id,
            handovers.handover_at,
            handovers.handover_location,
            (select count(*)::int from public.handovers where report_id = reports.id) as report_handover_count,
            (select count(*)::int from public.handovers where claim_id = claims.id) as claim_handover_count
          from public.reports
          join public.claims on claims.report_id = reports.id
          join public.handovers on handovers.claim_id = claims.id
          where reports.id = $1 and claims.id = $2
        `,
        [report.id, claim.id],
      ));
      assert.equal(finalState.report_type, "FOUND");
      assert.equal(finalState.report_status, "RESOLVED");
      assert.equal(finalState.custody_status, "HANDED_OVER");
      assert.ok(finalState.resolved_at);
      assert.equal(finalState.claim_status, "COMPLETED");
      assert.equal(finalState.decided_by, actorIds.verifierId);
      assert.equal(finalState.report_id, report.id);
      assert.ok(finalState.handover_id);
      assert.equal(finalState.claim_id, claim.id);
      assert.equal(finalState.recipient_id, actorIds.claimantId);
      assert.equal(finalState.verifier_id, actorIds.verifierId);
      assert.ok(finalState.handover_at);
      assert.equal(finalState.handover_location, handoverLocation);
      assert.equal(finalState.report_handover_count, 1);
      assert.equal(finalState.claim_handover_count, 1);
    });

    await t.test("final public state and audit invariants", async () => {
      await publicPage.goto(`${env.appUrl}/reports?q=${encodeURIComponent(itemName)}`);
      await publicPage.getByText("Belum ada laporan yang cocok.").waitFor();
      const detailResponse = await publicPage.goto(`${env.appUrl}/reports/${report.id}`);
      assert.equal(detailResponse?.status(), 404);
      await expect(publicPage.locator("body")).not.toContainText(claimEvidence);
      await expect(publicPage.locator("body")).not.toContainText(handoverLocation);
      await expect(publicPage.locator("body")).not.toContainText(handoverNote);
      await expect(publicPage.locator("body")).not.toContainText(claimant.email);

      await withDatabase(env, async (client) => {
        const auditRows = await client.query(
          `
            select action, before_data::text as before_text, after_data::text as after_text, metadata::text as metadata_text
            from public.audit_logs
            where entity_id in ($1, $2, (
              select id
              from public.handovers
              where report_id = $1 and claim_id = $2
            ))
          `,
          [report.id, claim.id],
        );
        const actions = auditRows.rows.map((row) => row.action);
        for (const action of [
          "REPORT_REVIEW_APPROVED",
          "CLAIM_APPROVED",
          "REPORT_MATCHING_STARTED",
          "HANDOVER_COMPLETED",
          "CLAIM_COMPLETED",
          "REPORT_RESOLVED_BY_HANDOVER",
        ]) {
          assert.ok(actions.includes(action), `missing audit action ${action}`);
        }
        assert.equal(actions.filter((action) => action === "HANDOVER_COMPLETED").length, 1);

        const auditText = auditRows.rows.map((row) => `${row.before_text}\n${row.after_text}\n${row.metadata_text}`).join("\n");
        assert.doesNotMatch(auditText, new RegExp(claimEvidence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.doesNotMatch(auditText, /LOGITECH/);
      });
    });
  } finally {
    if (browser) {
      await browser.close();
    }
    await rm(tmp, { recursive: true, force: true });
  }
});
