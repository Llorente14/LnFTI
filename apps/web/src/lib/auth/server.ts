import "server-only";

import { notFound, redirect } from "next/navigation";

import { isAllowedRole, type ApplicationRole } from "@/lib/auth/role";
import { DEFAULT_AUTH_REDIRECT, sanitizeNextPath } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  role: ApplicationRole;
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

async function readOwnProfile(userId: string): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, nim, program_study_code, cohort_year, verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || !isAllowedRole(data.role, ["student", "verifier", "admin"])) {
    return null;
  }

  return data as CurrentProfile;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return readOwnProfile(user.id);
}

export async function requireRole(
  allowedRoles: readonly ApplicationRole[],
  nextPath: string = DEFAULT_AUTH_REDIRECT,
) {
  const user = await requireUser(nextPath);
  const profile = await readOwnProfile(user.id);

  if (!profile || !allowedRoles.includes(profile.role)) {
    notFound();
  }

  return { user, profile };
}
