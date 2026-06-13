import Link from "next/link";
import { IconSearch } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { publicNavigation } from "@/lib/navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--crimson-deep)] text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-heading text-base font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          L<span className="text-[var(--gold-light)]">&amp;</span>F
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigasi utama">
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/70 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/reports" aria-label="Cari laporan" className="inline-flex size-10 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white md:hidden">
            <IconSearch size={19} aria-hidden="true" />
          </Link>
          <Button asChild variant="secondary" size="sm" className="hidden border-white/40 text-white hover:bg-white/10 sm:inline-flex">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/report/new">Laporkan</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
