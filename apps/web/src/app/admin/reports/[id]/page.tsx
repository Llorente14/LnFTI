import { IconPhoto } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ReportTypeBadge } from "@/components/reports/report-status-badge";
import { CUSTODY_STATUSES, type CustodyStatus } from "@/lib/admin/report-review-validation";
import {
  getVerifierReportDetail,
  getVerifierReportImages,
  type AdminReportStatus,
  type AdminCustodyStatus,
} from "@/lib/admin/report-review";
import { requireRole } from "@/lib/auth/server";
import { isValidReportId } from "@/lib/reports/public-filters";
import { CustodyStatusForm, ReviewDecisionForm } from "./review-controls";

interface AdminReportDetailPageProps {
  params: Promise<{ id: string }>;
}

const reportStatusLabels: Record<AdminReportStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Menunggu review",
  PUBLISHED: "Terpublikasi",
  MATCHING: "Dalam pencocokan",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
  CLOSED: "Ditutup",
};

const custodyLabels: Record<AdminCustodyStatus, string> = {
  WITH_FINDER: "Di penemu",
  AT_DPM: "Di DPM",
  HANDED_OVER: "Sudah diserahkan",
  UNKNOWN: "Belum diketahui",
};

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

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-1 font-heading text-[11px] font-semibold text-accent-foreground">
      {children}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground">{label}</dt>
      <dd className="mt-1">{value || "-"}</dd>
    </div>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border bg-muted text-center text-sm text-muted-foreground">
      <IconPhoto className="mb-2 h-7 w-7 text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default async function AdminReportDetailPage({ params }: AdminReportDetailPageProps) {
  const { id } = await params;

  await requireRole(["verifier", "admin"], `/admin/reports/${id}`);

  if (!isValidReportId(id)) {
    notFound();
  }

  const normalizedId = id.toLowerCase();
  const [report, images] = await Promise.all([
    getVerifierReportDetail(normalizedId),
    getVerifierReportImages(normalizedId),
  ]);

  if (!report) {
    notFound();
  }

  const reviewDisabled = report.report_status !== "PENDING_REVIEW";
  const custodyStatus = CUSTODY_STATUSES.includes(report.custody_status as CustodyStatus)
    ? (report.custody_status as CustodyStatus)
    : "UNKNOWN";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/reports" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke queue
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          {images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <div key={`${report.id}-${image.sort_order}`} className={index === 0 ? "sm:col-span-3" : ""}>
                  {image.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.signedUrl}
                      alt={image.alt_text ?? `Foto ${report.item_name} ${index + 1}`}
                      width={960}
                      height={720}
                      className="aspect-[4/3] w-full rounded-lg border object-cover"
                    />
                  ) : (
                    <ImagePlaceholder label="Foto belum dapat dimuat" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <ImagePlaceholder label="Belum ada foto laporan" />
          )}

          <article className="rounded-lg border bg-surface p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <ReportTypeBadge type={report.report_type} />
              <StatusPill>{reportStatusLabels[report.report_status]}</StatusPill>
              <StatusPill>{custodyLabels[report.custody_status]}</StatusPill>
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">{report.item_name}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground sm:text-base">
              {report.public_description}
            </p>
          </article>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-surface p-5">
              <h2 className="font-heading text-lg font-bold">Informasi laporan</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <InfoRow label="Kategori" value={report.category} />
                <InfoRow label="Kampus / gedung" value={[report.campus, report.building].filter(Boolean).join(" / ") || report.building} />
                <InfoRow label="Detail lokasi" value={report.location_detail} />
                <InfoRow label="Waktu kejadian" value={formatDateTime(report.event_at)} />
                <InfoRow label="Dibuat" value={formatDateTime(report.created_at)} />
              </dl>
            </div>

            <div className="rounded-lg border bg-surface p-5">
              <h2 className="font-heading text-lg font-bold">Pelapor</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <InfoRow label="Nama" value={report.reporter?.display_name ?? "Profil tidak tersedia"} />
                <InfoRow label="NIM" value={report.reporter?.nim ?? "-"} />
                <InfoRow label="Program" value={report.reporter?.program_study_code ?? "-"} />
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-primary/25 bg-[var(--crimson-pale-2)] p-5">
            <h2 className="font-heading text-lg font-bold text-primary">Ciri privat</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {report.private_characteristics ?? "Tidak ada ciri privat yang dikirim."}
            </p>
          </section>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
          <section className="rounded-lg border bg-surface p-5">
            <h2 className="font-heading text-lg font-bold">Workflow</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <InfoRow label="Status laporan" value={reportStatusLabels[report.report_status]} />
              <InfoRow label="Status custody" value={custodyLabels[report.custody_status]} />
              <InfoRow label="Direview pada" value={formatDateTime(report.reviewed_at)} />
              <InfoRow label="Dipublikasikan pada" value={formatDateTime(report.published_at)} />
              <InfoRow label="Alasan penolakan" value={report.rejection_reason ?? "-"} />
            </dl>
          </section>

          <ReviewDecisionForm reportId={report.id} disabled={reviewDisabled} />
          <CustodyStatusForm reportId={report.id} currentStatus={custodyStatus} />
        </aside>
      </div>
    </main>
  );
}
