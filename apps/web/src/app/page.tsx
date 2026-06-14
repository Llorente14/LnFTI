import {
  IconArrowRight,
  IconBottle,
  IconCreditCard,
  IconDeviceLaptop,
  IconSearch,
  IconWallet,
} from "@tabler/icons-react";
import Link from "next/link";

import { ReportGrid } from "@/components/reports/report-grid";
import { Button } from "@/components/ui/button";
import { getLatestPublicReports } from "@/lib/reports/public-queries";

const categories = [
  { label: "KTM & Kartu", icon: IconCreditCard },
  { label: "Elektronik", icon: IconDeviceLaptop },
  { label: "Dompet", icon: IconWallet },
  { label: "Botol & Wadah", icon: IconBottle },
];

export default async function HomePage() {
  const latest = await getLatestPublicReports(6);

  return (
    <>
      <section className="border-b bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-16 lg:px-8">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Untar Lost &amp; Found
            </p>
            <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Kehilangan atau menemukan barang di kampus?
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Cari laporan yang masih aktif atau bantu pemilik menemukan barangnya melalui satu kanal yang terstruktur.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/report/new?type=lost">Saya kehilangan barang</Link>
              </Button>
              <Button asChild variant="gold" size="lg">
                <Link href="/report/new?type=found">Saya menemukan barang</Link>
              </Button>
            </div>
          </div>

          <div className="self-end rounded-xl border bg-background p-4 sm:p-5">
            <form action="/reports">
              <label htmlFor="report-search" className="font-heading text-sm font-semibold">
                Cari laporan
              </label>
              <div className="mt-3 flex min-h-12 items-center gap-3 rounded-full border bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
                <IconSearch size={19} className="text-primary" aria-hidden="true" />
                <input
                  id="report-search"
                  name="q"
                  type="search"
                  placeholder="Nama barang atau lokasi"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
                />
                <button
                  type="submit"
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-strong"
                >
                  Cari
                </button>
              </div>
            </form>
            <p className="mt-3 text-xs text-muted-foreground">Lihat laporan publik tanpa login.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(({ label, icon: Icon }) => (
            <Link
              key={label}
              href={`/reports?category=${encodeURIComponent(label)}`}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-primary"
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-primary">Data publik</p>
            <h2 className="font-heading text-2xl font-bold">Laporan terbaru</h2>
          </div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-strong"
          >
            Lihat semua <IconArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>

        {latest.queryFailed ? (
          <p className="mt-6 rounded-lg border bg-surface p-4 text-sm text-muted-foreground">
            Laporan publik belum dapat dimuat. Coba lagi nanti.
          </p>
        ) : (
          <div className="mt-6">
            <ReportGrid reports={latest.reports} />
          </div>
        )}
      </section>
    </>
  );
}
