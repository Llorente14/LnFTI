import Link from "next/link";

import { ReportCard } from "@/components/reports/report-card";
import type { PublicReportCardData } from "@/lib/reports/public-queries";

export function ReportGrid({
  reports,
  resetHref = "/reports",
}: {
  reports: PublicReportCardData[];
  resetHref?: string;
}) {
  if (reports.length === 0) {
    return (
      <div className="rounded-lg border bg-surface p-6 text-center">
        <h2 className="font-heading text-xl font-bold">Belum ada laporan yang cocok.</h2>
        <p className="mt-2 text-sm text-muted-foreground">Coba ubah filter atau lihat semua laporan publik.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href={resetHref} className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
            Reset filter
          </Link>
          <Link href="/report/new" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
            Buat laporan
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
