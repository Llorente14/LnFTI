import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { AdminClaimStatus, ClaimantProfile } from "@/lib/admin/claim-review";
import type { AdminCustodyStatus, AdminReportStatus } from "@/lib/admin/report-review";

const HANDOVER_PAGE_SIZE = 20;

const PENDING_CLAIM_COLUMNS =
  "id, report_id, claimant_id, claim_status, decided_at, report:reports!claims_report_id_fkey!inner(id, item_name, category, report_status, custody_status)";
const HANDOVER_COLUMNS =
  "id, report_id, claim_id, verifier_id, recipient_id, handover_at, handover_location, notes";
const CLAIM_COLUMNS = "id, report_id, claimant_id, claim_status, decided_at";
const REPORT_COLUMNS = "id, item_name, category, report_status, custody_status";
const PROFILE_COLUMNS = "id, display_name, nim, program_study_code, cohort_year, verification_status";

type HandoverReport = {
  id: string;
  item_name: string;
  category: string;
  report_status: AdminReportStatus;
  custody_status: AdminCustodyStatus;
};

type PendingClaimRow = {
  id: string;
  report_id: string;
  claimant_id: string;
  claim_status: AdminClaimStatus;
  decided_at: string | null;
  report: HandoverReport[] | HandoverReport | null;
};

type HandoverRow = {
  id: string;
  report_id: string;
  claim_id: string;
  verifier_id: string;
  recipient_id: string;
  handover_at: string;
  handover_location: string;
  notes: string | null;
};

type ClaimRow = {
  id: string;
  report_id: string;
  claimant_id: string;
  claim_status: AdminClaimStatus;
  decided_at: string | null;
};

type ProfileRow = ClaimantProfile & { id: string };

export type HandoverQueueItem = {
  claimId: string;
  reportId: string;
  itemName: string;
  category: string;
  claimant: ClaimantProfile | null;
  custodyStatus: AdminCustodyStatus;
  approvedAt: string | null;
};

export type CompletedHandoverItem = HandoverQueueItem & {
  handoverId: string;
  handoverAt: string;
  handoverLocation: string;
  verifier: ClaimantProfile | null;
};

export type ClaimHandoverDetail = CompletedHandoverItem & {
  notes: string | null;
  recipient: ClaimantProfile | null;
};

export type HandoverFilters = {
  page?: number;
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

function firstEmbedded<T>(value: T[] | T | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

async function getProfilesById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", uniqueIds);

  if (error || !data) {
    safeServerLog("Handover profile lookup failed.");
    return new Map<string, ProfileRow>();
  }

  return new Map((data as ProfileRow[]).map((profile) => [profile.id, profile]));
}

async function getReportsById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, HandoverReport>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_COLUMNS)
    .in("id", uniqueIds);

  if (error || !data) {
    safeServerLog("Handover report lookup failed.");
    return new Map<string, HandoverReport>();
  }

  return new Map((data as HandoverReport[]).map((report) => [report.id, report]));
}

async function getClaimsById(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, ClaimRow>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("claims")
    .select(CLAIM_COLUMNS)
    .in("id", uniqueIds);

  if (error || !data) {
    safeServerLog("Handover claim lookup failed.");
    return new Map<string, ClaimRow>();
  }

  return new Map((data as ClaimRow[]).map((claim) => [claim.id, claim]));
}

export async function getPendingHandovers(filters: HandoverFilters = {}) {
  const page = normalizePage(filters.page);
  const from = (page - 1) * HANDOVER_PAGE_SIZE;
  const to = from + HANDOVER_PAGE_SIZE - 1;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("claims")
    .select(PENDING_CLAIM_COLUMNS, { count: "exact" })
    .eq("claim_status", "APPROVED")
    .eq("report.report_status", "MATCHING")
    .neq("report.custody_status", "HANDED_OVER")
    .order("decided_at", { ascending: true, nullsFirst: false })
    .range(from, to);

  if (error || !data) {
    safeServerLog("Pending handover query failed.");
    return { handovers: [], totalCount: 0, page, pageCount: 0, queryFailed: true };
  }

  const rows = data as PendingClaimRow[];
  if (rows.length === 0) {
    const totalCount = count ?? 0;

    return { handovers: [], totalCount, page, pageCount: Math.ceil(totalCount / HANDOVER_PAGE_SIZE), queryFailed: false };
  }

  const claimIds = rows.map((row) => row.id);
  const reportIds = rows.map((row) => row.report_id);
  const [profileById, existingHandovers] = await Promise.all([
    getProfilesById(rows.map((row) => row.claimant_id)),
    supabase
      .from("handovers")
      .select("claim_id, report_id")
      .or(`claim_id.in.(${claimIds.join(",")}),report_id.in.(${reportIds.join(",")})`),
  ]);

  if (existingHandovers.error) {
    safeServerLog("Existing handover lookup failed.");
  }

  const handedClaimIds = new Set((existingHandovers.data ?? []).map((row) => row.claim_id as string));
  const handedReportIds = new Set((existingHandovers.data ?? []).map((row) => row.report_id as string));
  const pending = rows
    .filter((row) => !handedClaimIds.has(row.id) && !handedReportIds.has(row.report_id))
    .map((row): HandoverQueueItem | null => {
      const report = firstEmbedded(row.report);

      if (!report) {
        return null;
      }

      return {
        claimId: row.id,
        reportId: row.report_id,
        itemName: report.item_name,
        category: report.category,
        claimant: profileById.get(row.claimant_id) ?? null,
        custodyStatus: report.custody_status,
        approvedAt: row.decided_at,
      };
    })
    .filter((row): row is HandoverQueueItem => Boolean(row));

  return {
    handovers: pending,
    totalCount: count ?? pending.length,
    page,
    pageCount: Math.ceil((count ?? pending.length) / HANDOVER_PAGE_SIZE),
    queryFailed: false,
  };
}

