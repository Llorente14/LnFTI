import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildConfirmationFailureUrl,
  buildConfirmationRedirectUrl,
  isAllowedConfirmationType,
} from "@/lib/auth/confirmation";
import { getAppOrigin, getPublicEnv } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function createConfirmationClient(request: NextRequest) {
  const env = getPublicEnv();
  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(nextCookies: CookieToSet[]) {
        cookiesToSet.push(...nextCookies);
      },
    },
  });

  return {
    supabase,
    redirect(url: string) {
      const response = NextResponse.redirect(url);

      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });

      return response;
    },
  };
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");
  const appOrigin = getAppOrigin();

  if (!tokenHash || !isAllowedConfirmationType(type)) {
    return NextResponse.redirect(buildConfirmationFailureUrl(appOrigin));
  }

  const auth = createConfirmationClient(request);
  const { error } = await auth.supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return auth.redirect(buildConfirmationFailureUrl(appOrigin));
  }

  return auth.redirect(buildConfirmationRedirectUrl(appOrigin, next));
}
