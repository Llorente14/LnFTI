import { IconPhoto } from "@tabler/icons-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { ClaimStatusBadge } from "@/components/claims/claim-status-badge";
import { AdminClaimsRealtime } from "@/components/realtime/admin-claims-realtime";
import { ReportTypeBadge } from "@/components/reports/report-status-badge";
import { getClaimHandover } from "@/lib/admin/handover";
import { isHandoverEligible } from "@/lib/admin/handover-validation";
import { getClaimReportImages, getVerifierClaimDetail } from "@/lib/admin/claim-review";
import { claimIdSchema } from "@/lib/claims/validation";
import { ClaimDecisionControls } from "./claim-decision-controls";
import { HandoverControls } from "./handover-controls";

interface AdminClaimDetailPageProps {
  params: Promise<{ id: string }>;
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

export default async function AdminClaimDetailPage({ params }: AdminClaimDetailPageProps) {
  const { id } = await params;
  const parsedId = claimIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const claim = await getVerifierClaimDetail(parsedId.data);

  if (!claim) {
    notFound();
  }

  const images = claim.report ? await getClaimReportImages(claim.report.id) : [];
  const handover = await getClaimHandover(claim.id);
  const decisionDisabled = claim.claim_status !== "PENDING";
  const handoverEligible = isHandoverEligible({
    claimStatus: claim.claim_status,
    reportType: claim.report?.report_type ?? null,
    reportStatus: claim.report?.report_status ?? null,
    custodyStatus: claim.report?.custody_status ?? null,
    claimantVerificationStatus: claim.claimant?.verification_status ?? null,
    hasHandover: Boolean(handover),
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/claims" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke queue klaim
      </Link>

      <AdminClaimsRealtime claimId={claim.id} reportId={claim.report?.id ?? null} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          {images.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {images.map((image, index) => (
                <div key={`${image.report_id}-${image.sort_order}`} className={index === 0 ? "sm:col-span-3" : ""}>
                  {image.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.signedUrl}
                      alt={image.alt_text ?? `Foto laporan ${index + 1}`}
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
              <ClaimStatusBadge status={claim.claim_status} />
              {claim.isOverdue && claim.claim_status === "PENDING" ? (
                <span className="rounded-full bg-[var(--crimson-pale)] px-2.5 py-1 font-heading text-[11px] font-semibold text-primary">
                  Overdue
                </span>
              ) : null}
            </div>
            <h1 className="font-heading text-3xl font-bold tracking-tight">
              {claim.report?.item_name ?? "Laporan tidak tersedia"}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Dikirim {formatDateTime(claim.created_at)}
            </p>
          </article>

          <section className="rounded-lg border border-primary/25 bg-[var(--crimson-pale-2)] p-5">
            <h2 className="font-heading text-lg font-bold text-primary">Bukti kepemilikan privat</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
              {claim.ownership_evidence_private}
            </p>
          </section>

          {claim.report ? (
            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border bg-surface p-5">
                <h2 className="font-heading text-lg font-bold">Informasi laporan</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <InfoRow label="Tipe" value={<ReportTypeBadge type={claim.report.report_type} />} />
                  <InfoRow label="Kategori" value={claim.report.category} />
                  <InfoRow label="Deskripsi publik" value={<span className="whitespace-pre-wrap">{claim.report.public_description}</span>} />
                  <InfoRow label="Ciri privat laporan" value={<span className="whitespace-pre-wrap">{claim.report.private_characteristics ?? "-"}</span>} />
                  <InfoRow label="Lokasi" value={[claim.report.campus, claim.report.building].filter(Boolean).join(" / ") || claim.report.building} />
                  <InfoRow label="Detail lokasi" value={claim.report.location_detail} />
                </dl>
              </div>

              <div className="rounded-lg border bg-surface p-5">
                <h2 className="font-heading text-lg font-bold">Status laporan</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <InfoRow label="Report status" value={claim.report.report_status} />
                  <InfoRow label="Custody" value={claim.report.custody_status} />
                  <InfoRow label="Dipublikasikan" value={formatDateTime(claim.report.published_at)} />
                  <InfoRow label="Pelapor" value={claim.report.reporter?.display_name ?? "Profil tidak tersedia"} />
                  <InfoRow label="NIM pelapor" value={claim.report.reporter?.nim ?? "-"} />
                  <InfoRow label="Program pelapor" value={claim.report.reporter?.program_study_code ?? "-"} />
                </dl>
              </div>
            </section>
          ) : null}
        </section>

        <aside className="space-y-5 lg:sticky lg:top-20 lg:h-fit">
          <section className="rounded-lg border bg-surface p-5">
            <h2 className="font-heading text-lg font-bold">Pengklaim</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <InfoRow label="Nama" value={claim.claimant?.display_name ?? "Profil tidak tersedia"} />
              <InfoRow label="NIM" value={claim.claimant?.nim ?? "-"} />
              <InfoRow label="Program" value={claim.claimant?.program_study_code ?? "-"} />
              <InfoRow label="Angkatan" value={claim.claimant?.cohort_year ?? "-"} />
              <InfoRow label="Verifikasi" value={claim.claimant?.verification_status ?? "-"} />
            </dl>
          </section>

          <section className="rounded-lg border bg-surface p-5">
            <h2 className="font-heading text-lg font-bold">Riwayat keputusan</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <InfoRow label="Status klaim" value={<ClaimStatusBadge status={claim.claim_status} />} />
              <InfoRow label="Diputuskan pada" value={formatDateTime(claim.decided_at)} />
              <InfoRow label="Alasan keputusan" value={claim.decision_reason ?? "-"} />
              <InfoRow label="Kedaluwarsa" value={formatDateTime(claim.expires_at)} />
            </dl>
          </section>

          {handover ? (
            <section className="rounded-lg border bg-surface p-5">
              <h2 className="font-heading text-lg font-bold">Status serah-terima</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <InfoRow label="Status" value="Selesai" />
                <InfoRow label="Tanggal" value={formatDateTime(handover.handoverAt)} />
                <InfoRow label="Lokasi" value={handover.handoverLocation} />
                <InfoRow label="Penerima" value={handover.recipient?.display_name ?? "Profil tidak tersedia"} />
                <InfoRow label="Verifier" value={handover.verifier?.display_name ?? "Profil tidak tersedia"} />
                <InfoRow label="Catatan" value={handover.notes ?? "-"} />
                <InfoRow label="Status klaim" value={<ClaimStatusBadge status={claim.claim_status} />} />
                <InfoRow label="Status laporan" value={claim.report?.report_status ?? "-"} />
                <InfoRow label="Custody" value={claim.report?.custody_status ?? "-"} />
              </dl>
            </section>
          ) : null}

          <ClaimDecisionControls claimId={claim.id} disabled={decisionDisabled} />
          {handoverEligible ? <HandoverControls claimId={claim.id} /> : null}
        </aside>
      </div>
    </main>
  );
}
