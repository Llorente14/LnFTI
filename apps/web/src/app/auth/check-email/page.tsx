import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata = { title: "Cek Email" };

export default function CheckEmailPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border bg-surface p-6 sm:p-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Konfirmasi email</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Cek email institusional</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Buka link konfirmasi dari Supabase Auth di inbox email mahasiswa. Setelah terkonfirmasi, masuk kembali ke LnFTI.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Masuk</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/">Beranda</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
