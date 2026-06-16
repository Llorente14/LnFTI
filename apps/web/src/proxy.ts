import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

const PWA_PUBLIC_PATHS = new Set([
  "/offline",
  "/manifest.webmanifest",
  "/sw.js",
]);

export async function proxy(request: NextRequest) {
  if (PWA_PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
