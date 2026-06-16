import { z } from "zod";

import type { ClaimStatus } from "@/lib/claims/validation";
import type { AdminCustodyStatus, AdminReportStatus, AdminReportType } from "@/lib/admin/report-review";

export const HANDOVER_LOCATION_MIN_LENGTH = 3;
export const HANDOVER_LOCATION_MAX_LENGTH = 200;
export const HANDOVER_NOTES_MAX_LENGTH = 1000;

export const handoverLocationSchema = z
  .string()
  .trim()
  .min(HANDOVER_LOCATION_MIN_LENGTH, "Lokasi serah-terima wajib diisi 3-200 karakter.")
  .max(HANDOVER_LOCATION_MAX_LENGTH, "Lokasi serah-terima wajib diisi 3-200 karakter.");

export const handoverNotesSchema = z.preprocess(
  (value) => (value === null || value === undefined ? "" : value),
  z
    .string()
    .trim()
    .max(HANDOVER_NOTES_MAX_LENGTH, "Catatan maksimal 1000 karakter.")
    .transform((value) => (value.length === 0 ? null : value)),
);

export const handoverFormSchema = z.object({
  claimId: z.string().uuid("ID klaim tidak valid."),
  handoverLocation: handoverLocationSchema,
  notes: handoverNotesSchema.default(null),
});

export type HandoverEligibilityInput = {
  claimStatus: ClaimStatus;
  reportType: AdminReportType | null;
  reportStatus: AdminReportStatus | null;
  custodyStatus: AdminCustodyStatus | null;
  hasHandover: boolean;
};

export function isHandoverEligible(input: HandoverEligibilityInput) {
  return input.claimStatus === "APPROVED"
    && input.reportType === "FOUND"
    && input.reportStatus === "MATCHING"
    && input.custodyStatus !== "HANDED_OVER"
    && !input.hasHandover;
}
