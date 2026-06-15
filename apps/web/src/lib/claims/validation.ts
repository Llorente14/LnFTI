import { z } from "zod";

export const CLAIM_EVIDENCE_MIN_LENGTH = 20;
export const CLAIM_EVIDENCE_MAX_LENGTH = 2000;
export const CLAIM_STATUSES = ["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "COMPLETED"] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const claimIdSchema = z.string().uuid("ID klaim tidak valid.");
export const claimReportIdSchema = z.string().uuid("ID laporan tidak valid.");

export const ownershipEvidenceSchema = z
  .string()
  .trim()
  .min(CLAIM_EVIDENCE_MIN_LENGTH, `Bukti kepemilikan minimal ${CLAIM_EVIDENCE_MIN_LENGTH} karakter.`)
  .max(CLAIM_EVIDENCE_MAX_LENGTH, `Bukti kepemilikan maksimal ${CLAIM_EVIDENCE_MAX_LENGTH} karakter.`);

export const claimSubmissionSchema = z.object({
  reportId: claimReportIdSchema,
  ownershipEvidence: ownershipEvidenceSchema,
});

export const cancelClaimSchema = z.object({
  claimId: claimIdSchema,
});

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  PENDING: "Menunggu Peninjauan",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  EXPIRED: "Kedaluwarsa",
  CANCELLED: "Dibatalkan",
  COMPLETED: "Selesai",
};

export function isCancellableClaimStatus(status: ClaimStatus) {
  return status === "PENDING";
}

export function buildClaimLoginHref(reportId: string) {
  const parsed = claimReportIdSchema.safeParse(reportId);

  if (!parsed.success) {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(`/reports/${parsed.data}?claim=1`)}`;
}
