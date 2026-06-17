import Link from "next/link";

import { InventoryImportForm } from "@/app/admin/inventory/import/import-form";

export const metadata = { title: "Import Inventaris" };

export default function InventoryImportPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/inventory" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke inventaris
      </Link>
      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Import inventaris</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">Preview workbook DPM</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Parser membaca cell dan OOXML drawing agar foto pada kolom C/H tetap terhubung ke row yang benar.
        </p>
      </div>
      <InventoryImportForm />
    </main>
  );
}
