"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconUser } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getActiveHeaderActionHref,
  getActivePublicNavigationHref,
  publicNavigation,
} from "@/lib/navigation";

type SiteHeaderNavigationProps = {
  isAuthenticated: boolean;
  userLabel: string;
};

export function SiteHeaderNavigation({ isAuthenticated, userLabel }: SiteHeaderNavigationProps) {
  const pathname = usePathname();
  const activePublicHref = getActivePublicNavigationHref(pathname);
  const activeActionHref = getActiveHeaderActionHref(pathname);

  return (
    <>
      <nav className="hidden items-center gap-6 md:flex" aria-label="Navigasi utama">
        {publicNavigation.map((item) => {
          const isActive = item.href === activePublicHref;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "text-sm font-semibold text-white transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
                isActive ? "opacity-100" : "opacity-60",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        {isAuthenticated ? (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={cn(
              "max-w-40 border-white/40 text-white transition-opacity hover:bg-white/10 hover:opacity-100 sm:max-w-56",
              activeActionHref === "/me/profile" ? "opacity-100" : "opacity-60",
            )}
          >
            <Link href="/me/profile" aria-current={activeActionHref === "/me/profile" ? "page" : undefined} aria-label={`Buka profil ${userLabel}`}>
              <IconUser size={16} aria-hidden="true" />
              <span className="truncate">{userLabel}</span>
            </Link>
          </Button>
        ) : (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className={cn(
              "hidden border-white/40 text-white transition-opacity hover:bg-white/10 hover:opacity-100 sm:inline-flex",
              activeActionHref === "/login" ? "opacity-100" : "opacity-60",
            )}
          >
            <Link href="/login" aria-current={activeActionHref === "/login" ? "page" : undefined}>Login</Link>
          </Button>
        )}
        <Button
          asChild
          variant="gold"
          size="sm"
          className={cn(
            "transition-opacity hover:opacity-100",
            activeActionHref === "/report/new" ? "opacity-100" : "opacity-60",
          )}
        >
          <Link href="/report/new" aria-current={activeActionHref === "/report/new" ? "page" : undefined}>Laporkan</Link>
        </Button>
      </div>
    </>
  );
}
