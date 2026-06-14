"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/server";
import { REPORT_IMAGE_BUCKET } from "@/lib/reports/constants";
import { parseReportImagePath } from "@/lib/reports/image-path";
import {
  reportImageFinalizeSchema,
  reportSubmissionSchema,
  type ReportFormValues,
} from "@/lib/reports/validation";
import { createClient } from "@/lib/supabase/server";

type ActionResult<T extends object | void = void> =
  | (T extends void ? { status: "success" } : { status: "success" } & T)
  | { status: "error"; message: string };

export type ReportImageFinalizeInput = {
  storagePath: string;
  altText: string;
  sortOrder: number;
};

const GENERIC_SUBMIT_ERROR = "Laporan belum dapat dikirim. Periksa data lalu coba lagi.";
const GENERIC_CLEANUP_ERROR = "Pengiriman gagal. Coba lagi dari awal.";

function safeCleanupLog(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}

export async function createDraftReportAction(
  values: ReportFormValues,
): Promise<ActionResult<{ reportId: string; userId: string; itemName: string }>> {
  const user = await requireUser("/report/new");
  const parsed = reportSubmissionSchema.safeParse(values);

  if (!parsed.success) {
    return { status: "error", message: GENERIC_SUBMIT_ERROR };
  }

  const supabase = await createClient();
  const input = parsed.data;
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: user.id,
      report_type: input.reportType,
      item_name: input.itemName,
      category: input.category,
      public_description: input.publicDescription,
      private_characteristics: input.privateCharacteristics,
      campus: input.campus,
      building: input.building,
      location_detail: input.locationDetail,
      event_at: new Date(input.eventAt).toISOString(),
      report_status: "DRAFT",
    })
    .select("id, item_name")
    .single();

  if (error || !data) {
    return { status: "error", message: GENERIC_SUBMIT_ERROR };
  }

  return {
    status: "success",
    reportId: data.id,
    userId: user.id,
    itemName: data.item_name,
  };
}

export async function finalizeReportSubmissionAction(
  reportId: string,
  images: ReportImageFinalizeInput[],
): Promise<ActionResult> {
  const user = await requireUser("/report/new");
  const parsedImages = reportImageFinalizeSchema.safeParse(images);

  if (!parsedImages.success) {
    return { status: "error", message: GENERIC_SUBMIT_ERROR };
  }

  const normalizedUserId = user.id.toLowerCase();
  const normalizedReportId = reportId.toLowerCase();
  const seenPaths = new Set<string>();

  for (const [index, image] of parsedImages.data.entries()) {
    const parsedPath = parseReportImagePath(image.storagePath);

    if (
      image.sortOrder !== index + 1
      || !parsedPath
      || parsedPath.userId !== normalizedUserId
      || parsedPath.reportId !== normalizedReportId
      || seenPaths.has(image.storagePath)
    ) {
      return { status: "error", message: GENERIC_SUBMIT_ERROR };
    }

    seenPaths.add(image.storagePath);
  }

  const supabase = await createClient();
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("id, reporter_id, report_status")
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("report_status", "DRAFT")
    .maybeSingle();

  if (reportError || !report) {
    return { status: "error", message: GENERIC_SUBMIT_ERROR };
  }

  if (parsedImages.data.length > 0) {
    const folderPath = `${user.id}/${reportId}`;
    const { data: storedObjects, error: storageError } = await supabase.storage
      .from(REPORT_IMAGE_BUCKET)
      .list(folderPath, { limit: 10 });

    if (storageError) {
      return { status: "error", message: GENERIC_SUBMIT_ERROR };
    }

    const storedPaths = new Set(
      (storedObjects ?? []).map((object) => `${folderPath}/${object.name}`),
    );

    if (parsedImages.data.some((image) => !storedPaths.has(image.storagePath))) {
      return { status: "error", message: GENERIC_SUBMIT_ERROR };
    }

    const { error: imageError } = await supabase.from("report_images").insert(
      parsedImages.data.map((image) => ({
        report_id: reportId,
        storage_path: image.storagePath,
        alt_text: image.altText || null,
        sort_order: image.sortOrder,
      })),
    );

    if (imageError) {
      await cleanupDraftReportAction(reportId);
      return { status: "error", message: GENERIC_CLEANUP_ERROR };
    }
  }

  const { data: finalizedReport, error: updateError } = await supabase
    .from("reports")
    .update({ report_status: "PENDING_REVIEW" })
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("report_status", "DRAFT")
    .select("id")
    .single();

  if (updateError || !finalizedReport) {
    await cleanupDraftReportAction(reportId);
    return { status: "error", message: GENERIC_CLEANUP_ERROR };
  }

  revalidatePath("/me/reports");

  return { status: "success" };
}

export async function cleanupDraftReportAction(reportId: string): Promise<ActionResult> {
  const user = await requireUser("/report/new");
  const supabase = await createClient();

  const { error: imageError } = await supabase.from("report_images").delete().eq("report_id", reportId);

  if (imageError) {
    safeCleanupLog("Report image metadata cleanup failed.");
  }

  const { error: reportError } = await supabase
    .from("reports")
    .delete()
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .eq("report_status", "DRAFT");

  if (reportError) {
    safeCleanupLog("Draft report cleanup failed.");
    return { status: "error", message: GENERIC_CLEANUP_ERROR };
  }

  return { status: "success" };
}
