"use server";

import { redirect } from "next/navigation";

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

export type AuthActionState = {
  status: "idle" | "error";
  message?: string;
};

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
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
      emailRedirectTo: `${appOrigin}/auth/confirm?next=${encodeURIComponent(next)}`,
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

  redirect("/auth/check-email");
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
      message: LOGIN_ERROR,
    };
  }

  redirect(next);
}

export async function logoutAction() {
  const supabase = await createClient();

  await supabase.auth.signOut();
  redirect("/login");
}
