import type { ReactNode } from "react";

import { MobileNav } from "@/components/mobile-nav";
import { SiteHeader } from "@/components/site-header";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="pb-24 md:pb-10">{children}</main>
      <MobileNav />
    </div>
  );
}
