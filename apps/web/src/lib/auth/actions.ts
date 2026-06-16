"use server";

import { redirect } from "next/navigation";

import {
  buildConfirmationCallbackUrl,
} from "@/lib/auth/confirmation";
import {
  sanitizeNextPath,
  validateInstitutionalEmail,
  validateInstitutionalIdentity,
} from "@/lib/auth/validation";
import { getAppOrigin } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const REGISTER_ERROR =
  "Registrasi tidak dapat diproses. Email atau NIM mungkin sudah digunakan.";
const LOGIN_ERROR = "Email atau password tidak valid.";
const LOGIN_EMAIL_NOT_CONFIRMED_ERROR =
  "Email belum dikonfirmasi. Cek inbox email institusional sebelum masuk.";

export type AuthActionState = {
  status: "idle" | "error";
  message?: string;
};

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
}

function isEmailNotConfirmedError(error: { code?: string; message?: string } | null): boolean {
  const code = error?.code?.toLowerCase();
  const message = error?.message?.toLowerCase() ?? "";

  return code === "email_not_confirmed"
    || message.includes("email not confirmed")
    || message.includes("email_not_confirmed");
}

export async function registerAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const next = sanitizeNextPath(formString(formData, "next"));
  const password = formString(formData, "password");
  const passwordConfirmation = formString(formData, "password_confirmation");
  let email: string;
  let fullName: string;
  let nim: string;

  try {
    const identity = validateInstitutionalIdentity({
      fullName: formString(formData, "full_name"),
      nim: formString(formData, "nim"),
      email: formString(formData, "email"),
      password,
      passwordConfirmation,
    });

    email = identity.email;
    fullName = identity.fullName;
    nim = identity.nim;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Data registrasi tidak valid.",
    };
  }

  const supabase = await createClient();
  const appOrigin = getAppOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        nim,
      },
      emailRedirectTo: buildConfirmationCallbackUrl(appOrigin, next),
    },
  });

  if (error || (data.user?.identities && data.user.identities.length === 0)) {
    return {
      status: "error",
      message: REGISTER_ERROR,
    };
  }

  if (data.session) {
    redirect(next);
  }

  redirect(`/auth/check-email?next=${encodeURIComponent(next)}`);
}

export async function loginAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const next = sanitizeNextPath(formString(formData, "next"));
  const password = formString(formData, "password");
  let email: string;

  try {
    email = validateInstitutionalEmail(formString(formData, "email"));
  } catch {
    return {
      status: "error",
      message: LOGIN_ERROR,
    };
  }

  if (!password) {
    return {
      status: "error",
      message: LOGIN_ERROR,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      status: "error",
      message: isEmailNotConfirmedError(error) ? LOGIN_EMAIL_NOT_CONFIRMED_ERROR : LOGIN_ERROR,
    };
  }

  redirect(next);
}

export async function resendConfirmationAction(formData: FormData) {
  const next = sanitizeNextPath(formString(formData, "next"));
  let email: string;

  try {
    email = validateInstitutionalEmail(formString(formData, "email"));
  } catch {
    redirect(`/auth/check-email?next=${encodeURIComponent(next)}&message=resent`);
  }

  const supabase = await createClient();
  const appOrigin = getAppOrigin();

  await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: buildConfirmationCallbackUrl(appOrigin, next),
    },
  });

  redirect(`/auth/check-email?next=${encodeURIComponent(next)}&message=resent`);
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/login");
}
