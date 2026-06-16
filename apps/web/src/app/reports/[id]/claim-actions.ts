"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isVerifiedStudentProfile } from "@/lib/auth/profile-verification";
import { getCurrentProfile, requireUser } from "@/lib/auth/server";
import { claimSubmissionSchema } from "@/lib/claims/validation";
import { createClient } from "@/lib/supabase/server";

export type ClaimSubmissionState = {
  status: "idle" | "error";
  message: string;
};

function safeClaimErrorMessage(error: { code?: string; message?: string } | null | undefined) {
  if (error?.code === "23505") {
    return "Anda sudah memiliki klaim aktif untuk laporan ini.";
  }

  const message = error?.message?.toLowerCase() ?? "";

  if (message.includes("row-level security") || message.includes("violates")) {
    return "Laporan ini tidak lagi dapat diklaim.";
  }

  return "Klaim belum dapat dikirim. Silakan coba kembali.";
}

export async function submitOwnershipClaimAction(
  _previousState: ClaimSubmissionState,
  formData: FormData,
): Promise<ClaimSubmissionState> {
  const user = await requireUser("/reports");
  const profile = await getCurrentProfile();

  if (!isVerifiedStudentProfile(profile)) {
    return { status: "error", message: "Akun Anda belum memenuhi syarat untuk mengajukan klaim." };
  }

  const parsed = claimSubmissionSchema.safeParse({
    reportId: formData.get("reportId"),
    ownershipEvidence: formData.get("ownershipEvidence"),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Input klaim tidak valid." };
  }

  const supabase = await createClient();
  const { reportId, ownershipEvidence } = parsed.data;
  const { data: publicReport, error: publicReportError } = await supabase
    .from("public_reports")
    .select("id, report_type, custody_status")
    .eq("id", reportId)
    .maybeSingle();

  if (
    publicReportError
    || !publicReport
    || publicReport.report_type !== "FOUND"
    || publicReport.custody_status === "HANDED_OVER"
  ) {
    return { status: "error", message: "Laporan ini tidak lagi dapat diklaim." };
  }

  const { data: ownReport, error: ownReportError } = await supabase
    .from("reports")
    .select("id")
    .eq("id", reportId)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (ownReportError) {
    return { status: "error", message: "Kelayakan klaim belum dapat diperiksa. Silakan coba kembali." };
  }

  if (ownReport) {
    return { status: "error", message: "Anda tidak dapat mengklaim laporan yang Anda buat sendiri." };
  }

  const { data: existingClaim, error: existingClaimError } = await supabase
    .from("claims")
    .select("id")
    .eq("report_id", reportId)
    .eq("claimant_id", user.id)
    .in("claim_status", ["PENDING", "APPROVED", "COMPLETED"])
    .limit(1)
    .maybeSingle();

  if (existingClaimError) {
    return { status: "error", message: "Kelayakan klaim belum dapat diperiksa. Silakan coba kembali." };
  }

  if (existingClaim) {
    return { status: "error", message: "Anda sudah memiliki klaim aktif untuk laporan ini." };
  }

  const { error } = await supabase.from("claims").insert({
    report_id: reportId,
    claimant_id: user.id,
    ownership_evidence_private: ownershipEvidence,
  });

  if (error) {
    return { status: "error", message: safeClaimErrorMessage(error) };
  }

  revalidatePath(`/reports/${reportId}`);
  redirect("/me/claims?created=1");
}
