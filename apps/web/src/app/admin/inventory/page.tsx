import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Inventaris DPM" };

export default function AdminInventoryPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke dashboard
      </Link>

      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Inventaris DPM
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Import dan export Excel/CSV
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Gunakan template Data Barang Lost & Found FTI. Preview wajib diperiksa sebelum commit import.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="rounded-lg border bg-surface p-5">
          <h2 className="font-heading text-xl font-bold">Import inventaris</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Parse workbook, validasi status/tanggal/gambar, lalu commit row valid ke laporan FOUND.
          </p>
          <Button asChild className="mt-5">
            <Link href="/admin/inventory/import">Buka import</Link>
          </Button>
        </article>

        <article className="rounded-lg border bg-surface p-5">
          <h2 className="font-heading text-xl font-bold">Export inventaris</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Buat snapshot XLSX atau CSV dari laporan DPM. File disimpan privat dan diunduh via URL sementara.
          </p>
          <Button asChild className="mt-5" variant="secondary">
            <Link href="/admin/inventory/export">Buka export</Link>
          </Button>
        </article>
      </section>
    </main>
  );
}
