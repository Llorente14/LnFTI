import { INVENTORY_DEFAULT_BUILDING, INVENTORY_DEFAULT_CAMPUS } from "@/lib/inventory-import/constants";
import { mapInventoryCategory } from "@/lib/inventory-import/category-mapping";
import { normalizeInventoryDate } from "@/lib/inventory-import/date-normalizer";
import { normalizeInventoryLocation } from "@/lib/inventory-import/location-normalizer";
import { buildInventoryRowFingerprint } from "@/lib/inventory-import/row-fingerprint";
import { mapInventoryStatus } from "@/lib/inventory-import/status-mapping";
import type { InventoryCategory, InventoryValidationStatus } from "@/lib/inventory-import/types";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";

type NormalizeEditableRowInput = {
  itemName: string;
  category: string;
  locationDetail: string;
  eventDate: string;
  rawStatus: string;
  pickupDate: string;
  itemImageSha256: string | null;
};

function publicDescription(input: {
  itemName: string;
  locationDetail: string;
  eventAt: string | null;
  rawStatus: string;
}) {
  const dateText = input.eventAt
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(input.eventAt))
    : "tanggal tidak valid";

  return `Barang temuan "${input.itemName}" tercatat di ${input.locationDetail} pada ${dateText}. Status DPM asal: ${input.rawStatus}.`;
}

export function normalizeEditableInventoryRow(input: NormalizeEditableRowInput) {
  const itemName = input.itemName.trim().replace(/\s+/g, " ");
  const category = REPORT_CATEGORIES.includes(input.category as InventoryCategory)
    ? input.category as InventoryCategory
    : mapInventoryCategory(itemName);
  const location = normalizeInventoryLocation(input.locationDetail);
  const eventAt = normalizeInventoryDate(input.eventDate);
  const pickupDate = normalizeInventoryDate(input.pickupDate);
  const status = mapInventoryStatus(input.rawStatus);
  const messages = [...location.warnings];

  if (!REPORT_CATEGORIES.includes(input.category as InventoryCategory)) {
    messages.push("Kategori tidak valid; memakai hasil mapping otomatis.");
  }

  if (eventAt.status !== "ok") messages.push(`Tanggal turun: ${eventAt.message}`);
  if (status.status === "error") messages.push(status.message);
  if (status.status === "ok" && status.reportStatus === "RESOLVED" && pickupDate.status !== "ok") {
    messages.push("Tanggal pengambilan wajib valid untuk status DIAMBIL MAHASISWA.");
  }

  const normalizedEventAt = eventAt.status === "ok" ? eventAt.iso : null;
  const normalizedPickupDate = pickupDate.status === "ok" ? pickupDate.iso : null;
  const hasFatalError =
    eventAt.status !== "ok"
    || status.status === "error"
    || (status.status === "ok" && status.reportStatus === "RESOLVED" && pickupDate.status !== "ok");
  const validationStatus: InventoryValidationStatus = hasFatalError ? "ERROR" : messages.length > 0 ? "WARNING" : "VALID";
  const rowFingerprint = buildInventoryRowFingerprint({
    itemName,
    locationDetail: location.value,
    eventAt: normalizedEventAt,
    rawStatus: input.rawStatus,
    itemImageSha256: input.itemImageSha256,
  });

  return {
    itemName,
    category,
    campus: INVENTORY_DEFAULT_CAMPUS,
    building: INVENTORY_DEFAULT_BUILDING,
    locationDetail: location.value,
    eventAt: normalizedEventAt,
    rawStatus: input.rawStatus.trim().replace(/\s+/g, " "),
    reportStatus: status.status === "ok" ? status.reportStatus : null,
    custodyStatus: status.status === "ok" ? status.custodyStatus : null,
    pickupDate: normalizedPickupDate,
    publicDescription: publicDescription({
      itemName,
      locationDetail: location.value,
      eventAt: normalizedEventAt,
      rawStatus: input.rawStatus,
    }),
    rowFingerprint,
    validationStatus,
    validationMessages: messages,
  };
}
