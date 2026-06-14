import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { sanitizeNextPath } from "@/lib/auth/validation";
import { getPublicEnv } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();

  if (isProtectedPath(request.nextUrl.pathname) && (error || !data?.claims)) {
    const pathWithQuery = sanitizeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirectUrl = request.nextUrl.clone();

    redirectUrl.pathname = "/login";
    redirectUrl.search = `?next=${encodeURIComponent(pathWithQuery)}`;

    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

function isProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/me/") || pathname === "/report/new" || pathname.startsWith("/admin");
}
