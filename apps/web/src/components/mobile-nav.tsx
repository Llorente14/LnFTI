"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { getActiveMobileNavigationHref, mobileNavigation } from "@/lib/navigation";

export function MobileNav() {
  const pathname = usePathname();
  const activeHref = getActiveMobileNavigationHref(pathname);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden" aria-label="Navigasi mobile">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === activeHref;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={isActive ? "mx-auto flex min-h-12 w-16 flex-col items-center justify-center rounded-xl bg-primary text-[11px] font-semibold text-primary-foreground" : "mx-auto flex min-h-12 w-16 flex-col items-center justify-center rounded-xl text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-primary"}
              >
                <Icon size={20} stroke={1.8} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
