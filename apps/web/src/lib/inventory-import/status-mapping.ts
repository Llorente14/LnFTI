import type { InventoryCustodyStatus, InventoryReportStatus } from "@/lib/inventory-import/types";

export type InventoryStatusMapping =
  | { status: "ok"; reportStatus: InventoryReportStatus; custodyStatus: InventoryCustodyStatus; normalizedStatus: string }
  | { status: "error"; message: string; normalizedStatus: string };

export function normalizeStatusText(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function mapInventoryStatus(value: unknown): InventoryStatusMapping {
  const normalizedStatus = normalizeStatusText(value);

  switch (normalizedStatus) {
    case "SEKRE DPM":
      return { status: "ok", normalizedStatus, reportStatus: "PUBLISHED", custodyStatus: "AT_DPM" };
    case "PROKER":
    case "SIAP DIDONASIKAN":
      return { status: "ok", normalizedStatus, reportStatus: "CLOSED", custodyStatus: "AT_DPM" };
    case "DIAMBIL MAHASISWA":
      return { status: "ok", normalizedStatus, reportStatus: "RESOLVED", custodyStatus: "HANDED_OVER" };
    default:
      return { status: "error", normalizedStatus, message: "Status barang tidak dikenal." };
  }
}
