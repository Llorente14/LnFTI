import Link from "next/link";

import { CancelClaimButton } from "@/components/claims/cancel-claim-button";
import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { CLAIM_STATUSES, isCancellableClaimStatus } from "@/lib/claims/validation";
import { buildMyClaimsHref, getMyClaims, parseMyClaimsFilters } from "@/lib/claims/queries";

export const metadata = { title: "Klaim Saya" };

interface MyClaimsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function shortClaimRef(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export default async function MyClaimsPage({ searchParams }: MyClaimsPageProps) {
  const filters = parseMyClaimsFilters(await searchParams);
  const result = await getMyClaims(filters);
  const hasPrevious = result.page > 1;
  const hasNext = result.page < result.pageCount;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Student workspace</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Klaim saya</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Pantau klaim kepemilikan dan bukti privat yang sudah Anda kirim.
        </p>
      </div>

      {filters.created ? (
        <p className="mt-5 rounded-lg border border-green-700/20 bg-green-50 p-4 text-sm text-green-800">
          Klaim berhasil dikirim dan menunggu peninjauan verifier.
        </p>
      ) : null}

      <form action="/me/claims" className="mt-6 rounded-lg border bg-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-2">
            <label htmlFor="status" className="font-heading text-sm font-semibold">Status</label>
            <select
              id="status"
              name="status"
              defaultValue={filters.status ?? "ALL"}
              className="h-11 w-full rounded-md border bg-surface px-3 text-sm sm:w-64"
            >
              <option value="ALL">Semua</option>
              {CLAIM_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-strong">
            Terapkan
          </button>
          <Link href="/me/claims" className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-semibold text-primary hover:bg-muted">
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {result.totalCount} klaim. Halaman {result.page}{result.pageCount ? ` dari ${result.pageCount}` : ""}.
        </p>
        <p className="text-sm text-muted-foreground">Maksimal 12 klaim per halaman.</p>
      </div>

      {result.queryFailed ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Klaim belum dapat dimuat.
        </p>
      ) : result.claims.length === 0 ? (
        <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
          Belum ada klaim yang cocok.
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          {result.claims.map((claim) => (
            <article key={claim.id} className="rounded-lg border bg-surface p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ClaimStatusBadge status={claim.claim_status} />
                    <span className="rounded-full bg-muted px-2.5 py-1 font-heading text-[11px] font-semibold text-muted-foreground">
                      #{shortClaimRef(claim.id)}
                    </span>
                  </div>
                  {claim.publicReport ? (
                    <div className="mt-3">
                      <h2 className="font-heading text-lg font-bold">{claim.publicReport.item_name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {claim.publicReport.report_type} / {claim.publicReport.category}
                      </p>
                      <Link
                        href={`/reports/${claim.publicReport.id}`}
                        className="mt-2 inline-flex text-sm font-semibold text-primary hover:text-primary-strong"
                      >
                        Buka laporan publik
                      </Link>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">Laporan tidak lagi tersedia secara publik.</p>
                  )}
                </div>
                {isCancellableClaimStatus(claim.claim_status) ? (
                  <CancelClaimButton claimId={claim.id} />
                ) : null}
              </div>

              <dl className="mt-5 grid gap-4 text-sm md:grid-cols-3">
                <div>
                  <dt className="font-semibold text-muted-foreground">Dikirim</dt>
                  <dd>{formatDateTime(claim.created_at)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Kedaluwarsa</dt>
                  <dd>{formatDateTime(claim.expires_at)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-muted-foreground">Alasan keputusan</dt>
                  <dd>{claim.decision_reason ?? "-"}</dd>
                </div>
              </dl>

              {claim.claim_status === "APPROVED" ? (
                <p className="mt-4 rounded-md bg-[var(--gold-pale)] p-3 text-sm text-muted-foreground">
                  Klaim disetujui. Serah-terima fisik belum selesai dan kontak tidak dibagikan otomatis.
                </p>
              ) : null}

              {claim.claim_status === "REJECTED" ? (
                <p className="mt-4 rounded-md bg-muted p-3 text-sm text-muted-foreground">
                  Klaim ditolak. Pengajuan ulang hanya mungkin bila laporan masih PUBLISHED dan aturan database mengizinkan.
                </p>
              ) : null}

              <section className="mt-5 rounded-md border border-primary/20 bg-[var(--crimson-pale-2)] p-4">
                <h3 className="font-heading text-sm font-bold text-primary">Bukti privat Anda</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {claim.ownership_evidence_private}
                </p>
              </section>
            </article>
          ))}
        </div>
      )}

      <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
        {hasPrevious ? (
          <Link href={buildMyClaimsHref(filters, { page: result.page - 1, created: false })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Sebelumnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Sebelumnya</span>
        )}
        {hasNext ? (
          <Link href={buildMyClaimsHref(filters, { page: result.page + 1, created: false })} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Berikutnya</Link>
        ) : (
          <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Berikutnya</span>
        )}
      </nav>
    </main>
  );
}
