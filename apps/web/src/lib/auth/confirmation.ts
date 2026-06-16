import { sanitizeNextPath } from "@/lib/auth/validation";

export const allowedConfirmationTypes = ["signup", "email"] as const;

export type AllowedConfirmationType = (typeof allowedConfirmationTypes)[number];

export function isAllowedConfirmationType(value: string | null): value is AllowedConfirmationType {
  return value === "signup" || value === "email";
}

export function buildConfirmationCallbackUrl(appOrigin: string, nextPath: string | null): string {
  const url = new URL("/auth/confirm", appOrigin);

  url.searchParams.set("next", sanitizeNextPath(nextPath));

  return url.toString();
}

export function buildConfirmationRedirectUrl(appOrigin: string, nextPath: string | null): string {
  return new URL(sanitizeNextPath(nextPath), appOrigin).toString();
}

export function buildConfirmationFailureUrl(appOrigin: string): string {
  return new URL("/login?message=confirmation_failed", appOrigin).toString();
}
