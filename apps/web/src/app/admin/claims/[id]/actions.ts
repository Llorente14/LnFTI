"use server";

import { revalidatePath } from "next/cache";

import { handoverFormSchema } from "@/lib/admin/handover-validation";
import { claimReviewFormSchema } from "@/lib/admin/claim-review-validation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type ClaimDecisionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type HandoverActionState = ClaimDecisionState;

function safeClaimReviewMessage(errorMessage: string | undefined) {
  const message = errorMessage?.toLowerCase() ?? "";

  if (message.includes("reason")) {
    return "Alasan wajib diisi 5-500 karakter.";
  }

  if (message.includes("pending")) {
    return "Klaim ini sudah tidak menunggu peninjauan.";
  }

  if (message.includes("published") || message.includes("handed over") || message.includes("found report")) {
    return "Laporan ini sudah tidak dapat diproses.";
  }

  if (message.includes("successful")) {
    return "Klaim lain sudah disetujui untuk laporan ini.";
  }

  if (message.includes("verifier") || message.includes("authentication")) {
    return "Anda tidak berwenang melakukan tindakan ini.";
  }

  return "Keputusan belum dapat diproses. Coba kembali.";
}

function safeHandoverMessage(errorMessage: string | undefined) {
  const message = errorMessage?.toLowerCase() ?? "";

  if (message.includes("handover_location") || message.includes("location")) {
    return "Lokasi serah-terima wajib diisi 3-200 karakter.";
  }

  if (message.includes("already completed") || message.includes("duplicate")) {
    return "Serah-terima untuk laporan ini sudah diselesaikan.";
  }

  if (message.includes("matching")) {
    return "Laporan ini tidak lagi berada dalam proses pencocokan.";
  }

  if (message.includes("approved") || message.includes("found report") || message.includes("resolved") || message.includes("handed over")) {
    return "Klaim ini belum siap untuk serah-terima.";
  }

  if (message.includes("verifier") || message.includes("authentication")) {
    return "Anda tidak berwenang menyelesaikan serah-terima.";
  }

  return "Serah-terima belum dapat diselesaikan. Silakan coba kembali.";
}

export async function reviewClaimAction(
  _previousState: ClaimDecisionState,
  formData: FormData,
): Promise<ClaimDecisionState> {
  await requireRole(["verifier", "admin"], "/admin/claims");

  const parsed = claimReviewFormSchema.safeParse({
    claimId: formData.get("claimId"),
    decision: formData.get("decision"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Input keputusan tidak valid." };
  }

  const supabase = await createClient();
  const { claimId, decision, reason } = parsed.data;
  const { data, error } = await supabase.rpc("review_claim", {
    target_claim_id: claimId,
    decision,
    reason,
  });

  if (error) {
    return { status: "error", message: safeClaimReviewMessage(error.message) };
  }

  const result = Array.isArray(data) ? data[0] : data;
  const reportId = result?.report_id as string | undefined;

  revalidatePath("/admin");
  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${claimId}`);
  revalidatePath("/me/claims");
  revalidatePath("/");
  revalidatePath("/reports");

  if (reportId) {
    revalidatePath(`/reports/${reportId}`);
  }

  return {
    status: "success",
    message: decision === "APPROVE"
      ? "Klaim disetujui dan laporan masuk proses pencocokan."
      : "Klaim ditolak.",
  };
}

export async function completeHandoverAction(
  _previousState: HandoverActionState,
  formData: FormData,
): Promise<HandoverActionState> {
  await requireRole(["verifier", "admin"], "/admin/claims");

  const parsed = handoverFormSchema.safeParse({
    claimId: formData.get("claimId"),
    handoverLocation: formData.get("handoverLocation"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Input serah-terima tidak valid." };
  }

  const supabase = await createClient();
  const { claimId, handoverLocation, notes } = parsed.data;
  const { data, error } = await supabase.rpc("complete_handover", {
    target_claim_id: claimId,
    handover_location: handoverLocation,
    notes,
  });

  if (error) {
    return { status: "error", message: safeHandoverMessage(error.message) };
  }

  const result = Array.isArray(data) ? data[0] : data;
  const reportId = result?.report_id as string | undefined;

  revalidatePath("/admin");
  revalidatePath("/admin/claims");
  revalidatePath(`/admin/claims/${claimId}`);
  revalidatePath("/admin/handovers");
  revalidatePath("/me/claims");
  revalidatePath("/");
  revalidatePath("/reports");

  if (reportId) {
    revalidatePath(`/reports/${reportId}`);
  }

  return {
    status: "success",
    message: "Serah-terima selesai, klaim ditutup, dan laporan telah diselesaikan.",
  };
}
