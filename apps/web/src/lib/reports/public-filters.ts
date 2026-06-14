import { REPORT_CATEGORIES, REPORT_TYPES } from "@/lib/reports/constants";

export const PUBLIC_REPORT_STATUSES = ["PUBLISHED", "MATCHING"] as const;
export const REPORTS_PAGE_SIZE = 12;
export const MAX_PUBLIC_REPORT_PAGE = 100;
export const MAX_SEARCH_LENGTH = 100;
export const PUBLIC_REPORT_TIME_ZONE = "Asia/Jakarta";

export type PublicReportType = (typeof REPORT_TYPES)[number];
export type PublicReportStatus = (typeof PUBLIC_REPORT_STATUSES)[number];

export type PublicReportFilters = {
  q: string;
  type: PublicReportType | "";
  category: string;
  campus: string;
  building: string;
  status: PublicReportStatus | "";
  dateFrom: string;
  dateTo: string;
  page: number;
  isValid: boolean;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const filterControlCharsPattern = /[%_,().:"'\\]/g;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function trimParam(value: string | string[] | undefined, maxLength = 120) {
  return (firstParam(value) ?? "").trim().slice(0, maxLength);
}

export function sanitizeSearchTerm(value: string | string[] | undefined) {
  return trimParam(value, MAX_SEARCH_LENGTH)
    .replace(filterControlCharsPattern, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(value: string | string[] | undefined) {
  const page = Number.parseInt(firstParam(value) ?? "1", 10);

  if (Number.isNaN(page) || page < 1) {
    return 1;
  }

  return Math.min(page, MAX_PUBLIC_REPORT_PAGE);
}

function isValidDateParam(value: string) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

export function toJakartaDayStartIso(value: string) {
  return new Date(`${value}T00:00:00.000+07:00`).toISOString();
}

export function toJakartaDayEndIso(value: string) {
  return new Date(`${value}T23:59:59.999+07:00`).toISOString();
}

export function parsePublicReportFilters(params: RawSearchParams = {}): PublicReportFilters {
  const type = trimParam(params.type).toUpperCase();
  const status = trimParam(params.status).toUpperCase();
  const category = trimParam(params.category);
  const dateFrom = trimParam(params.date_from, 10);
  const dateTo = trimParam(params.date_to, 10);
  let isValid = true;

  if (type && !REPORT_TYPES.includes(type as PublicReportType)) {
    isValid = false;
  }

  if (category && !REPORT_CATEGORIES.includes(category as (typeof REPORT_CATEGORIES)[number])) {
    isValid = false;
  }

  if (status && !PUBLIC_REPORT_STATUSES.includes(status as PublicReportStatus)) {
    isValid = false;
  }

  if (!isValidDateParam(dateFrom) || !isValidDateParam(dateTo)) {
    isValid = false;
  }

  if (dateFrom && dateTo && dateFrom > dateTo) {
    isValid = false;
  }

  return {
    q: sanitizeSearchTerm(params.q),
    type: isValid && type ? (type as PublicReportType) : "",
    category: isValid ? category : "",
    campus: sanitizeSearchTerm(params.campus),
    building: sanitizeSearchTerm(params.building),
    status: isValid && status ? (status as PublicReportStatus) : "",
    dateFrom: isValid ? dateFrom : "",
    dateTo: isValid ? dateTo : "",
    page: parsePage(params.page),
    isValid,
  };
}

export function buildReportsHref(
  filters: PublicReportFilters,
  overrides: Partial<PublicReportFilters> = {},
) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();

  if (next.q) params.set("q", next.q);
  if (next.type) params.set("type", next.type);
  if (next.category) params.set("category", next.category);
  if (next.campus) params.set("campus", next.campus);
  if (next.building) params.set("building", next.building);
  if (next.status) params.set("status", next.status);
  if (next.dateFrom) params.set("date_from", next.dateFrom);
  if (next.dateTo) params.set("date_to", next.dateTo);
  if (next.page > 1) params.set("page", String(next.page));

  const query = params.toString();

  return query ? `/reports?${query}` : "/reports";
}

export function isValidReportId(value: string) {
  return uuidPattern.test(value);
}
