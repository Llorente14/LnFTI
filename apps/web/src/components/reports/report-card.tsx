import Link from "next/link";
import { IconMapPin, IconPhoto } from "@tabler/icons-react";

import { ReportStatusBadge, ReportTypeBadge } from "@/components/reports/report-status-badge";
import type { PublicReportCardData } from "@/lib/reports/public-queries";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function ReportImagePlaceholder({ category }: { category: string }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center bg-muted text-center text-sm text-muted-foreground">
      <IconPhoto className="mb-2 h-7 w-7 text-primary" aria-hidden="true" />
      <span>{category}</span>
    </div>
  );
}

export function ReportCard({ report }: { report: PublicReportCardData }) {
  const place = [report.campus, report.building].filter(Boolean).join(" • ");

  return (
    <article className="overflow-hidden rounded-lg border bg-surface transition-colors hover:border-primary/30 hover:bg-[var(--crimson-pale-2)]">
      <Link href={`/reports/${report.id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <div className="relative">
          {report.thumbnail?.signedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={report.thumbnail.signedUrl}
              alt={report.thumbnail.alt_text ?? `Foto ${report.item_name}`}
              className="aspect-[4/3] w-full object-cover"
              width={480}
              height={360}
            />
          ) : (
            <ReportImagePlaceholder category={report.category} />
          )}
          <div className="absolute left-3 top-3">
            <ReportTypeBadge type={report.report_type} />
          </div>
        </div>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <ReportStatusBadge status={report.report_status} />
            <span className="rounded-full bg-muted px-2.5 py-1 font-heading text-[11px] font-semibold text-muted-foreground">
              {report.category}
            </span>
          </div>

          <div>
            <h3 className="font-heading text-base font-semibold text-foreground">{report.item_name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{report.public_description}</p>
          </div>

          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <IconMapPin className="h-4 w-4 text-primary" aria-hidden="true" />
              {place || report.building}
            </span>
            <span>Kejadian: {formatDate(report.event_at)}</span>
          </div>
        </div>
        <span className="sr-only">Buka detail laporan {report.item_name}</span>
      </Link>
    </article>
  );
}
