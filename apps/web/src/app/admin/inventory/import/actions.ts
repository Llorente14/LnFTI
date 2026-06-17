"use server";

import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/server";
import { INVENTORY_IMPORT_BUCKET, INVENTORY_WORKBOOK_MAX_BYTES } from "@/lib/inventory-import/constants";
import { normalizeEditableInventoryRow } from "@/lib/inventory-import/row-normalizer";
import { parseInventoryWorkbook } from "@/lib/inventory-import/workbook-parser";
import { createClient } from "@/lib/supabase/server";

type ImportPreviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; jobId: string; totalRows: number };

type ImportInventoryRpcRow = {
  report_id: string | null;
  validation_status: string;
};

const INVALID_FILE = "Workbook harus berupa .xlsx valid dan maksimal 40 MB.";

type DatabaseClient = Awaited<ReturnType<typeof createClient>>;

function extensionContentType(extension: string) {
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "application/octet-stream";
}

function extensionFromPath(path: string | null) {
  return path?.split(".").pop()?.toLowerCase() ?? "jpg";
}

async function writeInventoryAudit(
  supabase: DatabaseClient,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await supabase.rpc("log_inventory_audit", {
    event_action: action,
    event_entity_type: entityType,
    event_entity_id: entityId,
    event_metadata: metadata,
  });
}

export async function previewInventoryImportAction(
  _previousState: ImportPreviewState,
  formData: FormData,
): Promise<ImportPreviewState> {
  const { user } = await requireRole(["verifier", "admin"], "/admin/inventory/import");
  const file = formData.get("workbook");

  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx") || file.size > INVENTORY_WORKBOOK_MAX_BYTES) {
    return { status: "error", message: INVALID_FILE };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;

  try {
    parsed = await parseInventoryWorkbook(buffer);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : INVALID_FILE,
    };
  }

  const supabase = await createClient();
  const { data: duplicateJob } = await supabase
    .from("inventory_import_jobs")
    .select("id, status, expires_at")
    .eq("requested_by", user.id)
    .eq("workbook_sha256", parsed.workbookSha256)
    .in("status", ["READY", "PROCESSING", "COMPLETED", "PARTIAL"])
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (duplicateJob?.status === "READY" || duplicateJob?.status === "PARTIAL") {
    return { status: "success", jobId: duplicateJob.id, totalRows: parsed.totalRows };
  }

  if (duplicateJob?.status === "PROCESSING") {
    return { status: "error", message: "Workbook sama sedang diproses. Buka job import yang sudah ada." };
  }

  if (duplicateJob?.status === "COMPLETED") {
    return { status: "error", message: "Workbook ini sudah pernah selesai diimpor." };
  }

  const jobId = crypto.randomUUID();
  const workbookPath = `${user.id}/${jobId}/workbook.xlsx`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: uploadError } = await supabase.storage
    .from(INVENTORY_IMPORT_BUCKET)
    .upload(workbookPath, buffer, {
      cacheControl: "3600",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      upsert: false,
    });

  if (uploadError) {
    return { status: "error", message: "Workbook gagal disimpan ke Storage privat." };
  }

  const { error: jobError } = await supabase.from("inventory_import_jobs").insert({
    id: jobId,
    requested_by: user.id,
    original_filename: file.name,
    workbook_sha256: parsed.workbookSha256,
    source_sheet: parsed.sourceSheet,
    status: "READY",
    total_rows: parsed.totalRows,
    valid_rows: parsed.validRows,
    warning_rows: parsed.warningRows,
    error_rows: parsed.errorRows,
    storage_path: workbookPath,
    expires_at: expiresAt,
  });

  if (jobError) {
    return { status: "error", message: "Job import gagal dibuat." };
  }

  await writeInventoryAudit(supabase, "INVENTORY_IMPORT_JOB_CREATED", "inventory_import_job", jobId, {
    workbook_sha256: parsed.workbookSha256,
    source_sheet: parsed.sourceSheet,
  });

  for (const row of parsed.rows) {
    const plannedReportId = crypto.randomUUID();
    const validationMessages = [...row.validationMessages];
    const itemPath = row.itemImage
      ? `${user.id}/${jobId}/item/${row.sourceRowNumber}-${crypto.randomUUID()}.${row.itemImage.extension}`
      : null;
    const pickupPath = row.pickupEvidence
      ? `${user.id}/${jobId}/pickup/${row.sourceRowNumber}-${crypto.randomUUID()}.${row.pickupEvidence.extension}`
      : null;
    let stagedItemPath = itemPath;
    let stagedPickupPath = pickupPath;

    if (row.itemImage && itemPath) {
      const { error } = await supabase.storage.from(INVENTORY_IMPORT_BUCKET).upload(itemPath, row.itemImage.bytes, {
        cacheControl: "3600",
        contentType: row.itemImage.contentType,
        upsert: false,
      });
      if (error) {
        stagedItemPath = null;
        validationMessages.push("Foto barang gagal masuk staging.");
      }
    }

    if (row.pickupEvidence && pickupPath) {
      const { error } = await supabase.storage.from(INVENTORY_IMPORT_BUCKET).upload(pickupPath, row.pickupEvidence.bytes, {
        cacheControl: "3600",
        contentType: row.pickupEvidence.contentType,
        upsert: false,
      });
      if (error) {
        stagedPickupPath = null;
        validationMessages.push("Bukti pengambilan gagal masuk staging.");
      }
    }

    const { error: rowError } = await supabase.from("inventory_import_rows").insert({
      import_job_id: jobId,
      source_row_number: row.sourceRowNumber,
      raw_values: row.rawValues,
      item_name: row.itemName,
      category: row.category,
      campus: row.campus,
      building: row.building,
      location_detail: row.locationDetail,
      event_at: row.eventAt,
      public_description: row.publicDescription,
      raw_status: row.rawStatus,
      report_status: row.reportStatus,
      custody_status: row.custodyStatus,
      pickup_date: row.pickupDate,
      item_image_storage_path: stagedItemPath,
      pickup_evidence_storage_path: stagedPickupPath,
      item_image_sha256: row.itemImageSha256,
      pickup_evidence_sha256: row.pickupEvidenceSha256,
      row_fingerprint: row.rowFingerprint,
      planned_report_id: plannedReportId,
      validation_status: row.validationStatus === "VALID" && validationMessages.length > 0 ? "WARNING" : row.validationStatus,
      validation_messages: validationMessages,
    });

    if (rowError) {
      return { status: "error", message: `Row ${row.sourceRowNumber} gagal disimpan.` };
    }
  }

  await writeInventoryAudit(supabase, "INVENTORY_IMPORT_PARSED", "inventory_import_job", jobId, {
    total_rows: parsed.totalRows,
    valid_rows: parsed.validRows,
    warning_rows: parsed.warningRows,
    error_rows: parsed.errorRows,
  });

  return { status: "success", jobId, totalRows: parsed.totalRows };
}

