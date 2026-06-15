import { CLAIM_STATUS_LABELS, type ClaimStatus } from "@/lib/claims/validation";
import { cn } from "@/lib/utils";

const statusStyles: Record<ClaimStatus, string> = {
  PENDING: "bg-[var(--gold-pale)] text-accent-foreground",
  APPROVED: "bg-[#e8f5ec] text-[#166534]",
  REJECTED: "bg-[#ffeaea] text-[#991b1b]",
  EXPIRED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-[var(--crimson-pale)] text-primary",
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 font-heading text-[11px] font-semibold", statusStyles[status])}>
      {CLAIM_STATUS_LABELS[status]}
    </span>
  );
}
