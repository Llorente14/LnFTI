import { INVENTORY_DEFAULT_LOCATION } from "@/lib/inventory-import/constants";

export type LocationNormalizationResult = {
  value: string;
  warnings: string[];
};

export function normalizeInventoryLocation(value: unknown): LocationNormalizationResult {
  const raw = String(value ?? "").trim();

  if (!raw || raw === "-") {
    return {
      value: INVENTORY_DEFAULT_LOCATION,
      warnings: ["Lokasi kosong; memakai fallback Area FTI."],
    };
  }

  if (/^\d+$/.test(raw)) {
    return { value: `R. ${raw}`, warnings: [] };
  }

  return { value: raw.replace(/\s+/g, " "), warnings: [] };
}
