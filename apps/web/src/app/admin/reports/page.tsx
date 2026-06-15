import Link from "next/link";

import { getPendingReviewReports, type AdminReportType } from "@/lib/admin/report-review";
import { requireRole } from "@/lib/auth/server";
import { REPORT_CATEGORIES, REPORT_TYPES } from "@/lib/reports/constants";

export const metadata = { title: "Review Laporan" };

interface AdminReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | string[] | undefined) {
  const page = Number.parseInt(firstParam(value) ?? "1", 10);

  if (Number.isNaN(page) || page < 1) {
    return 1;
  }

  return page;
}

function buildAdminReportsHref(filters: { type: string; category: string; page: number }) {
  const params = new URLSearchParams();

  if (filters.type) params.set("type", filters.type);
  if (filters.category) params.set("category", filters.category);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();

  return query ? `/admin/reports?${query}` : "/admin/reports";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  await requireRole(["verifier", "admin"], "/admin/reports");

  const params = await searchParams;
  const rawType = (firstParam(params.type) ?? "").toUpperCase();
  const rawCategory = firstParam(params.category) ?? "";
  const type = REPORT_TYPES.includes(rawType as AdminReportType) ? rawType : "";
  const category = REPORT_CATEGORIES.includes(rawCategory as (typeof REPORT_CATEGORIES)[number]) ? rawCategory : "";
  const page = parsePage(params.page);
  const result = await getPendingReviewReports({ type: type as AdminReportType | "", category, page });
  const hasPrevious = result.page > 1;
  const hasNext = result.page < result.pageCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke dashboard
      </Link>

      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Review laporan</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Queue PENDING_REVIEW</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Laporan paling lama tampil lebih dulu agar review berjalan adil.
        </p>
      </div>

      <form action="/admin/reports" className="mt-6 rounded-lg border bg-surface p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="type" className="font-heading text-sm font-semibold">Tipe</label>
            <select id="type" name="type" defaultValue={type} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {REPORT_TYPES.map((reportType) => (
                <option key={reportType} value={reportType}>{reportType === "LOST" ? "Hilang" : "Temuan"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="category" className="font-heading text-sm font-semibold">Kategori</label>
            <select id="category" name="category" defaultValue={category} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {REPORT_CATEGORIES.map((reportCategory) => (
                <option key={reportCategory} value={reportCategory}>{reportCategory}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong">
              Terapkan
            </button>
            <Link href="/admin/reports" className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold text-primary hover:bg-muted">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.totalCount} laporan menunggu. Halaman {result.page}{result.pageCount ? ` dari ${result.pageCount}` : ""}.
        </p>
        <p className="text-sm text-muted-foreground">Maksimal 20 laporan per halaman.</p>
      </div>

      {result.queryFailed ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Queue laporan belum dapat dimuat.
        </p>
      ) : result.reports.length === 0 ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Tidak ada laporan yang cocok.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
          <div className="hidden grid-cols-[1.15fr_0.9fr_0.8fr_0.8fr_auto] gap-4 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Laporan</span>
            <span>Lokasi</span>
            <span>Pelapor</span>
            <span>Dibuat</span>
            <span>Aksi</span>
          </div>
          <div className="divide-y">
            {result.reports.map((report) => (
              <article key={report.id} className="grid gap-3 p-4 md:grid-cols-[1.15fr_0.9fr_0.8fr_0.8fr_auto] md:items-center">
                <div>
                  <p className="font-heading font-semibold">{report.item_name}</p>
                  <p className="text-sm text-muted-foreground">{report.report_type} / {report.category}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{report.public_description}</p>
                </div>
                <p className="text-sm text-muted-foreground">{[report.campus, report.building].filter(Boolean).join(" / ") || report.building}</p>
                <p className="text-sm text-muted-foreground">
                  {report.reporter?.display_name ?? "Profil tidak tersedia"}
                  {report.reporter?.program_study_code ? ` (${report.reporter.program_study_code})` : ""}
                </p>
                <p className="text-sm text-muted-foreground">{formatDateTime(report.created_at)}</p>
                <Link
                  href={`/admin/reports/${report.id}`}
                  className="inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold text-primary hover:bg-muted"
                >
                  Review
                </Link>
              </article>
            ))}
          </div>
        </div>
      )}

      <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
        {hasPrevious ? (
          <Link href={buildAdminReportsHref({ type, category, page: result.page - 1 })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Sebelumnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Sebelumnya</span>
        )}
        {hasNext ? (
          <Link href={buildAdminReportsHref({ type, category, page: result.page + 1 })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Berikutnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Berikutnya</span>
        )}
      </nav>
    </main>
  );
}
