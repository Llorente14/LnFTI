import "server-only";

import { claimOverdueCutoffIso, isClaimOverdue } from "@/lib/admin/claim-review-validation";
import type { AdminCustodyStatus, AdminReportStatus, AdminReportType, ReporterProfile, VerifierReportImage } from "@/lib/admin/report-review";
import { REPORT_IMAGE_BUCKET } from "@/lib/reports/constants";
import { createClient } from "@/lib/supabase/server";

const CLAIM_PAGE_SIZE = 20;
const CLAIM_IMAGE_TTL_SECONDS = 12 * 60;
const CLAIM_QUEUE_BASE_COLUMNS =
  "id, report_id, claimant_id, claim_status, created_at, decided_at, decision_reason, claimant:profiles!claims_claimant_id_fkey(display_name, nim, program_study_code, cohort_year, verification_status)";
const CLAIM_QUEUE_REPORT_COLUMNS =
  "id, item_name, category, campus, building, report_status, custody_status";
const CLAIM_DETAIL_COLUMNS =
  "id, report_id, claimant_id, ownership_evidence_private, claim_status, created_at, decided_at, decision_reason, expires_at, claimant:profiles!claims_claimant_id_fkey(display_name, nim, program_study_code, cohort_year, verification_status), report:reports!claims_report_id_fkey(id, reporter_id, report_type, item_name, category, public_description, private_characteristics, campus, building, location_detail, report_status, custody_status, created_at, published_at, reporter:profiles!reports_reporter_id_fkey(display_name, nim, program_study_code))";
const CLAIM_IMAGE_COLUMNS = "report_id, storage_path, alt_text, sort_order";

export type AdminClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED" | "COMPLETED";
export type ClaimQueueOrder = "oldest" | "newest";

export type ClaimantProfile = {
  display_name: string | null;
  nim: string | null;
  program_study_code: string | null;
  cohort_year: number | null;
  verification_status: string;
};

export type ClaimQueueReport = {
  id: string;
  item_name: string;
  category: string;
  campus: string | null;
  building: string;
  report_status: AdminReportStatus;
  custody_status: AdminCustodyStatus;
};

export type ClaimQueueItem = {
  id: string;
  report_id: string;
  claimant_id: string;
  claim_status: AdminClaimStatus;
  created_at: string;
  decided_at: string | null;
  decision_reason: string | null;
  claimant: ClaimantProfile | null;
  report: ClaimQueueReport | null;
  isOverdue: boolean;
};

export type ClaimDetailReport = ClaimQueueReport & {
  reporter_id: string;
  report_type: AdminReportType;
  public_description: string;
  private_characteristics: string | null;
  location_detail: string | null;
  created_at: string;
  published_at: string | null;
  reporter: ReporterProfile | null;
};

export type ClaimDetail = Omit<ClaimQueueItem, "report" | "isOverdue"> & {
  ownership_evidence_private: string;
  expires_at: string | null;
  report: ClaimDetailReport | null;
  isOverdue: boolean;
};

export type ClaimFilters = {
  status?: AdminClaimStatus | "ALL";
  category?: string;
  page?: number;
  overdue?: boolean;
  order?: ClaimQueueOrder;
};

type CountResult = {
  count: number;
  queryFailed: boolean;
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

function claimQueueColumns(requireReportMatch: boolean) {
  const reportJoin = requireReportMatch
    ? `report:reports!claims_report_id_fkey!inner(${CLAIM_QUEUE_REPORT_COLUMNS})`
    : `report:reports!claims_report_id_fkey(${CLAIM_QUEUE_REPORT_COLUMNS})`;

  return `${CLAIM_QUEUE_BASE_COLUMNS}, ${reportJoin}`;
}

function firstEmbedded<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeQueueRow(row: unknown): ClaimQueueItem {
  const claim = row as Omit<ClaimQueueItem, "claimant" | "report" | "isOverdue"> & {
    claimant: ClaimantProfile[] | ClaimantProfile | null;
    report: ClaimQueueReport[] | ClaimQueueReport | null;
  };

  return {
    ...claim,
    claimant: firstEmbedded(claim.claimant),
    report: firstEmbedded(claim.report),
    isOverdue: claim.claim_status === "PENDING" && isClaimOverdue(claim.created_at),
  };
}

function normalizeDetailRow(row: unknown): ClaimDetail {
  const claim = row as Omit<ClaimDetail, "claimant" | "report" | "isOverdue"> & {
    claimant: ClaimantProfile[] | ClaimantProfile | null;
    report: Array<Omit<ClaimDetailReport, "reporter"> & { reporter: ReporterProfile[] | ReporterProfile | null }>
      | (Omit<ClaimDetailReport, "reporter"> & { reporter: ReporterProfile[] | ReporterProfile | null })
      | null;
  };
  const report = firstEmbedded(claim.report);

  return {
    ...claim,
    claimant: firstEmbedded(claim.claimant),
    report: report ? { ...report, reporter: firstEmbedded(report.reporter) } : null,
    isOverdue: claim.claim_status === "PENDING" && isClaimOverdue(claim.created_at),
  };
}

async function countClaimsByStatus(status: AdminClaimStatus): Promise<CountResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("claim_status", status);

  if (error) {
    safeServerLog("Claim dashboard count failed.");
    return { count: 0, queryFailed: true };
  }

  return { count: count ?? 0, queryFailed: false };
}

