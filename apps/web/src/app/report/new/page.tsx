import { requireUser } from "@/lib/auth/server";
import { ReportForm } from "@/app/report/new/report-form";

export const metadata = { title: "Buat Laporan" };

export default async function NewReportPage() {
  await requireUser("/report/new");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <div className="mb-8 max-w-3xl">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">
          Laporan mahasiswa
        </p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Laporkan barang hilang atau temuan
        </h1>
        <p className="mt-4 text-sm text-muted-foreground sm:text-base">
          Isi detail yang aman dibagikan, simpan ciri privat hanya untuk verifikasi, lalu kirim ke antrean review DPM.
        </p>
      </div>

      <section className="rounded-lg border bg-surface p-4 sm:p-6 lg:p-8">
        <ReportForm />
      </section>
    </main>
  );
}
