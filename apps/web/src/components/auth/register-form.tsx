"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { registerAction, type AuthActionState } from "@/lib/auth/actions";
import { buildInstitutionalEmail, parseNim } from "@/lib/auth/validation";

const initialState: AuthActionState = { status: "idle" };

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const [fullName, setFullName] = useState("");
  const [nim, setNim] = useState("");
  const [email, setEmail] = useState("");
  const [state, formAction, isPending] = useActionState(registerAction, initialState);

  const derived = useMemo(() => {
    try {
      const parsed = parseNim(nim);
      const expectedEmail = fullName ? buildInstitutionalEmail(fullName, nim) : "";

      return {
        program: parsed.programStudyName,
        cohort: String(parsed.cohortYear),
        expectedEmail,
      };
    } catch {
      return {
        program: "-",
        cohort: "-",
        expectedEmail: "",
      };
    }
  }, [fullName, nim]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-primary/30 bg-[var(--crimson-pale-2)] px-3 py-2 text-sm text-primary">
          {state.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="full_name" className="font-heading text-sm font-semibold">Nama lengkap</label>
          <input id="full_name" name="full_name" type="text" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="Axel Chrisdy" />
        </div>

        <div className="space-y-2">
          <label htmlFor="nim" className="font-heading text-sm font-semibold">NIM</label>
          <input id="nim" name="nim" type="text" inputMode="numeric" autoComplete="off" required value={nim} onChange={(event) => setNim(event.target.value)} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="535240143" />
        </div>

        <div className="space-y-2">
          <label htmlFor="program" className="font-heading text-sm font-semibold">Program studi</label>
          <input id="program" type="text" value={derived.program} readOnly className="h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <label htmlFor="cohort" className="font-heading text-sm font-semibold">Angkatan</label>
          <input id="cohort" type="text" value={derived.cohort} readOnly className="h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" />
        </div>

        <div className="space-y-2">
          <label htmlFor="expected_email" className="font-heading text-sm font-semibold">Email seharusnya</label>
          <input id="expected_email" type="text" value={derived.expectedEmail} readOnly className="h-11 w-full rounded-md border bg-muted px-3 text-sm text-muted-foreground" />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="email" className="font-heading text-sm font-semibold">Email institusional</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-md border bg-surface px-3 text-sm" placeholder="axel.535240143@stu.untar.ac.id" />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="font-heading text-sm font-semibold">Password</label>
          <PasswordField id="password" name="password" autoComplete="new-password" required minLength={8} className="h-11 rounded-md border bg-surface px-3 text-sm" />
        </div>

        <div className="space-y-2">
          <label htmlFor="password_confirmation" className="font-heading text-sm font-semibold">Konfirmasi password</label>
          <PasswordField id="password_confirmation" name="password_confirmation" autoComplete="new-password" required minLength={8} className="h-11 rounded-md border bg-surface px-3 text-sm" />
        </div>
      </div>

      <button type="submit" disabled={isPending} className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:pointer-events-none disabled:opacity-50">
        {isPending ? "Memproses..." : "Daftar"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-primary">Masuk</Link>
      </p>
    </form>
  );
}
