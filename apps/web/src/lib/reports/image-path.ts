import { REPORT_IMAGE_ALLOWED_MIME_TYPES } from "@/lib/reports/constants";

type ReportImageMimeType = (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number];
type ReportImageExtension = "jpg" | "png" | "webp";

const MIME_TYPE_EXTENSIONS: Record<ReportImageMimeType, ReportImageExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_SOURCE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID_SOURCE}$`, "i");
const REPORT_IMAGE_PATH_PATTERN = new RegExp(
  `^(${UUID_SOURCE})/(${UUID_SOURCE})\\.(jpg|png|webp)$`,
  "i",
);

export type ParsedReportImagePath = {
  reportId: string;
  objectId: string;
  extension: ReportImageExtension;
};

export function extensionFromMimeType(mimeType: string): ReportImageExtension {
  if (mimeType in MIME_TYPE_EXTENSIONS) {
    return MIME_TYPE_EXTENSIONS[mimeType as ReportImageMimeType];
  }

  throw new Error("Format gambar tidak didukung.");
}

export function parseReportImagePath(path: string): ParsedReportImagePath | null {
  const match = REPORT_IMAGE_PATH_PATTERN.exec(path);

  if (!match) {
    return null;
  }

  return {
    reportId: match[1].toLowerCase(),
    objectId: match[2].toLowerCase(),
    extension: match[3].toLowerCase() as ReportImageExtension,
  };
}

export function buildReportImagePath({
  reportId,
  mimeType,
  objectId = crypto.randomUUID(),
}: {
  reportId: string;
  mimeType: string;
  objectId?: string;
}) {
  if (![reportId, objectId].every((value) => UUID_PATTERN.test(value))) {
    throw new Error("ID path gambar tidak valid.");
  }

  const extension = extensionFromMimeType(mimeType);

  return `${reportId.toLowerCase()}/${objectId.toLowerCase()}.${extension}`;
}
