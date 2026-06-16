import { IconArrowRight, IconClipboardCheck, IconClock, IconFileAlert, IconPackageExport, IconX } from "@tabler/icons-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/server";
import { getClaimDashboardSummary } from "@/lib/admin/claim-review";
import { getHandoverDashboardSummary } from "@/lib/admin/handover";
import { getVerifierDashboardSummary } from "@/lib/admin/report-review";

export const metadata = { title: "Dashboard Verifier" };

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

const stats = [
  { key: "pendingCount", label: "Menunggu review", icon: IconClock },
  { key: "publishedCount", label: "Terpublikasi", icon: IconClipboardCheck },
  { key: "rejectedCount", label: "Ditolak", icon: IconX },
] as const;

export default async function AdminPage() {
  await requireRole(["verifier", "admin"], "/admin");
  const [summary, claimSummary, handoverSummary] = await Promise.all([
    getVerifierDashboardSummary(),
    getClaimDashboardSummary(),
    getHandoverDashboardSummary(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">
            Verifier workspace
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Dashboard verifier</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/admin/reports">
              Queue laporan
              <IconArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/claims">
              Queue klaim
              <IconArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/handovers">
              Serah-terima
              <IconArrowRight size={17} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {stats.map(({ key, label, icon: Icon }) => (
          <article key={key} className="rounded-lg border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{label}</p>
              <Icon size={20} className="text-primary" aria-hidden="true" />
            </div>
            <p className="mt-3 font-heading text-3xl font-bold">{summary[key]}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Klaim pending</p>
            <IconFileAlert size={20} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-3xl font-bold">{claimSummary.pendingClaimCount}</p>
        </article>
        <article className="rounded-lg border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Klaim overdue</p>
            <IconClock size={20} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-3xl font-bold">{claimSummary.overduePendingClaimCount}</p>
        </article>
        <article className="rounded-lg border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Klaim disetujui</p>
            <IconClipboardCheck size={20} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-3xl font-bold">{claimSummary.approvedClaimCount}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Menunggu serah-terima</p>
            <IconPackageExport size={20} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-3xl font-bold">{handoverSummary.pendingHandoverCount}</p>
        </article>
        <article className="rounded-lg border bg-surface p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Serah-terima bulan ini</p>
            <IconClipboardCheck size={20} className="text-primary" aria-hidden="true" />
          </div>
          <p className="mt-3 font-heading text-3xl font-bold">{handoverSummary.completedThisMonthCount}</p>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-primary">Oldest first</p>
            <h2 className="font-heading text-2xl font-bold">Laporan paling lama menunggu</h2>
          </div>
          <Link href="/admin/reports" className="text-sm font-semibold text-primary hover:text-primary-strong">
            Lihat semua
          </Link>
        </div>

        {summary.queryFailed ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Ringkasan laporan belum dapat dimuat.
          </p>
        ) : summary.oldestPendingReports.length === 0 ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Tidak ada laporan menunggu review.
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
            <div className="divide-y">
              {summary.oldestPendingReports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/reports/${report.id}`}
                  className="grid gap-2 p-4 hover:bg-muted sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-heading font-semibold">{report.item_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.report_type} / {report.category} / {report.building}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateTime(report.created_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-primary">Claim activity</p>
            <h2 className="font-heading text-2xl font-bold">Aktivitas klaim terbaru</h2>
          </div>
          <Link href="/admin/claims" className="text-sm font-semibold text-primary hover:text-primary-strong">
            Lihat queue klaim
          </Link>
        </div>

        {claimSummary.queryFailed ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Ringkasan klaim belum dapat dimuat.
          </p>
        ) : claimSummary.recentClaimActivity.length === 0 ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Belum ada aktivitas klaim.
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
            <div className="divide-y">
              {claimSummary.recentClaimActivity.map((claim) => (
                <Link
                  key={claim.id}
                  href={`/admin/claims/${claim.id}`}
                  className="grid gap-2 p-4 hover:bg-muted sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-heading font-semibold">{claim.report?.item_name ?? "Laporan tidak tersedia"}</p>
                    <p className="text-sm text-muted-foreground">
                      {claim.claim_status} / {claim.claimant?.display_name ?? "Profil tidak tersedia"}
                      {claim.isOverdue ? " / Overdue" : ""}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateTime(claim.created_at)}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
