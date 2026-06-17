import type { REPORT_CATEGORIES } from "@/lib/reports/constants";

export type InventoryReportStatus = "PUBLISHED" | "CLOSED" | "RESOLVED";
export type InventoryCustodyStatus = "AT_DPM" | "HANDED_OVER";
export type InventoryValidationStatus = "VALID" | "WARNING" | "ERROR";
export type InventoryImageKind = "item" | "pickup_evidence";
export type InventoryCategory = (typeof REPORT_CATEGORIES)[number];

export type ParsedInventoryImage = {
  kind: InventoryImageKind;
  sourceRowNumber: number;
  column: number;
  mediaPath: string;
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
  sha256: string;
};

export type ParsedInventoryRow = {
  sourceRowNumber: number;
  rawValues: Record<string, string>;
  itemName: string;
  category: InventoryCategory;
  campus: string;
  building: string;
  locationDetail: string;
  eventAt: string | null;
  rawStatus: string;
  reportStatus: InventoryReportStatus | null;
  custodyStatus: InventoryCustodyStatus | null;
  pickupDate: string | null;
  itemImage: ParsedInventoryImage | null;
  pickupEvidence: ParsedInventoryImage | null;
  itemImageSha256: string | null;
  pickupEvidenceSha256: string | null;
  rowFingerprint: string;
  validationStatus: InventoryValidationStatus;
  validationMessages: string[];
  publicDescription: string;
};

export type InventoryWorkbookParseResult = {
  workbookSha256: string;
  sourceSheet: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  rows: ParsedInventoryRow[];
};
