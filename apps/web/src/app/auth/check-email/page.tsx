import Link from "next/link";

import { Button } from "@/components/ui/button";
import { resendConfirmationAction } from "@/lib/auth/actions";
import { sanitizeNextPath } from "@/lib/auth/validation";

export const metadata = { title: "Cek Email" };

type CheckEmailPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    message?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CheckEmailPage({ searchParams }: CheckEmailPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(firstValue(params?.next));
  const showResentMessage = firstValue(params?.message) === "resent";

  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border bg-surface p-6 sm:p-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Konfirmasi email</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Cek email institusional</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Buka link konfirmasi dari Supabase Auth di inbox email mahasiswa. Setelah terkonfirmasi, masuk kembali ke LnFTI.
        </p>
        {showResentMessage ? (
          <p className="mt-5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Jika email terdaftar dan batas pengiriman mengizinkan, link konfirmasi baru akan dikirim.
          </p>
        ) : null}
        <form action={resendConfirmationAction} className="mt-7 space-y-3">
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="email" className="font-heading text-sm font-semibold">
            Kirim ulang link
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="h-11 w-full rounded-md border bg-surface px-3 text-sm"
            placeholder="nama.535240143@stu.untar.ac.id"
          />
          <Button type="submit" variant="secondary" className="w-full">
            Kirim ulang
          </Button>
        </form>
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