export async function getCompletedHandovers(filters: HandoverFilters = {}) {
  const page = normalizePage(filters.page);
  const from = (page - 1) * HANDOVER_PAGE_SIZE;
  const to = from + HANDOVER_PAGE_SIZE - 1;
  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("handovers")
    .select(HANDOVER_COLUMNS, { count: "exact" })
    .order("handover_at", { ascending: false })
    .range(from, to);

  if (error || !data) {
    safeServerLog("Completed handover query failed.");
    return { handovers: [], totalCount: 0, page, pageCount: 0, queryFailed: true };
  }

  const rows = data as HandoverRow[];
  const [claimsById, reportsById, profilesById] = await Promise.all([
    getClaimsById(rows.map((row) => row.claim_id)),
    getReportsById(rows.map((row) => row.report_id)),
    getProfilesById(rows.flatMap((row) => [row.recipient_id, row.verifier_id])),
  ]);

  const handovers = rows.map((row): CompletedHandoverItem | null => {
    const claim = claimsById.get(row.claim_id);
    const report = reportsById.get(row.report_id);

    if (!claim || !report) {
      return null;
    }

    return {
      handoverId: row.id,
      claimId: row.claim_id,
      reportId: row.report_id,
      itemName: report.item_name,
      category: report.category,
      claimant: profilesById.get(row.recipient_id) ?? null,
      custodyStatus: report.custody_status,
      approvedAt: claim.decided_at,
      handoverAt: row.handover_at,
      handoverLocation: row.handover_location,
      verifier: profilesById.get(row.verifier_id) ?? null,
    };
  }).filter((row): row is CompletedHandoverItem => Boolean(row));

  return {
    handovers,
    totalCount: count ?? 0,
    page,
    pageCount: Math.ceil((count ?? 0) / HANDOVER_PAGE_SIZE),
    queryFailed: false,
  };
}

export async function getClaimHandover(claimId: string): Promise<ClaimHandoverDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handovers")
    .select(HANDOVER_COLUMNS)
    .eq("claim_id", claimId)
    .maybeSingle();

  if (error || !data) {
    if (error) safeServerLog("Claim handover lookup failed.");
    return null;
  }

  const row = data as HandoverRow;
  const [claimsById, reportsById, profilesById] = await Promise.all([
    getClaimsById([row.claim_id]),
    getReportsById([row.report_id]),
    getProfilesById([row.recipient_id, row.verifier_id]),
  ]);
  const claim = claimsById.get(row.claim_id);
  const report = reportsById.get(row.report_id);

  if (!claim || !report) {
    return null;
  }

  return {
    handoverId: row.id,
    claimId: row.claim_id,
    reportId: row.report_id,
    itemName: report.item_name,
    category: report.category,
    claimant: profilesById.get(row.recipient_id) ?? null,
    recipient: profilesById.get(row.recipient_id) ?? null,
    custodyStatus: report.custody_status,
    approvedAt: claim.decided_at,
    handoverAt: row.handover_at,
    handoverLocation: row.handover_location,
    verifier: profilesById.get(row.verifier_id) ?? null,
    notes: row.notes,
  };
}

export async function getHandoverDashboardSummary() {
  const supabase = await createClient();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [pending, completedThisMonth] = await Promise.all([
    getPendingHandovers({ page: 1 }),
    supabase
      .from("handovers")
      .select("id", { count: "exact", head: true })
      .gte("handover_at", startOfMonth.toISOString()),
  ]);

  if (completedThisMonth.error) {
    safeServerLog("Completed handover monthly count failed.");
  }

  return {
    pendingHandoverCount: pending.totalCount,
    completedThisMonthCount: completedThisMonth.count ?? 0,
    queryFailed: pending.queryFailed || Boolean(completedThisMonth.error),
  };
}
