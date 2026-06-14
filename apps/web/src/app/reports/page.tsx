import Link from "next/link";

import { ReportGrid } from "@/components/reports/report-grid";
import { REPORT_CATEGORIES, REPORT_TYPES } from "@/lib/reports/constants";
import { buildReportsHref, PUBLIC_REPORT_STATUSES } from "@/lib/reports/public-filters";
import { getPublicReports } from "@/lib/reports/public-queries";

export const metadata = { title: "Semua Laporan" };

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const result = await getPublicReports(await searchParams);
  const { filters } = result;
  const previousHref = buildReportsHref(filters, { page: Math.max(filters.page - 1, 1) });
  const nextHref = buildReportsHref(filters, { page: filters.page + 1 });
  const hasPrevious = filters.page > 1;
  const hasNext = filters.page < result.pageCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Public browse</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Semua laporan</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Cari laporan publik berstatus terpublikasi atau dalam pencocokan. Tidak perlu login.
        </p>
      </div>

      <form action="/reports" className="mb-6 rounded-lg border bg-surface p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="q" className="font-heading text-sm font-semibold">Cari</label>
            <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="Nama barang atau lokasi" className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="type" className="font-heading text-sm font-semibold">Tipe</label>
            <select id="type" name="type" defaultValue={filters.type} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>{type === "LOST" ? "Hilang" : "Temuan"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="status" className="font-heading text-sm font-semibold">Status</label>
            <select id="status" name="status" defaultValue={filters.status} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {PUBLIC_REPORT_STATUSES.map((status) => (
                <option key={status} value={status}>{status === "MATCHING" ? "Dalam pencocokan" : "Terpublikasi"}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="category" className="font-heading text-sm font-semibold">Kategori</label>
            <select id="category" name="category" defaultValue={filters.category} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {REPORT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="campus" className="font-heading text-sm font-semibold">Kampus</label>
            <input id="campus" name="campus" defaultValue={filters.campus} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="building" className="font-heading text-sm font-semibold">Gedung</label>
            <input id="building" name="building" defaultValue={filters.building} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="date_from" className="font-heading text-sm font-semibold">Dari tanggal</label>
            <input id="date_from" name="date_from" type="date" defaultValue={filters.dateFrom} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          </div>
          <div className="space-y-2">
            <label htmlFor="date_to" className="font-heading text-sm font-semibold">Sampai tanggal</label>
            <input id="date_to" name="date_to" type="date" defaultValue={filters.dateTo} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong">
            Terapkan filter
          </button>
          <Link href="/reports" className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold text-primary hover:bg-muted">
            Reset filter
          </Link>
        </div>
      </form>

      {!filters.isValid ? (
        <p className="mb-6 rounded-lg border border-primary/30 bg-[var(--crimson-pale-2)] p-4 text-sm text-primary">
          Filter tidak valid. Reset filter untuk melihat semua laporan publik.
        </p>
      ) : null}

      {result.queryFailed ? (
        <p className="mb-6 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Laporan publik belum dapat dimuat. Coba lagi nanti.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.totalCount} laporan cocok. Halaman {filters.page}{result.pageCount ? ` dari ${result.pageCount}` : ""}.
        </p>
        <p className="text-sm text-muted-foreground">Menampilkan maksimal 12 laporan per halaman.</p>
      </div>

      <ReportGrid reports={result.reports} />

      <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
        {hasPrevious ? (
          <Link href={previousHref} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Sebelumnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Sebelumnya</span>
        )}
        {hasNext ? (
          <Link href={nextHref} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Berikutnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Berikutnya</span>
        )}
      </nav>
    </main>
  );
}
