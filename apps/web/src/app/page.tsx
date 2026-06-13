import Link from "next/link";
import {
  IconArrowRight,
  IconBottle,
  IconCreditCard,
  IconDeviceLaptop,
  IconSearch,
  IconWallet,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";

const categories = [
  { label: "KTM & Kartu", icon: IconCreditCard },
  { label: "Elektronik", icon: IconDeviceLaptop },
  { label: "Dompet", icon: IconWallet },
  { label: "Botol", icon: IconBottle },
];

const sampleReports = [
  { type: "DITEMUKAN", name: "Charger laptop silver", place: "Gedung R lantai 5", date: "Hari ini" },
  { type: "HILANG", name: "Dompet hitam", place: "Gedung M lantai 3", date: "Kemarin" },
  { type: "DITEMUKAN", name: "Kartu mahasiswa", place: "Kantin Kampus I", date: "2 hari lalu" },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.15fr_0.85fr] md:py-16 lg:px-8">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Untar Lost &amp; Found</p>
            <h1 className="mt-3 max-w-3xl font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Kehilangan atau menemukan barang di kampus?</h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">Cari laporan yang masih aktif atau bantu pemilik menemukan barangnya melalui satu kanal yang terstruktur.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg"><Link href="/report/new?type=lost">Saya kehilangan barang</Link></Button>
              <Button asChild variant="gold" size="lg"><Link href="/report/new?type=found">Saya menemukan barang</Link></Button>
            </div>
          </div>

          <div className="self-end rounded-xl border bg-background p-4 sm:p-5">
            <label htmlFor="report-search" className="font-heading text-sm font-semibold">Cari laporan</label>
            <div className="mt-3 flex min-h-12 items-center gap-3 rounded-full border bg-surface px-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring">
              <IconSearch size={19} className="text-primary" aria-hidden="true" />
              <input id="report-search" type="search" placeholder="Nama barang, lokasi, atau kategori" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]" />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Pencarian fungsional akan dihubungkan pada ticket public browse.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(({ label, icon: Icon }) => (
            <button key={label} type="button" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border bg-surface px-4 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:bg-muted hover:text-primary">
              <Icon size={18} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-primary">Preview fondasi UI</p>
            <h2 className="font-heading text-2xl font-bold">Laporan terbaru</h2>
          </div>
          <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-strong">Lihat semua <IconArrowRight size={17} aria-hidden="true" /></Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sampleReports.map((report) => (
            <article key={report.name} className="overflow-hidden rounded-xl border bg-surface transition-colors hover:border-primary/25 hover:bg-[var(--crimson-pale-2)]">
              <div className="flex aspect-[4/3] items-center justify-center bg-muted text-sm text-muted-foreground">Placeholder foto barang</div>
              <div className="p-4">
                <span className={report.type === "HILANG" ? "rounded-full bg-[#ffeaea] px-2.5 py-1 font-heading text-[11px] font-semibold text-[#991b1b]" : "rounded-full bg-[#e8f5ec] px-2.5 py-1 font-heading text-[11px] font-semibold text-[#166534]"}>{report.type}</span>
                <h3 className="mt-3 font-heading text-base font-semibold">{report.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{report.place} • {report.date}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
