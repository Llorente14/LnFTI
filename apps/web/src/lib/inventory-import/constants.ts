export const INVENTORY_IMPORT_BUCKET = "inventory-imports";
export const INVENTORY_EXPORT_BUCKET = "inventory-exports";

export const INVENTORY_WORKBOOK_MAX_BYTES = 40 * 1024 * 1024;
export const INVENTORY_MAX_DATA_ROWS = 500;
export const INVENTORY_MAX_EXTRACTED_MEDIA_BYTES = 30 * 1024 * 1024;
export const INVENTORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const INVENTORY_SOURCE_SHEET = "Periode 2026";
export const INVENTORY_DEFAULT_CAMPUS = "Kampus 1";
export const INVENTORY_DEFAULT_BUILDING = "Gedung R";
export const INVENTORY_DEFAULT_LOCATION = "Area FTI (detail lokasi tidak tersedia)";

export const INVENTORY_HEADERS = [
  "Nama Barang",
  "Foto Barang",
  "Ditemukan Di-",
  "Tanggal Turun dari Fakultas",
  "Status Barang",
  "Tanggal Barang diambil",
  "Foto Bukti Pengambilan Barang",
] as const;

export const INVENTORY_ITEM_IMAGE_COLUMN = 3;
export const INVENTORY_PICKUP_EVIDENCE_COLUMN = 8;
