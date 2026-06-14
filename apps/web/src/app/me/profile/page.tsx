import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getCurrentProfile, requireUser } from "@/lib/auth/server";
import { logoutAction } from "@/lib/auth/actions";

export const metadata = { title: "Profil Saya" };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-primary">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requireUser("/me/profile");
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/auth/check-email");
  }

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-xl border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Profil mahasiswa</p>
            <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight">Akun saya</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Data institusional ini berasal dari validasi Supabase Auth dan trigger database.
            </p>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Keluar
            </Button>
          </form>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Field label="Nama lengkap" value={profile.display_name ?? "-"} />
          <Field label="Email" value={user.email ?? "-"} />
          <Field label="NIM" value={profile.nim ?? "-"} />
          <Field label="Program studi" value={profile.program_study_code ?? "-"} />
          <Field label="Angkatan" value={profile.cohort_year ? String(profile.cohort_year) : "-"} />
          <Field label="Status verifikasi" value={profile.verification_status} />
          <Field label="Role" value={profile.role} />
        </div>
      </div>
    </section>
  );
}
