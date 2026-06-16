import { z } from "zod";

export const REVIEW_DECISIONS = ["APPROVE", "REJECT"] as const;
export const ALL_CUSTODY_STATUSES = ["WITH_FINDER", "AT_DPM", "HANDED_OVER", "UNKNOWN"] as const;
export const CUSTODY_STATUSES = ["WITH_FINDER", "AT_DPM", "UNKNOWN"] as const;

const trimmedReason = z
  .string()
  .trim()
  .min(5, "Alasan minimal 5 karakter.")
  .max(500, "Alasan maksimal 500 karakter.");

export const reportReviewSchema = z.object({
  reportId: z.string().uuid("ID laporan tidak valid."),
  decision: z.enum(REVIEW_DECISIONS, { message: "Keputusan tidak valid." }),
  reason: trimmedReason,
});

export const custodyStatusSchema = z.object({
  reportId: z.string().uuid("ID laporan tidak valid."),
  currentCustodyStatus: z.enum(ALL_CUSTODY_STATUSES, { message: "Status penitipan saat ini tidak valid." }),
  newCustodyStatus: z.enum(CUSTODY_STATUSES, { message: "Status penitipan baru tidak valid." }),
  reason: trimmedReason,
}).refine(
  (value) => value.currentCustodyStatus !== value.newCustodyStatus,
  { path: ["newCustodyStatus"], message: "Status penitipan tidak berubah." },
);

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export type CustodyStatus = (typeof ALL_CUSTODY_STATUSES)[number];
