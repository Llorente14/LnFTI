import "server-only";

import { getCurrentProfile, getCurrentUser, requireUser } from "@/lib/auth/server";
import { CLAIM_STATUSES, type ClaimStatus } from "@/lib/claims/validation";
import type { PublicReport } from "@/lib/reports/public-queries";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_CLAIM_STATUSES: ClaimStatus[] = ["PENDING", "APPROVED", "COMPLETED"];
const MY_CLAIMS_PAGE_SIZE = 12;
const CLAIM_COLUMNS =
  "id, report_id, ownership_evidence_private, claim_status, decision_reason, expires_at, created_at";
const PUBLIC_REPORT_COLUMNS =
  "id, report_type, item_name, category, public_description, campus, building, event_at, report_status, custody_status, published_at, created_at";

export type ClaimEligibilityState =
  | "anonymous"
  | "non_student"
  | "unverified"
  | "owner"
  | "existing_pending_claim"
  | "existing_approved_claim"
  | "unavailable"
  | "claimable";

export type ClaimEligibility = {
  state: ClaimEligibilityState;
};

export type MyClaim = {
  id: string;
  report_id: string;
  ownership_evidence_private: string;
  claim_status: ClaimStatus;
  decision_reason: string | null;
  expires_at: string | null;
  created_at: string;
  publicReport: PublicReport | null;
};

export type MyClaimsFilters = {
  status?: ClaimStatus | "ALL";
  page?: number;
  created?: boolean;
};

function safeServerLog(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}

function normalizePage(page: number | undefined) {
  if (!page || Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.min(Math.trunc(page), 100);
}

export async function getClaimEligibilityForReport(report: PublicReport): Promise<ClaimEligibility> {
  if (report.report_type !== "FOUND" || report.custody_status === "HANDED_OVER") {
    return { state: "unavailable" };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { state: "anonymous" };
  }

  const profile = await getCurrentProfile();

  if (!profile || profile.role !== "student") {
    return { state: "non_student" };
  }

  if (profile.verification_status !== "VERIFIED") {
    return { state: "unverified" };
  }

  const supabase = await createClient();
  const { data: ownReport, error: ownReportError } = await supabase
    .from("reports")
    .select("id")
    .eq("id", report.id)
    .eq("reporter_id", user.id)
    .maybeSingle();

  if (ownReportError) {
    safeServerLog("Claim owner check failed.");
    return { state: "unavailable" };
  }

  if (ownReport) {
    return { state: "owner" };
  }

  const { data: existingClaim, error: claimError } = await supabase
    .from("claims")
    .select("claim_status")
    .eq("report_id", report.id)
    .eq("claimant_id", user.id)
    .in("claim_status", ACTIVE_CLAIM_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (claimError) {
    safeServerLog("Claim eligibility active claim check failed.");
    return { state: "unavailable" };
  }

  if (existingClaim?.claim_status === "PENDING") {
    return { state: "existing_pending_claim" };
  }

  if (existingClaim?.claim_status === "APPROVED" || existingClaim?.claim_status === "COMPLETED") {
    return { state: "existing_approved_claim" };
  }

  return { state: "claimable" };
}

function normalizeStatus(value: string | undefined): ClaimStatus | "ALL" {
  const status = (value ?? "ALL").toUpperCase();

  if (status === "ALL" || CLAIM_STATUSES.includes(status as ClaimStatus)) {
    return status as ClaimStatus | "ALL";
  }

  return "ALL";
}

export function parseMyClaimsFilters(params: Record<string, string | string[] | undefined> = {}): MyClaimsFilters {
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const created = (Array.isArray(params.created) ? params.created[0] : params.created) === "1";

  return {
    status: normalizeStatus(rawStatus),
    page: normalizePage(Number.parseInt(rawPage ?? "1", 10)),
    created,
  };
}

export function buildMyClaimsHref(filters: MyClaimsFilters, overrides: Partial<MyClaimsFilters> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.status && next.status !== "ALL") params.set("status", next.status);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  if (next.created) params.set("created", "1");

  const query = params.toString();

  return query ? `/me/claims?${query}` : "/me/claims";
}

export async function getMyClaims(filters: MyClaimsFilters = {}) {
  const user = await requireUser("/me/claims");
  const page = normalizePage(filters.page);
  const from = (page - 1) * MY_CLAIMS_PAGE_SIZE;
  const to = from + MY_CLAIMS_PAGE_SIZE - 1;
  const supabase = await createClient();
  let query = supabase
    .from("claims")
    .select(CLAIM_COLUMNS, { count: "exact" })
    .eq("claimant_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status && filters.status !== "ALL") {
    query = query.eq("claim_status", filters.status);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    safeServerLog("My claims query failed.");
    return { claims: [], totalCount: 0, page, pageCount: 0, queryFailed: true };
  }

  const claims = data as Array<Omit<MyClaim, "publicReport">>;
  const reportIds = Array.from(new Set(claims.map((claim) => claim.report_id)));
  const publicReportsById = new Map<string, PublicReport>();

  if (reportIds.length > 0) {
    const { data: reports, error: reportError } = await supabase
      .from("public_reports")
      .select(PUBLIC_REPORT_COLUMNS)
      .in("id", reportIds);

    if (reportError) {
      safeServerLog("My claims public report lookup failed.");
    }

    for (const report of (reports ?? []) as PublicReport[]) {
      publicReportsById.set(report.id, report);
    }
  }

  const totalCount = count ?? 0;

  return {
    claims: claims.map((claim) => ({
      ...claim,
      publicReport: publicReportsById.get(claim.report_id) ?? null,
    })),
    totalCount,
    page,
    pageCount: Math.ceil(totalCount / MY_CLAIMS_PAGE_SIZE),
    queryFailed: false,
  };
}
