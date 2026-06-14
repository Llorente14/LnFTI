import { REPORT_IMAGE_ALLOWED_MIME_TYPES } from "@/lib/reports/constants";

type ReportImageMimeType = (typeof REPORT_IMAGE_ALLOWED_MIME_TYPES)[number];

const MIME_TYPE_EXTENSIONS: Record<ReportImageMimeType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionFromMimeType(mimeType: string): "jpg" | "png" | "webp" {
  if (mimeType in MIME_TYPE_EXTENSIONS) {
    return MIME_TYPE_EXTENSIONS[mimeType as ReportImageMimeType];
  }

  throw new Error("Format gambar tidak didukung.");
}

export function buildReportImagePath({
  userId,
  reportId,
  mimeType,
  objectId = crypto.randomUUID(),
}: {
  userId: string;
  reportId: string;
  mimeType: string;
  objectId?: string;
}) {
  const extension = extensionFromMimeType(mimeType);

  return `${userId}/${reportId}/${objectId}.${extension}`;
}
