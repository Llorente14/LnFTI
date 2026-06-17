import Link from "next/link";

import { SiteHeaderNavigation } from "@/components/site-header-navigation";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server";

function resolveUserLabel(
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  displayName: string | null | undefined,
) {
  const profileName = displayName?.trim();
  if (profileName) return profileName;

  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();

  const name = user?.user_metadata?.name;
  if (typeof name === "string" && name.trim()) return name.trim();

  return user?.email?.split("@")[0] ?? "Profil";
}

export async function SiteHeader() {
  const user = await getCurrentUser();
  const profile = user ? await getCurrentProfile() : null;
  const userLabel = resolveUserLabel(user, profile?.display_name);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[var(--crimson-deep)] text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-heading text-base font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          L<span className="text-[var(--gold-light)]">&amp;</span>F
        </Link>

        <SiteHeaderNavigation isAuthenticated={Boolean(user)} userLabel={userLabel} />
      </div>
    </header>
  );
}
