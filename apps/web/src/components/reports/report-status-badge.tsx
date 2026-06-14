import { cn } from "@/lib/utils";

export function ReportTypeBadge({ type }: { type: "LOST" | "FOUND" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 font-heading text-[11px] font-semibold",
        type === "LOST"
          ? "bg-[#ffeaea] text-[#991b1b]"
          : "bg-[#e8f5ec] text-[#166534]",
      )}
    >
      {type === "LOST" ? "HILANG" : "DITEMUKAN"}
    </span>
  );
}

export function ReportStatusBadge({ status }: { status: "PUBLISHED" | "MATCHING" }) {
  return (
    <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-1 font-heading text-[11px] font-semibold text-accent-foreground">
      {status === "MATCHING" ? "Dalam pencocokan" : "Terpublikasi"}
    </span>
  );
}
