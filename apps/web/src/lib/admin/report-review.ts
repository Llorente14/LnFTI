import "server-only";

import { REPORT_IMAGE_BUCKET } from "@/lib/reports/constants";
import { createClient } from "@/lib/supabase/server";

const REVIEW_PAGE_SIZE = 20;
const SIGNED_IMAGE_TTL_SECONDS = 12 * 60;

const REPORT_QUEUE_COLUMNS =
  "id, report_type, item_name, category, public_description, private_characteristics, campus, building, location_detail, event_at, report_status, custody_status, created_at, reporter_id, reporter:profiles!reports_reporter_id_fkey(display_name, nim, program_study_code)";
const REPORT_DETAIL_COLUMNS =
  "id, report_type, item_name, category, public_description, private_characteristics, campus, building, location_detail, event_at, report_status, custody_status, reviewed_by, reviewed_at, rejection_reason, published_at, created_at, reporter_id, reporter:profiles!reports_reporter_id_fkey(display_name, nim, program_study_code)";
const REPORT_IMAGE_COLUMNS = "report_id, storage_path, alt_text, sort_order";

export type AdminReportType = "LOST" | "FOUND";
export type AdminReportStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "MATCHING" | "RESOLVED" | "REJECTED" | "CLOSED";
export type AdminCustodyStatus = "WITH_FINDER" | "AT_DPM" | "HANDED_OVER" | "UNKNOWN";

export type ReporterProfile = {
  display_name: string | null;
  nim: string | null;
  program_study_code: string | null;
};

export type VerifierReport = {
  id: string;
  report_type: AdminReportType;
  item_name: string;
  category: string;
  public_description: string;
  private_characteristics: string | null;
  campus: string | null;
  building: string;
  location_detail: string | null;
  event_at: string;
  report_status: AdminReportStatus;
  custody_status: AdminCustodyStatus;
  created_at: string;
  reporter_id: string;
  reporter: ReporterProfile | null;
};

export type VerifierReportDetail = VerifierReport & {
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  published_at: string | null;
};

export type VerifierReportImage = {
  report_id: string;
  alt_text: string | null;
  sort_order: number;
  signedUrl: string | null;
};

export type PendingReviewFilters = {
  type?: AdminReportType | "";
  category?: string;
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

function normalizeReportRows(rows: unknown): VerifierReport[] {
  return (rows as Array<Omit<VerifierReport, "reporter"> & { reporter: ReporterProfile[] | ReporterProfile | null }>).map(
    (report) => ({
      ...report,
      reporter: Array.isArray(report.reporter) ? report.reporter[0] ?? null : report.reporter,
    }),
  );
}

function normalizeReportDetail(row: unknown): VerifierReportDetail | null {
  if (!row) {
    return null;
  }

  const [report] = normalizeReportRows([row]) as VerifierReportDetail[];

  return report;
}

async function countReportsByStatus(status: AdminReportStatus) {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("report_status", status);

  if (error) {
    safeServerLog("Verifier dashboard summary count failed.");
    return 0;
  }

  return count ?? 0;
}

export async function getPendingReviewReports(filters: PendingReviewFilters = {}) {
  const page = normalizePage(filters.page);
  const from = (page - 1) * REVIEW_PAGE_SIZE;
  const to = from + REVIEW_PAGE_SIZE - 1;
  const supabase = await createClient();
  let query = supabase
    .from("reports")
    .select(REPORT_QUEUE_COLUMNS, { count: "exact" })
    .eq("report_status", "PENDING_REVIEW")
    .order("created_at", { ascending: true })
    .range(from, to);

  if (filters.type) query = query.eq("report_type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);

  const { data, error, count } = await query;

  if (error || !data) {
    safeServerLog("Pending verifier queue query failed.");
    return { reports: [], totalCount: 0, page, pageCount: 0, queryFailed: true };
  }

  const totalCount = count ?? 0;

  return {
    reports: normalizeReportRows(data),
    totalCount,
    page,
    pageCount: Math.ceil(totalCount / REVIEW_PAGE_SIZE),
    queryFailed: false,
  };
}

export async function getVerifierReportDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(REPORT_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) safeServerLog("Verifier report detail query failed.");
    return null;
  }

  return normalizeReportDetail(data);
}

async function signVerifierImage(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_IMAGE_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    safeServerLog("Verifier report image signing failed.");
    return null;
  }

  return data.signedUrl;
}

export async function getVerifierReportImages(reportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_images")
    .select(REPORT_IMAGE_COLUMNS)
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true })
    .limit(3);

  if (error || !data) {
    safeServerLog("Verifier image metadata query failed.");
    return [];
  }

  return Promise.all(
    (data as Array<{
      report_id: string;
      storage_path: string;
      alt_text: string | null;
      sort_order: number;
    }>).map(async (image) => ({
      report_id: image.report_id,
      alt_text: image.alt_text,
      sort_order: image.sort_order,
      signedUrl: await signVerifierImage(image.storage_path),
    })),
  );
}

export async function getVerifierDashboardSummary() {
  const [pendingCount, publishedCount, rejectedCount, pending] = await Promise.all([
    countReportsByStatus("PENDING_REVIEW"),
    countReportsByStatus("PUBLISHED"),
    countReportsByStatus("REJECTED"),
    getPendingReviewReports({ page: 1 }),
  ]);

  return {
    pendingCount,
    publishedCount,
    rejectedCount,
    oldestPendingReports: pending.reports.slice(0, 5),
    queryFailed: pending.queryFailed,
  };
}
