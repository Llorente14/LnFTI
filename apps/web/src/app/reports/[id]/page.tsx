import Link from "next/link";
import { notFound } from "next/navigation";

import { ClaimForm } from "@/components/claims/claim-form";
import { ReportStatusBadge, ReportTypeBadge } from "@/components/reports/report-status-badge";
import { getClaimEligibilityForReport } from "@/lib/claims/queries";
import { buildClaimLoginHref } from "@/lib/claims/validation";
import { isValidReportId } from "@/lib/reports/public-filters";
import { getPublicReportById } from "@/lib/reports/public-queries";

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;

  if (!isValidReportId(id)) {
    notFound();
  }

  const report = await getPublicReportById(id.toLowerCase());

  if (!report) {
    notFound();
  }

  const claimEligibility = await getClaimEligibilityForReport(report);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/reports" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke semua laporan
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-4">
          {report.images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {report.images.map((image, index) => (
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
                    <div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
                      Foto belum dapat dimuat
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
              Belum ada foto publik
            </div>
          )}

          <article className="rounded-lg border bg-surface p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <ReportTypeBadge type={report.report_type} />
              <ReportStatusBadge status={report.report_status} />
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">{report.item_name}</h1>
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground sm:text-base">
              {report.public_description}
            </p>
          </article>
        </section>

        <aside className="h-fit rounded-lg border bg-surface p-5 lg:sticky lg:top-20">
          <h2 className="font-heading text-lg font-bold">Informasi publik</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-muted-foreground">Kategori</dt>
              <dd>{report.category}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Kampus / gedung</dt>
              <dd>{[report.campus, report.building].filter(Boolean).join(" • ") || report.building}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Waktu kejadian</dt>
              <dd>{formatDateTime(report.event_at)}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Status penitipan</dt>
              <dd>{report.custody_status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-muted-foreground">Dipublikasikan</dt>
              <dd>{report.published_at ? formatDateTime(report.published_at) : "-"}</dd>
            </div>
          </dl>
          <div className="mt-6 rounded-md bg-muted p-3 text-sm text-muted-foreground">
            Klaim hanya tersedia untuk laporan barang temuan yang masih publik.
          </div>

          {report.report_type === "FOUND" ? (
            <section className="mt-5 rounded-lg border bg-surface p-4">
              <h2 className="font-heading text-base font-bold">Ajukan Klaim</h2>
              {claimEligibility.state === "anonymous" ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">Masuk dengan akun mahasiswa terverifikasi untuk mengajukan klaim.</p>
                  <Link
                    href={buildClaimLoginHref(report.id)}
                    className="inline-flex min-h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-strong"
                  >
                    Ajukan Klaim
                  </Link>
                </div>
              ) : claimEligibility.state === "claimable" ? (
                <div className="mt-3">
                  <ClaimForm reportId={report.id} />
                </div>
              ) : claimEligibility.state === "owner" ? (
                <p className="mt-3 text-sm text-muted-foreground">Anda tidak dapat mengklaim laporan yang Anda buat sendiri.</p>
              ) : claimEligibility.state === "existing_pending_claim" ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Anda sudah memiliki klaim aktif untuk laporan ini.{" "}
                  <Link href="/me/claims" className="font-semibold text-primary hover:text-primary-strong">
                    Lihat Klaim Saya
                  </Link>
                </p>
              ) : claimEligibility.state === "existing_approved_claim" ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Klaim aktif untuk laporan ini sudah tercatat.{" "}
                  <Link href="/me/claims" className="font-semibold text-primary hover:text-primary-strong">
                    Lihat Klaim Saya
                  </Link>
                </p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Akun Anda belum memenuhi syarat untuk mengajukan klaim.</p>
              )}
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
