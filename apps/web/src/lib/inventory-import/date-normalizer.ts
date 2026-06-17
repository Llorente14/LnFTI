const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const DAY_MS = 24 * 60 * 60 * 1000;

export type DateNormalizationResult =
  | { status: "ok"; iso: string }
  | { status: "blank"; message: string }
  | { status: "error"; message: string };

export function normalizeInventoryDate(value: unknown): DateNormalizationResult {
  if (value instanceof Date) {
    return normalizeDate(value);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return normalizeDate(new Date(EXCEL_EPOCH_UTC + value * DAY_MS));
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return { status: "blank", message: "Tanggal kosong." };
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    return normalizeDate(new Date(EXCEL_EPOCH_UTC + numeric * DAY_MS));
  }

  return normalizeDate(new Date(text));
}

function normalizeDate(date: Date): DateNormalizationResult {
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) {
    return { status: "error", message: "Tanggal tidak valid." };
  }

  return { status: "ok", iso: date.toISOString() };
}
