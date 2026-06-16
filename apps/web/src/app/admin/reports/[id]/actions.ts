"use server";

import { revalidatePath } from "next/cache";

import { custodyStatusSchema, reportReviewSchema } from "@/lib/admin/report-review-validation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

function safeRpcMessage(errorMessage: string | undefined) {
  const message = errorMessage?.toLowerCase() ?? "";

  if (message.includes("reason")) {
    return "Alasan wajib diisi 5-500 karakter.";
  }

  if (message.includes("pending review")) {
    return "Laporan ini sudah tidak menunggu review.";
  }

  if (message.includes("unchanged")) {
    return "Status penitipan tidak berubah.";
  }

  if (message.includes("handed over custody")) {
    return "Status HANDED_OVER hanya ditetapkan melalui penyelesaian serah-terima dari klaim yang telah disetujui.";
  }

  if (message.includes("draft")) {
    return "Laporan draft belum dapat diubah status penitipannya.";
  }

  if (message.includes("verifier") || message.includes("authentication")) {
    return "Anda tidak berwenang melakukan tindakan ini.";
  }

  return "Tindakan belum dapat diproses. Coba lagi nanti.";
}

function revalidateAdminReport(reportId: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/reports/${reportId}`);
}

function revalidatePublicReport(reportId: string) {
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath(`/reports/${reportId}`);
}

export async function reviewReportAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireRole(["verifier", "admin"], "/admin");

  const parsed = reportReviewSchema.safeParse({
    reportId: formData.get("reportId"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Input review tidak valid." };
  }

  const supabase = await createClient();
  const { reportId, decision, reason } = parsed.data;
  const { error } = await supabase.rpc("review_report", {
    target_report_id: reportId,
    decision,
    reason,
  });

  if (error) {
    return { status: "error", message: safeRpcMessage(error.message) };
  }

  revalidateAdminReport(reportId);
  revalidatePublicReport(reportId);

  return {
    status: "success",
    message: decision === "APPROVE" ? "Laporan disetujui dan dipublikasikan." : "Laporan ditolak.",
  };
}

export async function updateCustodyStatusAction(
  _previousState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireRole(["verifier", "admin"], "/admin");

  const parsed = custodyStatusSchema.safeParse({
    reportId: formData.get("reportId"),
    currentCustodyStatus: formData.get("currentCustodyStatus"),
    newCustodyStatus: formData.get("newCustodyStatus"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Input custody tidak valid." };
  }

  const supabase = await createClient();
  const { reportId, newCustodyStatus, reason } = parsed.data;
  const { error } = await supabase.rpc("set_report_custody_status", {
    target_report_id: reportId,
    new_custody_status: newCustodyStatus,
    reason,
  });

  if (error) {
    return { status: "error", message: safeRpcMessage(error.message) };
  }

  revalidateAdminReport(reportId);
  revalidatePublicReport(reportId);

  return { status: "success", message: "Status penitipan diperbarui." };
}
