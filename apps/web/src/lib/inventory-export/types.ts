export type InventoryExportImage = {
  storagePath: string;
  bytes: Buffer;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export type InventoryExportReport = {
  id: string;
  item_name: string;
  category: string;
  campus: string | null;
  building: string | null;
  location_detail: string | null;
  event_at: string;
  report_status: string;
  custody_status: string;
  resolved_at: string | null;
  raw_status?: string | null;
  item_image?: InventoryExportImage | null;
  pickup_evidence?: InventoryExportImage | null;
  has_item_image?: boolean;
  has_pickup_evidence?: boolean;
};
