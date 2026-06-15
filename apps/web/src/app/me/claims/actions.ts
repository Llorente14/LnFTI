"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/server";
import { cancelClaimSchema } from "@/lib/claims/validation";
import { createClient } from "@/lib/supabase/server";

export type CancelClaimState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function cancelPendingClaimAction(
  _previousState: CancelClaimState,
  formData: FormData,
): Promise<CancelClaimState> {
  const user = await requireUser("/me/claims");
  const parsed = cancelClaimSchema.safeParse({
    claimId: formData.get("claimId"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Klaim tidak valid." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .update({ claim_status: "CANCELLED" })
    .eq("id", parsed.data.claimId)
    .eq("claimant_id", user.id)
    .eq("claim_status", "PENDING")
    .select("id, report_id")
    .maybeSingle();

  if (error || !data) {
    return { status: "error", message: "Klaim tidak dapat dibatalkan." };
  }

  revalidatePath("/me/claims");
  revalidatePath(`/reports/${data.report_id}`);

  return { status: "success", message: "Klaim berhasil dibatalkan." };
}
