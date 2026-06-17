"use server";

import {
  createInventoryExport,
  type InventoryExportState,
} from "@/lib/inventory-export/server";

export async function createInventoryExportAction(
  _previousState: InventoryExportState,
  formData: FormData,
): Promise<InventoryExportState> {
  return createInventoryExport(formData);
}
