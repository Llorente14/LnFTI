import Link from "next/link";

import { InventoryExportForm } from "@/app/admin/inventory/export/export-form";

export const metadata = { title: "Export Inventaris" };

export default function InventoryExportPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/inventory" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke inventaris
      </Link>
      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Export inventaris</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Buat snapshot Excel/CSV</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          CSV tidak memuat gambar atau storage path privat. XLSX mengikuti struktur template DPM.
        </p>
      </div>
      <InventoryExportForm />
    </main>
  );
}
