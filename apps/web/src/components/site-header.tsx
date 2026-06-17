import Link from "next/link";
import { IconUser } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/server";
import { publicNavigation } from "@/lib/navigation";

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

        <nav className="hidden items-center gap-6 md:flex" aria-label="Navigasi utama">
          {publicNavigation.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-white/70 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild variant="secondary" size="sm" className="max-w-40 border-white/40 text-white hover:bg-white/10 sm:max-w-56">
              <Link href="/me/profile" aria-label={`Buka profil ${userLabel}`}>
                <IconUser size={16} aria-hidden="true" />
                <span className="truncate">{userLabel}</span>
              </Link>
            </Button>
          ) : (
            <Button asChild variant="secondary" size="sm" className="hidden border-white/40 text-white hover:bg-white/10 sm:inline-flex">
              <Link href="/login">Login</Link>
            </Button>
          )}
          <Button asChild variant="gold" size="sm">
            <Link href="/report/new">Laporkan</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
