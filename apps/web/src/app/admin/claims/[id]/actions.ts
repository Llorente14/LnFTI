"use server";

import { revalidatePath } from "next/cache";

import { claimReviewFormSchema } from "@/lib/admin/claim-review-validation";
import { requireRole } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type ClaimDecisionState = {
  status: "idle" | "success" | "error";
  message: string;
};

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
