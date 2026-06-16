import type { Metadata } from "next";
import Link from "next/link";

import { OfflineRetryButton } from "@/components/pwa/offline-retry-button";

export const metadata: Metadata = {
  title: "Anda sedang offline",
  robots: {
    index: false,
    follow: false,
  },
};

const blockedActions = [
  "melihat laporan terbaru",
  "mengirim laporan",
  "mengirim klaim",
  "memproses verifikasi",
  "menyelesaikan serah-terima",
];

export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-3xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8 rounded-lg border bg-surface p-6 sm:p-8">
        <div className="space-y-3">
          <p className="text-sm font-bold uppercase tracking-wide text-primary">LnFTI offline</p>
          <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
            Anda sedang offline
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground">
            LnFTI memerlukan koneksi internet untuk menampilkan data laporan dan memproses perubahan status.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">Perlu koneksi untuk:</h2>
          <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {blockedActions.map((action) => (
              <li key={action} className="rounded-md border bg-background px-3 py-2">
                {action}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <OfflineRetryButton />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border px-5 text-sm font-bold text-primary transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Ke beranda
          </Link>
        </div>
      </div>
    </section>
  );
}
