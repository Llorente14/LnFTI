import { RegisterForm } from "@/components/auth/register-form";
import { sanitizeNextPath } from "@/lib/auth/validation";

export const metadata = { title: "Daftar" };

type RegisterPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(firstValue(params?.next));

  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border bg-surface p-6 sm:p-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Akun mahasiswa</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Daftar LnFTI</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Format email: nama-depan-tervalidasi.NIM@stu.untar.ac.id.
        </p>
        <div className="mt-7">
          <RegisterForm nextPath={nextPath} />
        </div>
      </div>
    </section>
  );
}
