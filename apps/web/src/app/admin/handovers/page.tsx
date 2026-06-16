import Link from "next/link";

import { getCompletedHandovers, getPendingHandovers } from "@/lib/admin/handover";

export const metadata = { title: "Serah-Terima" };

interface AdminHandoversPageProps {
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

function buildHref(page: number) {
  return page > 1 ? `/admin/handovers?page=${page}` : "/admin/handovers";
}

export default async function AdminHandoversPage({ searchParams }: AdminHandoversPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const [pending, completed] = await Promise.all([
    getPendingHandovers({ page: 1 }),
    getCompletedHandovers({ page }),
  ]);
  const hasPrevious = completed.page > 1;
  const hasNext = completed.page < completed.pageCount;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke dashboard
      </Link>

      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Serah-terima</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Workflow serah-terima fisik</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Selesaikan barang yang klaimnya sudah disetujui. Handover hanya diproses dari halaman detail klaim.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-surface p-5">
          <p className="text-sm text-muted-foreground">Menunggu serah-terima</p>
          <p className="mt-3 font-heading text-3xl font-bold">{pending.totalCount}</p>
        </article>
        <article className="rounded-lg border bg-surface p-5">
          <p className="text-sm text-muted-foreground">Riwayat selesai</p>
          <p className="mt-3 font-heading text-3xl font-bold">{completed.totalCount}</p>
        </article>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-bold">Menunggu Serah-Terima</h2>
          <p className="text-sm text-muted-foreground">Oldest approved first</p>
        </div>

        {pending.queryFailed ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Queue serah-terima belum dapat dimuat.
          </p>
        ) : pending.handovers.length === 0 ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Belum ada klaim yang menunggu serah-terima.
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
            <div className="hidden grid-cols-[1fr_0.9fr_0.7fr_0.75fr_auto] gap-4 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Barang</span>
              <span>Pengklaim</span>
              <span>Custody</span>
              <span>Disetujui</span>
              <span>Aksi</span>
            </div>
            <div className="divide-y">
              {pending.handovers.map((item) => (
                <article key={item.claimId} className="grid gap-3 p-4 md:grid-cols-[1fr_0.9fr_0.7fr_0.75fr_auto] md:items-center">
                  <div>
                    <p className="font-heading font-semibold">{item.itemName}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.claimant?.display_name ?? "Profil tidak tersedia"}
                    {item.claimant?.nim ? ` / ${item.claimant.nim}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.custodyStatus}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(item.approvedAt)}</p>
                  <Link
                    href={`/admin/claims/${item.claimId}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold text-primary hover:bg-muted"
                  >
                    Buka klaim
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-bold">Riwayat serah-terima</h2>
          <p className="text-sm text-muted-foreground">Newest first</p>
        </div>

        {completed.queryFailed ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Riwayat serah-terima belum dapat dimuat.
          </p>
        ) : completed.handovers.length === 0 ? (
          <p className="mt-5 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Belum ada serah-terima yang selesai.
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-lg border bg-surface">
            <div className="hidden grid-cols-[1fr_0.9fr_0.9fr_0.8fr_auto] gap-4 border-b bg-muted px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground md:grid">
              <span>Barang</span>
              <span>Penerima</span>
              <span>Lokasi</span>
              <span>Selesai</span>
              <span>Aksi</span>
            </div>
            <div className="divide-y">
              {completed.handovers.map((item) => (
                <article key={item.handoverId} className="grid gap-3 p-4 md:grid-cols-[1fr_0.9fr_0.9fr_0.8fr_auto] md:items-center">
                  <div>
                    <p className="font-heading font-semibold">{item.itemName}</p>
                    <p className="text-sm text-muted-foreground">{item.category} / {item.custodyStatus}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.claimant?.display_name ?? "Profil tidak tersedia"}
                    {item.claimant?.program_study_code ? ` (${item.claimant.program_study_code})` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.handoverLocation}</p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(item.handoverAt)}</p>
                  <Link
                    href={`/admin/claims/${item.claimId}`}
                    className="inline-flex min-h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold text-primary hover:bg-muted"
                  >
                    Detail
                  </Link>
                </article>
              ))}
            </div>
          </div>
        )}

        <nav className="mt-8 flex items-center justify-between gap-3" aria-label="Pagination">
          {hasPrevious ? (
            <Link href={buildHref(completed.page - 1)} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Sebelumnya</Link>
          ) : (
            <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Sebelumnya</span>
          )}
          {hasNext ? (
            <Link href={buildHref(completed.page + 1)} className="rounded-md border bg-surface px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">Berikutnya</Link>
          ) : (
            <span className="rounded-md border bg-muted px-4 py-2 text-sm font-semibold text-muted-foreground">Berikutnya</span>
          )}
        </nav>
      </section>
    </main>
  );
}
