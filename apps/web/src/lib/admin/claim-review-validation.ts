import { z } from "zod";

export const CLAIM_REVIEW_DECISIONS = ["APPROVE", "REJECT"] as const;
export type ClaimReviewDecision = (typeof CLAIM_REVIEW_DECISIONS)[number];

const decisionReasonSchema = z
  .string()
  .trim()
  .min(5, "Alasan wajib diisi 5-500 karakter.")
  .max(500, "Alasan wajib diisi 5-500 karakter.");

export const claimReviewFormSchema = z.object({
  claimId: z.string().uuid("ID klaim tidak valid."),
  decision: z.enum(CLAIM_REVIEW_DECISIONS, { message: "Keputusan tidak valid." }),
  reason: decisionReasonSchema,
});

export function isClaimOverdue(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);

  if (Number.isNaN(created.getTime())) {
    return false;
  }

  return now.getTime() - created.getTime() > 3 * 24 * 60 * 60 * 1000;
}
