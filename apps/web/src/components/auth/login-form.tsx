"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = { status: "idle" };

export function LoginForm({
  nextPath,
  infoMessage,
}: {
  nextPath: string;
  infoMessage?: string;
}) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={nextPath} />

      {infoMessage ? (
        <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{infoMessage}</p>
      ) : null}

      {state.status === "error" && state.message ? (
        <p className="rounded-md border border-primary/30 bg-[var(--crimson-pale-2)] px-3 py-2 text-sm text-primary">
          {state.message}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="email" className="font-heading text-sm font-semibold">
          Email institusional
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
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="font-heading text-sm font-semibold">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-md border bg-surface px-3 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-strong disabled:pointer-events-none disabled:opacity-50"
      >
        {isPending ? "Memproses..." : "Masuk"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href={`/register?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-primary">
          Daftar
        </Link>
      </p>
    </form>
  );
}