export async function updateInventoryImportRowAction(formData: FormData) {
  await requireRole(["verifier", "admin"], "/admin/inventory/import");
  const rowId = String(formData.get("rowId") ?? "");
  const jobId = String(formData.get("jobId") ?? "");
  const itemName = String(formData.get("itemName") ?? "");
  const category = String(formData.get("category") ?? "");
  const locationDetail = String(formData.get("locationDetail") ?? "");
  const eventDate = String(formData.get("eventDate") ?? "");
  const rawStatus = String(formData.get("rawStatus") ?? "");
  const pickupDate = String(formData.get("pickupDate") ?? "");
  const itemImageSha256 = String(formData.get("itemImageSha256") ?? "") || null;
  const supabase = await createClient();
  const normalized = normalizeEditableInventoryRow({
    itemName,
    category,
    locationDetail,
    eventDate,
    rawStatus,
    pickupDate,
    itemImageSha256,
  });

  await supabase.rpc("update_inventory_import_row", {
    target_row_id: rowId,
    next_item_name: normalized.itemName,
    next_category: normalized.category,
    next_location_detail: normalized.locationDetail,
    next_event_at: normalized.eventAt,
    next_public_description: normalized.publicDescription,
    next_raw_status: normalized.rawStatus,
    next_report_status: normalized.reportStatus,
    next_custody_status: normalized.custodyStatus,
    next_pickup_date: normalized.pickupDate,
    next_row_fingerprint: normalized.rowFingerprint,
    next_validation_status: normalized.validationStatus,
    next_validation_messages: normalized.validationMessages,
  });

  redirect(`/admin/inventory/import/${jobId}?updated=1`);
}

export async function commitInventoryRowsAction(formData: FormData) {
  const { user } = await requireRole(["verifier", "admin"], "/admin/inventory/import");
  const jobId = String(formData.get("jobId") ?? "");
  const rowIds = formData.getAll("rowId").map(String).filter(Boolean);
  const supabase = await createClient();
  let failedRows = 0;

  for (const rowId of rowIds) {
    const { data: row } = await supabase
      .from("inventory_import_rows")
      .select("id, planned_report_id, item_image_storage_path, validation_status")
      .eq("id", rowId)
      .maybeSingle();
    let permanentItemPath: string | null = null;

    if (row?.item_image_storage_path && (row.validation_status === "VALID" || row.validation_status === "WARNING")) {
      const extension = extensionFromPath(row.item_image_storage_path);
      const { data: staged, error: downloadError } = await supabase.storage
        .from(INVENTORY_IMPORT_BUCKET)
        .download(row.item_image_storage_path);

      if (downloadError || !staged) {
        failedRows += 1;
        continue;
      }

      permanentItemPath = `${row.planned_report_id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("report-images").upload(
        permanentItemPath,
        Buffer.from(await staged.arrayBuffer()),
        {
          cacheControl: "3600",
          contentType: extensionContentType(extension),
          upsert: false,
        },
      );

      if (uploadError) {
        failedRows += 1;
        continue;
      }
    }

    const { data, error } = await supabase.rpc("import_inventory_row", {
      target_row_id: rowId,
      permanent_item_image_path: permanentItemPath,
    });
    const resultRows = (data ?? []) as ImportInventoryRpcRow[];
    if (error || resultRows.some((row) => row.validation_status === "FAILED")) {
      if (permanentItemPath) await supabase.storage.from("report-images").remove([permanentItemPath]);
      failedRows += 1;
      continue;
    }

    if (permanentItemPath && row?.item_image_storage_path) {
      await supabase.storage.from(INVENTORY_IMPORT_BUCKET).remove([row.item_image_storage_path]);
    }
  }

  await writeInventoryAudit(supabase, "INVENTORY_IMPORT_CONFIRMED", "inventory_import_job", jobId, {
    row_count: rowIds.length,
    actor_id: user.id,
  });

  const params = new URLSearchParams({ committed: "1" });
  if (failedRows > 0) params.set("failed", String(failedRows));

  redirect(`/admin/inventory/import/${jobId}?${params.toString()}`);
}
