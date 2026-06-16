import Link from "next/link";

import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { AdminClaimsRealtime } from "@/components/realtime/admin-claims-realtime";
import { CLAIM_STATUSES, type ClaimStatus } from "@/lib/claims/validation";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";
import { getPendingClaims, type AdminClaimStatus } from "@/lib/admin/claim-review";

export const metadata = { title: "Review Klaim" };

interface AdminClaimsPageProps {
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

function buildAdminClaimsHref(filters: { status: string; category: string; overdue: boolean; page: number }) {
  const params = new URLSearchParams();

  if (filters.status && filters.status !== "PENDING") params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.overdue) params.set("overdue", "1");
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();

  return query ? `/admin/claims?${query}` : "/admin/claims";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function AdminClaimsPage({ searchParams }: AdminClaimsPageProps) {
  const params = await searchParams;
  const rawStatus = (firstParam(params.status) ?? "PENDING").toUpperCase();
  const rawCategory = firstParam(params.category) ?? "";
  const status = rawStatus === "ALL" || CLAIM_STATUSES.includes(rawStatus as ClaimStatus)
    ? rawStatus
    : "PENDING";
  const category = REPORT_CATEGORIES.includes(rawCategory as (typeof REPORT_CATEGORIES)[number]) ? rawCategory : "";
  const overdue = firstParam(params.overdue) === "1";
  const page = parsePage(params.page);
  const result = await getPendingClaims({
    status: status as AdminClaimStatus | "ALL",
    category,
    overdue,
    page,
  });
  const hasPrevious = result.page > 1;
  const hasNext = result.page < result.pageCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke dashboard
      </Link>

      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Review klaim</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Queue klaim kepemilikan</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Default menampilkan klaim PENDING paling lama lebih dulu. Overdue berarti pending lebih dari 3 hari.
        </p>
      </div>

      <AdminClaimsRealtime />

      <form action="/admin/claims" className="mt-6 rounded-lg border bg-surface p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="status" className="font-heading text-sm font-semibold">Status</label>
            <select id="status" name="status" defaultValue={status} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="ALL">Semua</option>
              {CLAIM_STATUSES.map((claimStatus) => (
                <option key={claimStatus} value={claimStatus}>{claimStatus}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="category" className="font-heading text-sm font-semibold">Kategori laporan</label>
            <select id="category" name="category" defaultValue={category} className="h-11 w-full rounded-md border bg-surface px-3 text-sm">
              <option value="">Semua</option>
              {REPORT_CATEGORIES.map((reportCategory) => (
                <option key={reportCategory} value={reportCategory}>{reportCategory}</option>
              ))}
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 pt-7 text-sm font-semibold">
            <input type="checkbox" name="overdue" value="1" defaultChecked={overdue} className="h-4 w-4" />
            Overdue saja
          </label>
          <div className="flex items-end gap-3">
            <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong">
              Terapkan
            </button>
            <Link href="/admin/claims" className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold text-primary hover:bg-muted">
              Reset
            </Link>
          </div>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.totalCount} klaim. Halaman {result.page}{result.pageCount ? ` dari ${result.pageCount}` : ""}.
        </p>
        <p className="text-sm text-muted-foreground">Maksimal 20 klaim per halaman.</p>
      </div>

      {result.queryFailed ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Queue klaim belum dapat dimuat.
        </p>
      ) : result.claims.length === 0 ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Tidak ada klaim yang cocok.
        </p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
          <div className="hidden grid-cols-[1fr_0.9fr_0.75fr_0.75fr_auto] gap-4 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
            <span>Laporan</span>
            <span>Pengklaim</span>
            <span>Status</span>
            <span>Dikirim</span>
            <span>Aksi</span>
          </div>
          <div className="divide-y">
            {result.claims.map((claim) => (
              <article key={claim.id} className="grid gap-3 p-4 md:grid-cols-[1fr_0.9fr_0.75fr_0.75fr_auto] md:items-center">
                <div>
                  <p className="font-heading font-semibold">{claim.report?.item_name ?? "Laporan tidak tersedia"}</p>
                  <p className="text-sm text-muted-foreground">{claim.report?.category ?? "-"} / {claim.report?.building ?? "-"}</p>
                  {claim.isOverdue ? (
                    <p className="mt-1 text-xs font-semibold text-primary">Overdue</p>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  {claim.claimant?.display_name ?? "Profil tidak tersedia"}
                  {claim.claimant?.program_study_code ? ` (${claim.claimant.program_study_code})` : ""}
                </p>
                <ClaimStatusBadge status={claim.claim_status} />
                <p className="text-sm text-muted-foreground">{formatDateTime(claim.created_at)}</p>
                <Link
                  href={`/admin/claims/${claim.id}`}
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
          <Link href={buildAdminClaimsHref({ status, category, overdue, page: result.page - 1 })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Sebelumnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Sebelumnya</span>
        )}
        {hasNext ? (
          <Link href={buildAdminClaimsHref({ status, category, overdue, page: result.page + 1 })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Berikutnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Berikutnya</span>
        )}
      </nav>
    </main>
  );
}
