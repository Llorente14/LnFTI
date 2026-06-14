import "server-only";

import { REPORT_IMAGE_BUCKET } from "@/lib/reports/constants";
import {
  REPORTS_PAGE_SIZE,
  type PublicReportFilters,
  parsePublicReportFilters,
  type RawSearchParams,
  toJakartaDayEndIso,
  toJakartaDayStartIso,
} from "@/lib/reports/public-filters";
import { createClient } from "@/lib/supabase/server";

const PUBLIC_REPORT_COLUMNS =
  "id, report_type, item_name, category, public_description, campus, building, event_at, report_status, custody_status, published_at, created_at";
const PUBLIC_IMAGE_COLUMNS = "report_id, storage_path, alt_text, sort_order";
const SIGNED_IMAGE_TTL_SECONDS = 15 * 60;

export type PublicReport = {
  id: string;
  report_type: "LOST" | "FOUND";
  item_name: string;
  category: string;
  public_description: string;
  campus: string | null;
  building: string;
  event_at: string;
  report_status: "PUBLISHED" | "MATCHING";
  custody_status: string;
  published_at: string | null;
  created_at: string;
};

export type PublicReportImage = {
  report_id: string;
  alt_text: string | null;
  sort_order: number;
  signedUrl: string | null;
};

export type PublicReportCardData = PublicReport & {
  thumbnail: PublicReportImage | null;
};

export type PublicReportsResult = {
  reports: PublicReportCardData[];
  filters: PublicReportFilters;
  totalCount: number;
  pageCount: number;
  queryFailed: boolean;
};

function safeServerLog(message: string) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(message);
  }
}

function toIlikePattern(value: string) {
  return `%${value}%`;
}

async function signReportImage(storagePath: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(REPORT_IMAGE_BUCKET)
    .createSignedUrl(storagePath, SIGNED_IMAGE_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    safeServerLog("Public report image signing failed.");
    return null;
  }

  return data.signedUrl;
}

export async function getPublicReportImages(reportIds: string[], maxPerReport = 3) {
  const uniqueReportIds = Array.from(new Set(reportIds));

  if (uniqueReportIds.length === 0) {
    return new Map<string, PublicReportImage[]>();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_report_images")
    .select(PUBLIC_IMAGE_COLUMNS)
    .in("report_id", uniqueReportIds)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    safeServerLog("Public report image metadata query failed.");
    return new Map<string, PublicReportImage[]>();
  }

  const selected: Array<{
    report_id: string;
    storage_path: string;
    alt_text: string | null;
    sort_order: number;
  }> = [];
  const perReportCount = new Map<string, number>();

  for (const image of data as Array<{
    report_id: string;
    storage_path: string;
    alt_text: string | null;
    sort_order: number;
  }>) {
    const currentCount = perReportCount.get(image.report_id) ?? 0;

    if (currentCount >= maxPerReport) {
      continue;
    }

    selected.push(image);
    perReportCount.set(image.report_id, currentCount + 1);
  }

  const signedImages = await Promise.all(
    selected.map(async (image) => ({
      report_id: image.report_id,
      alt_text: image.alt_text,
      sort_order: image.sort_order,
      signedUrl: await signReportImage(image.storage_path),
    })),
  );
  const grouped = new Map<string, PublicReportImage[]>();

  for (const image of signedImages) {
    const list = grouped.get(image.report_id) ?? [];
    list.push(image);
    grouped.set(image.report_id, list);
  }

  return grouped;
}

function withThumbnails(reports: PublicReport[], imagesByReport: Map<string, PublicReportImage[]>) {
  return reports.map((report) => ({
    ...report,
    thumbnail: imagesByReport.get(report.id)?.[0] ?? null,
  }));
}

export async function getLatestPublicReports(limit = 6) {
  const supabase = await createClient();
  const safeLimit = Math.min(Math.max(limit, 1), 6);
  const { data, error } = await supabase
    .from("public_reports")
    .select(PUBLIC_REPORT_COLUMNS)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    safeServerLog("Latest public reports query failed.");
    return { reports: [], queryFailed: true };
  }

  const reports = data as PublicReport[];
  const imagesByReport = await getPublicReportImages(reports.map((report) => report.id), 1);

  return { reports: withThumbnails(reports, imagesByReport), queryFailed: false };
}

export async function getPublicReports(params: RawSearchParams = {}): Promise<PublicReportsResult> {
  const filters = parsePublicReportFilters(params);

  if (!filters.isValid) {
    return { reports: [], filters, totalCount: 0, pageCount: 0, queryFailed: false };
  }

  const supabase = await createClient();
  const from = (filters.page - 1) * REPORTS_PAGE_SIZE;
  const to = from + REPORTS_PAGE_SIZE - 1;
  let query = supabase
    .from("public_reports")
    .select(PUBLIC_REPORT_COLUMNS, { count: "exact" })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.type) query = query.eq("report_type", filters.type);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.status) query = query.eq("report_status", filters.status);
  if (filters.campus) query = query.ilike("campus", toIlikePattern(filters.campus));
  if (filters.building) query = query.ilike("building", toIlikePattern(filters.building));
  if (filters.dateFrom) query = query.gte("event_at", toJakartaDayStartIso(filters.dateFrom));
  if (filters.dateTo) query = query.lte("event_at", toJakartaDayEndIso(filters.dateTo));
  if (filters.q) {
    const pattern = toIlikePattern(filters.q);

    query = query.or(`item_name.ilike.${pattern},campus.ilike.${pattern},building.ilike.${pattern}`);
  }

  const { data, error, count } = await query;

  if (error || !data) {
    safeServerLog("Public reports query failed.");
    return { reports: [], filters, totalCount: 0, pageCount: 0, queryFailed: true };
  }

  const reports = data as PublicReport[];
  const imagesByReport = await getPublicReportImages(reports.map((report) => report.id), 1);
  const totalCount = count ?? 0;

  return {
    reports: withThumbnails(reports, imagesByReport),
    filters,
    totalCount,
    pageCount: Math.ceil(totalCount / REPORTS_PAGE_SIZE),
    queryFailed: false,
  };
}

export async function getPublicReportById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_reports")
    .select(PUBLIC_REPORT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    if (error) safeServerLog("Public report detail query failed.");
    return null;
  }

  const report = data as PublicReport;
  const imagesByReport = await getPublicReportImages([report.id], 3);

  return {
    ...report,
    images: imagesByReport.get(report.id) ?? [],
  };
}
