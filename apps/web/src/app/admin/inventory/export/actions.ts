"use server";

import { requireRole } from "@/lib/auth/server";
import { INVENTORY_EXPORT_BUCKET } from "@/lib/inventory-import/constants";
import { buildInventoryCsv, buildInventoryWorkbook } from "@/lib/inventory-export/workbook-builder";
import type { InventoryExportImage, InventoryExportReport } from "@/lib/inventory-export/types";
import { createClient } from "@/lib/supabase/server";

type ExportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; downloadUrl: string; rowCount: number; format: string };

function firstValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

type StorageClient = Awaited<ReturnType<typeof createClient>>;

function contentTypeFromPath(path: string): InventoryExportImage["contentType"] | null {
  const extension = path.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return null;
}

async function downloadImage(
  supabase: StorageClient,
  bucket: string,
  storagePath: string,
): Promise<InventoryExportImage | null> {
  const contentType = contentTypeFromPath(storagePath);
  if (!contentType) return null;

  const { data, error } = await supabase.storage.from(bucket).download(storagePath);
  if (error || !data) return null;

  return {
    storagePath,
    bytes: Buffer.from(await data.arrayBuffer()),
    contentType,
  };
}

async function writeInventoryAudit(
  supabase: StorageClient,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.rpc("log_inventory_audit", {
    event_action: action,
    event_entity_type: "export_job",
    event_entity_id: entityId,
    event_metadata: metadata,
  });

  if (error) throw new Error("Audit export gagal dicatat.");
}

function parsePeriodYear(value: string) {
  if (!value) return null;
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null;
}

