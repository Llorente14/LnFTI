import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  buildConfirmationFailureUrl,
  buildConfirmationRedirectUrl,
  isAllowedConfirmationType,
} from "@/lib/auth/confirmation";
import { getAppOrigin } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type");
  const next = requestUrl.searchParams.get("next");
  const appOrigin = getAppOrigin();

  if (!tokenHash || !isAllowedConfirmationType(type)) {
    return NextResponse.redirect(buildConfirmationFailureUrl(appOrigin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    return NextResponse.redirect(buildConfirmationFailureUrl(appOrigin));
  }

  return NextResponse.redirect(buildConfirmationRedirectUrl(appOrigin, next));
}
