export const REPORT_TYPES = ["LOST", "FOUND"] as const;

export const REPORT_CATEGORIES = [
  "KTM & Kartu",
  "Elektronik",
  "Tas",
  "Dompet",
  "Dokumen",
  "Botol & Wadah",
  "Aksesori",
  "Lainnya",
] as const;

export const REPORT_IMAGE_BUCKET = "report-images";
export const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const REPORT_IMAGE_MAX_COUNT = 3;
export const REPORT_IMAGE_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
