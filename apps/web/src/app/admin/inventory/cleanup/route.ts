import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/server";
import { INVENTORY_EXPORT_BUCKET, INVENTORY_IMPORT_BUCKET } from "@/lib/inventory-import/constants";
import { createClient } from "@/lib/supabase/server";

type CleanupSummary = {
  importJobs: number;
  exportJobs: number;
  removedObjects: number;
  failedJobs: number;
};

function uniquePaths(paths: Array<string | null | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

export async function POST() {
  await requireRole(["admin"], "/admin/inventory/cleanup");
  const supabase = await createClient();
  const now = new Date().toISOString();
  const summary: CleanupSummary = { importJobs: 0, exportJobs: 0, removedObjects: 0, failedJobs: 0 };

  const { data: importJobs, error: importJobsError } = await supabase
    .from("inventory_import_jobs")
    .select("id, status, storage_path")
    .lte("expires_at", now)
    .limit(100);

  if (importJobsError) {
    return NextResponse.json({ error: "Import cleanup gagal membaca job." }, { status: 500 });
  }

  for (const job of importJobs ?? []) {
    const { data: rows, error: rowsError } = await supabase
      .from("inventory_import_rows")
      .select("id, planned_report_id, validation_status, item_image_storage_path, pickup_evidence_storage_path")
      .eq("import_job_id", job.id);

    if (rowsError) {
      summary.failedJobs += 1;
      continue;
    }

    const rowIds = (rows ?? []).map((row) => row.id);
    const evidenceResult = rowIds.length
      ? await supabase
        .from("inventory_pickup_evidence")
        .select("storage_path")
        .in("import_row_id", rowIds)
      : { data: [], error: null };

    if (evidenceResult.error) {
      summary.failedJobs += 1;
      continue;
    }

    const preservedEvidence = new Set((evidenceResult.data ?? []).map((evidence) => evidence.storage_path));
    const stagingPaths = uniquePaths([
      job.storage_path,
      ...(rows ?? []).map((row) => row.item_image_storage_path),
      ...(rows ?? [])
        .map((row) => row.pickup_evidence_storage_path)
        .filter((path) => !path || !preservedEvidence.has(path)),
    ]);

    if (stagingPaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(INVENTORY_IMPORT_BUCKET).remove(stagingPaths);
      if (removeError) {
        summary.failedJobs += 1;
        continue;
      }
      summary.removedObjects += stagingPaths.length;
    }

    for (const row of rows ?? []) {
      if (!row.planned_report_id || !["FAILED", "SKIPPED"].includes(row.validation_status)) continue;
      const { data: orphanFiles, error: listError } = await supabase.storage
        .from("report-images")
        .list(row.planned_report_id, { limit: 100 });
      if (listError) {
        summary.failedJobs += 1;
        continue;
      }

      const orphanPaths = (orphanFiles ?? []).map((file) => `${row.planned_report_id}/${file.name}`);
      if (orphanPaths.length > 0) {
        const { error: removeOrphanError } = await supabase.storage.from("report-images").remove(orphanPaths);
        if (removeOrphanError) {
          summary.failedJobs += 1;
          continue;
        }
        summary.removedObjects += orphanPaths.length;
      }
    }

    if (job.status !== "EXPIRED") {
      const { error: updateError } = await supabase
        .from("inventory_import_jobs")
        .update({ status: "EXPIRED" })
        .eq("id", job.id);
      if (updateError) {
        summary.failedJobs += 1;
        continue;
      }

      const { error: auditError } = await supabase.rpc("log_inventory_audit", {
        event_action: "INVENTORY_IMPORT_EXPIRED",
        event_entity_type: "inventory_import_job",
        event_entity_id: job.id,
        event_metadata: { removed_objects: stagingPaths.length },
      });
      if (auditError) summary.failedJobs += 1;
    }

    summary.importJobs += 1;
  }

  const { data: exportJobs, error: exportJobsError } = await supabase
    .from("export_jobs")
    .select("id, status, storage_path")
    .lte("expires_at", now)
    .limit(100);

  if (exportJobsError) {
    return NextResponse.json({ error: "Export cleanup gagal membaca job.", summary }, { status: 500 });
  }

  for (const job of exportJobs ?? []) {
    const paths = uniquePaths([job.storage_path]);
    if (paths.length > 0) {
      const { error: removeError } = await supabase.storage.from(INVENTORY_EXPORT_BUCKET).remove(paths);
      if (removeError) {
        summary.failedJobs += 1;
        continue;
      }
      summary.removedObjects += paths.length;
    }

    if (job.status !== "EXPIRED") {
      const { error: updateError } = await supabase
        .from("export_jobs")
        .update({ status: "EXPIRED" })
        .eq("id", job.id);
      if (updateError) {
        summary.failedJobs += 1;
        continue;
      }

      const { error: auditError } = await supabase.rpc("log_inventory_audit", {
        event_action: "INVENTORY_EXPORT_EXPIRED",
        event_entity_type: "export_job",
        event_entity_id: job.id,
        event_metadata: { removed_objects: paths.length },
      });
      if (auditError) summary.failedJobs += 1;
    }

    summary.exportJobs += 1;
  }

  return NextResponse.json(summary);
}
