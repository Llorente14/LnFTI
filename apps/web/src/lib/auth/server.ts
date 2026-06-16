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

export type CurrentProfileResult =
  | { status: "ok"; profile: CurrentProfile }
  | { status: "not_found" }
  | { status: "invalid_role" }
  | { status: "query_error" };

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

async function readOwnProfile(userId: string): Promise<CurrentProfileResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, display_name, nim, program_study_code, cohort_year, verification_status")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { status: "query_error" };
  }

  if (!data) {
    return { status: "not_found" };
  }

  if (!isAllowedRole(data.role, ["student", "verifier", "admin"])) {
    return { status: "invalid_role" };
  }

  return { status: "ok", profile: data as CurrentProfile };
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const result = await readOwnProfile(user.id);

  return result.status === "ok" ? result.profile : null;
}

export async function getCurrentProfileResult(): Promise<CurrentProfileResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { status: "not_found" };
  }

  return readOwnProfile(user.id);
}

export async function requireRole(
  allowedRoles: readonly ApplicationRole[],
  nextPath: string = DEFAULT_AUTH_REDIRECT,
) {
  const user = await requireUser(nextPath);
  const result = await readOwnProfile(user.id);

  if (result.status !== "ok" || !allowedRoles.includes(result.profile.role)) {
    notFound();
  }

  return { user, profile: result.profile };
}
