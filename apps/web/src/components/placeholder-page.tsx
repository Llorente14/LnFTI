import Link from "next/link";

import { Button } from "@/components/ui/button";

interface PlaceholderPageProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PlaceholderPage({ eyebrow, title, description }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border bg-surface p-6 sm:p-10">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild><Link href="/">Kembali ke beranda</Link></Button>
          <Button asChild variant="secondary"><Link href="/reports">Lihat laporan</Link></Button>
        </div>
      </div>
    </section>
  );
}