async function countOverduePendingClaims(): Promise<CountResult> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("claims")
    .select("id", { count: "exact", head: true })
    .eq("claim_status", "PENDING")
    .lt("created_at", claimOverdueCutoffIso());

  if (error) {
    safeServerLog("Overdue claim dashboard count failed.");
    return { count: 0, queryFailed: true };
  }

  return { count: count ?? 0, queryFailed: false };
}

export async function getPendingClaims(filters: ClaimFilters = {}) {
  const page = normalizePage(filters.page);
  const from = (page - 1) * CLAIM_PAGE_SIZE;
  const to = from + CLAIM_PAGE_SIZE - 1;
  const supabase = await createClient();
  const status = filters.status ?? "PENDING";
  const ascending = (filters.order ?? "oldest") === "oldest";
  let query = supabase
    .from("claims")
    .select(claimQueueColumns(Boolean(filters.category)), { count: "exact" });

  if (status !== "ALL") {
    query = query.eq("claim_status", status);
  }

  if (filters.category) {
    query = query.eq("report.category", filters.category);
  }

  if (filters.overdue) {
    query = query
      .eq("claim_status", "PENDING")
      .lt("created_at", claimOverdueCutoffIso());
  }

  const { data, error, count } = await query
    .order("created_at", { ascending })
    .range(from, to);

  if (error || !data) {
    safeServerLog("Pending claim queue query failed.");
    return { claims: [], totalCount: 0, page, pageCount: 0, queryFailed: true };
  }

  const totalCount = count ?? 0;

  return {
    claims: data.map(normalizeQueueRow),
    totalCount,
    page,
    pageCount: Math.ceil(totalCount / CLAIM_PAGE_SIZE),
    queryFailed: false,
  };
}

export async function getVerifierClaimDetail(claimId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_DETAIL_COLUMNS)
    .eq("id", claimId)
    .maybeSingle();

  if (error || !data) {
    if (error) safeServerLog("Verifier claim detail query failed.");
    return null;
  }

  return normalizeDetailRow(data);
}

async function signClaimReportImage(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .createSignedUrl(storagePath, CLAIM_IMAGE_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    safeServerLog("Claim report image signing failed.");
    return null;
  }

  return data.signedUrl;
}

export async function getClaimReportImages(reportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_images")
    .select(CLAIM_IMAGE_COLUMNS)
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (error || !data) {
    safeServerLog("Claim report image metadata query failed.");
    return [];
  }

  return Promise.all(
    (data as Array<{
      report_id: string;
      storage_path: string;
      alt_text: string | null;
      sort_order: number;
    }>).map(async (image): Promise<VerifierReportImage> => ({
      report_id: image.report_id,
      alt_text: image.alt_text,
      sort_order: image.sort_order,
      signedUrl: await signClaimReportImage(image.storage_path),
    })),
  );
}

export async function getClaimDashboardSummary() {
  const [pending, approved, overdue, recent] = await Promise.all([
    countClaimsByStatus("PENDING"),
    countClaimsByStatus("APPROVED"),
    countOverduePendingClaims(),
    getPendingClaims({ status: "ALL", page: 1, order: "newest" }),
  ]);

  return {
    pendingClaimCount: pending.count,
    overduePendingClaimCount: overdue.count,
    approvedClaimCount: approved.count,
    recentClaimActivity: recent.claims.slice(0, 5),
    queryFailed: pending.queryFailed || approved.queryFailed || overdue.queryFailed || recent.queryFailed,
  };
}
