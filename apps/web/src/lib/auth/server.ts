import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_AUTH_REDIRECT, sanitizeNextPath } from "@/lib/auth/validation";

export type CurrentProfile = {
  id: string;
  role: string;
  display_name: string | null;
  nim: string | null;
  program_study_code: string | null;
  cohort_year: number | null;
  verification_status: string;
};

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user;
}

export async function requireUser(nextPath: string = DEFAULT_AUTH_REDIRECT) {
  const user = await getCurrentUser();

  if (!user) {
    const next = encodeURIComponent(sanitizeNextPath(nextPath));
    redirect(`/login?next=${next}`);
  }

  if (!user.email_confirmed_at) {
    redirect("/auth/check-email");
  }

  return user;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, nim, program_study_code, cohort_year, verification_status")
    .single();

  if (error) {
    return null;
  }

  return data as CurrentProfile;
}
