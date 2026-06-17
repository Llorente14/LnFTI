import { LoginForm } from "@/components/auth/login-form";
import { sanitizeNextPath } from "@/lib/auth/validation";

export const metadata = { title: "Login" };

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    message?: string | string[];
  }>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function authInfoMessage(message: string | undefined): string | undefined {
  if (message === "confirmation_failed") {
    return "Link konfirmasi tidak valid atau sudah kedaluwarsa.";
  }

  if (message === "profile_unavailable") {
    return "Email sudah dikonfirmasi, tetapi profil belum dapat dibuka. Hubungi admin LnFTI.";
  }

  return undefined;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(firstValue(params?.next));
  const infoMessage = authInfoMessage(firstValue(params?.message));

  return (
    <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md items-center px-4 py-16 sm:px-6">
      <div className="w-full rounded-xl border bg-surface p-6 sm:p-8">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Akses akun</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Masuk ke LnFTI</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Gunakan email institusional mahasiswa UNTAR FTI.
        </p>
        <div className="mt-7">
          <LoginForm nextPath={nextPath} infoMessage={infoMessage} />
        </div>
      </div>
    </section>
  );
}