export async function createInventoryExportAction(
  _previousState: ExportState,
  formData: FormData,
): Promise<ExportState> {
  const { user, profile } = await requireRole(["verifier", "admin"], "/admin/inventory/export");
  const format = firstValue(formData, "format").toUpperCase() === "CSV" ? "CSV" : "XLSX";
  const reportStatus = firstValue(formData, "reportStatus");
  const custodyStatus = firstValue(formData, "custodyStatus");
  const category = firstValue(formData, "category");
  const location = firstValue(formData, "location");
  const periodYear = parsePeriodYear(firstValue(formData, "periodYear"));
  const from = firstValue(formData, "from");
  const to = firstValue(formData, "to");
  const requestedSensitive = formData.get("includeSensitive") === "on";
  const sensitiveReason = firstValue(formData, "sensitiveReason");
  const supabase = await createClient();

  if (from && to && new Date(from) > new Date(to)) {
    return { status: "error", message: "Tanggal mulai harus sebelum atau sama dengan tanggal selesai." };
  }

  if (requestedSensitive && profile.role !== "admin") {
    return { status: "error", message: "Hanya admin yang dapat mengekspor bukti pengambilan." };
  }

  if (requestedSensitive && format !== "XLSX") {
    return { status: "error", message: "Bukti pengambilan sensitif hanya tersedia untuk XLSX." };
  }

  if (requestedSensitive && sensitiveReason.length < 10) {
    return { status: "error", message: "Alasan ekspor sensitif minimal 10 karakter." };
  }

  let query = supabase
    .from("reports")
    .select("id, item_name, category, campus, building, location_detail, event_at, report_status, custody_status, resolved_at", { count: "exact" })
    .eq("report_type", "FOUND")
    .order("event_at", { ascending: false })
    .limit(501);

  if (reportStatus) query = query.eq("report_status", reportStatus);
  if (custodyStatus) query = query.eq("custody_status", custodyStatus);
  if (category) query = query.eq("category", category);
  if (location) query = query.ilike("location_detail", `%${location}%`);
  if (periodYear) {
    query = query
      .gte("event_at", new Date(`${periodYear}-01-01T00:00:00+07:00`).toISOString())
      .lte("event_at", new Date(`${periodYear}-12-31T23:59:59+07:00`).toISOString());
  }
  if (from) query = query.gte("event_at", new Date(`${from}T00:00:00+07:00`).toISOString());
  if (to) query = query.lte("event_at", new Date(`${to}T23:59:59+07:00`).toISOString());

  const { data, error, count } = await query;
  if (error) {
    return { status: "error", message: "Data laporan gagal dibaca." };
  }

  if ((count ?? 0) > 500 || (data ?? []).length > 500) {
    return { status: "error", message: "Hasil export lebih dari 500 row. Persempit filter terlebih dahulu." };
  }

  const baseReports = (data ?? []) as InventoryExportReport[];
  const reportIds = baseReports.map((report) => report.id);
  const reportImages = reportIds.length
    ? await supabase
      .from("report_images")
      .select("report_id, storage_path, sort_order")
      .in("report_id", reportIds)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };
  const importRows = reportIds.length
    ? await supabase
      .from("inventory_import_rows")
      .select("report_id, raw_status")
      .in("report_id", reportIds)
    : { data: [], error: null };
  const pickupEvidenceMetadata = reportIds.length
    ? await supabase
      .from("inventory_pickup_evidence")
      .select("report_id, storage_path")
      .in("report_id", reportIds)
    : { data: [], error: null };

  if (reportImages.error || importRows.error || pickupEvidenceMetadata.error) {
    return { status: "error", message: "Metadata gambar/status import gagal dibaca." };
  }

  const firstImageByReport = new Map<string, string>();
  for (const image of reportImages.data ?? []) {
    if (!firstImageByReport.has(image.report_id)) firstImageByReport.set(image.report_id, image.storage_path);
  }

  const rawStatusByReport = new Map<string, string>();
  for (const row of importRows.data ?? []) {
    if (row.report_id && !rawStatusByReport.has(row.report_id)) rawStatusByReport.set(row.report_id, row.raw_status);
  }

  const pickupByReport = new Map<string, string>();
  for (const evidence of pickupEvidenceMetadata.data ?? []) {
    if (evidence.report_id && !pickupByReport.has(evidence.report_id)) pickupByReport.set(evidence.report_id, evidence.storage_path);
  }

  const reports: InventoryExportReport[] = [];
  for (const report of baseReports) {
    const itemImagePath = firstImageByReport.get(report.id);
    const pickupPath = requestedSensitive ? pickupByReport.get(report.id) : undefined;
    const itemImage = format === "XLSX" && itemImagePath
      ? await downloadImage(supabase, "report-images", itemImagePath)
      : null;
    const pickup = format === "XLSX" && pickupPath
      ? await downloadImage(supabase, "inventory-imports", pickupPath)
      : null;

    if (format === "XLSX" && itemImagePath && !itemImage) {
      return { status: "error", message: "Foto barang gagal dibaca dari Storage privat." };
    }

    if (format === "XLSX" && itemImage?.contentType === "image/webp") {
      return { status: "error", message: "Export XLSX belum mendukung WebP. Gunakan CSV atau ubah foto ke JPEG/PNG." };
    }

    if (format === "XLSX" && pickupPath && (!pickup || pickup.contentType === "image/webp")) {
      return { status: "error", message: "Bukti pengambilan gagal dibaca atau berformat WebP." };
    }

    reports.push({
      ...report,
      raw_status: rawStatusByReport.get(report.id) ?? null,
      item_image: itemImage,
      pickup_evidence: format === "XLSX" && requestedSensitive ? pickup : null,
      has_item_image: Boolean(itemImagePath),
      has_pickup_evidence: Boolean(pickupByReport.get(report.id)),
    });
  }

  const jobId = crypto.randomUUID();
  const extension = format === "CSV" ? "csv" : "xlsx";
  const contentType = format === "CSV"
    ? "text/csv"
    : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const path = `${user.id}/${jobId}/inventory-export.${extension}`;
  const expiresAt = new Date(Date.now() + (requestedSensitive ? 45 * 60 * 1000 : 24 * 60 * 60 * 1000)).toISOString();
  const workbookYear = periodYear
    ?? (from ? new Date(`${from}T00:00:00+07:00`).getFullYear() : null)
    ?? (reports[0]?.event_at ? new Date(reports[0].event_at).getFullYear() : null)
    ?? new Date().getFullYear();
  const body = format === "CSV"
    ? Buffer.from(buildInventoryCsv(reports), "utf8")
    : await buildInventoryWorkbook(reports, workbookYear);

  const { error: jobError } = await supabase.from("export_jobs").insert({
    id: jobId,
    requested_by: user.id,
    export_format: format,
    dataset: "dpm_inventory",
    filter_snapshot: { reportStatus, custodyStatus, category, location, periodYear, from, to },
    include_sensitive: requestedSensitive,
    sensitive_export_reason: requestedSensitive ? sensitiveReason : null,
    status: "PROCESSING",
    row_count: reports.length,
    storage_path: path,
    expires_at: expiresAt,
  });

  if (jobError) {
    return { status: "error", message: "Job export gagal dibuat." };
  }

  try {
    await writeInventoryAudit(supabase, requestedSensitive ? "INVENTORY_EXPORT_SENSITIVE_REQUESTED" : "INVENTORY_EXPORT_REQUESTED", jobId, {
      format,
      row_count: reports.length,
      include_sensitive: requestedSensitive,
      filter: { reportStatus, custodyStatus, category, location, periodYear, from, to },
    });
  } catch {
    await supabase.from("export_jobs").update({ status: "FAILED", error_message: "audit_failed" }).eq("id", jobId);
    return { status: "error", message: "Audit export gagal dibuat." };
  }

  const { error: uploadError } = await supabase.storage.from(INVENTORY_EXPORT_BUCKET).upload(path, body, {
    contentType,
    cacheControl: "300",
    upsert: false,
  });

  if (uploadError) {
    await supabase.from("export_jobs").update({ status: "FAILED", error_message: "upload_failed" }).eq("id", jobId);
    await supabase.rpc("log_inventory_audit", {
      event_action: "INVENTORY_EXPORT_FAILED",
      event_entity_type: "export_job",
      event_entity_id: jobId,
      event_metadata: { safe_error: "upload_failed" },
    });
    return { status: "error", message: "File export gagal disimpan." };
  }

  const { error: completeError } = await supabase
    .from("export_jobs")
    .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
    .eq("id", jobId);

  if (completeError) {
    await supabase.storage.from(INVENTORY_EXPORT_BUCKET).remove([path]);
    return { status: "error", message: "Status export gagal diselesaikan." };
  }

  try {
    await writeInventoryAudit(supabase, "INVENTORY_EXPORT_COMPLETED", jobId, { format, row_count: reports.length });
  } catch {
    await supabase.storage.from(INVENTORY_EXPORT_BUCKET).remove([path]);
    await supabase.from("export_jobs").update({ status: "FAILED", error_message: "audit_failed" }).eq("id", jobId);
    return { status: "error", message: "Audit penyelesaian export gagal dicatat." };
  }

  return {
    status: "success",
    downloadUrl: `/admin/inventory/export/${jobId}/download`,
    rowCount: reports.length,
    format,
  };
}
