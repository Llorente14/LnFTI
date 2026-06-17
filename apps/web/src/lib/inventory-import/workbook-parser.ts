import ExcelJS from "exceljs";

import {
  INVENTORY_DEFAULT_BUILDING,
  INVENTORY_DEFAULT_CAMPUS,
  INVENTORY_HEADERS,
  INVENTORY_MAX_DATA_ROWS,
  INVENTORY_SOURCE_SHEET,
} from "@/lib/inventory-import/constants";
import { mapInventoryCategory } from "@/lib/inventory-import/category-mapping";
import { normalizeInventoryDate } from "@/lib/inventory-import/date-normalizer";
import { normalizeInventoryLocation } from "@/lib/inventory-import/location-normalizer";
import { extractInventoryImages } from "@/lib/inventory-import/ooxml-image-parser";
import { buildInventoryRowFingerprint, sha256Hex } from "@/lib/inventory-import/row-fingerprint";
import { mapInventoryStatus } from "@/lib/inventory-import/status-mapping";
import type { InventoryWorkbookParseResult, ParsedInventoryImage, ParsedInventoryRow } from "@/lib/inventory-import/types";

function cellText(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "text" in value) return String(value.text ?? "").trim();
  if (value && typeof value === "object" && "result" in value) return String(value.result ?? "").trim();
  if (value && typeof value === "object" && "richText" in value) {
    return (value.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("").trim();
  }
  return String(value ?? "").trim();
}

function rawCellValue(cell: ExcelJS.Cell) {
  if (cell.value && typeof cell.value === "object" && "result" in cell.value) return cell.value.result;
  return cell.value;
}

function normalizeHeader(value: unknown) {
  return cellText(value).replace(/\s+/g, " ").toLowerCase();
}

function findHeaderRow(worksheet: ExcelJS.Worksheet) {
  const expected = INVENTORY_HEADERS.map(normalizeHeader);

  for (let rowNumber = 1; rowNumber <= Math.min(30, worksheet.rowCount); rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values = row.values as unknown[];
    const normalized = values.map(normalizeHeader);
    const firstIndex = normalized.findIndex((value) => value === expected[0]);
    if (firstIndex < 0) continue;

    const matches = expected.every((header, index) => normalized[firstIndex + index] === header);
    if (matches) {
      return { rowNumber, firstColumn: firstIndex };
    }
  }

  throw new Error("Header template inventaris tidak ditemukan.");
}

function firstImage(images: ParsedInventoryImage[], kind: ParsedInventoryImage["kind"]) {
  return images.find((image) => image.kind === kind) ?? null;
}

function buildPublicDescription(row: {
  itemName: string;
  locationDetail: string;
  eventAt: string | null;
  rawStatus: string;
}) {
  const dateText = row.eventAt
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(row.eventAt))
    : "tanggal tidak valid";

  return `Barang temuan "${row.itemName}" tercatat di ${row.locationDetail} pada ${dateText}. Status DPM asal: ${row.rawStatus}.`;
}

export async function parseInventoryWorkbook(buffer: Buffer): Promise<InventoryWorkbookParseResult> {
  const workbookSha256 = sha256Hex(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const { sheetName, imagesByRow } = await extractInventoryImages(buffer, INVENTORY_SOURCE_SHEET);
  const worksheet = workbook.getWorksheet(sheetName) ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Workbook tidak memiliki worksheet.");
  }

  const header = findHeaderRow(worksheet);
  const rows: ParsedInventoryRow[] = [];

  for (let rowNumber = header.rowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    if (rows.length >= INVENTORY_MAX_DATA_ROWS) {
      throw new Error("Jumlah data row melebihi batas 500.");
    }

    const row = worksheet.getRow(rowNumber);
    const itemName = cellText(row.getCell(header.firstColumn).value).replace(/\s+/g, " ").trim();

    if (!itemName) {
      continue;
    }

    const locationCell = row.getCell(header.firstColumn + 2);
    const eventCell = row.getCell(header.firstColumn + 3);
    const statusCell = row.getCell(header.firstColumn + 4);
    const pickupCell = row.getCell(header.firstColumn + 5);
    const rawStatus = cellText(statusCell.value);
    const status = mapInventoryStatus(rawStatus);
    const eventAt = normalizeInventoryDate(rawCellValue(eventCell));
    const pickupDate = normalizeInventoryDate(rawCellValue(pickupCell));
    const location = normalizeInventoryLocation(rawCellValue(locationCell));
    const images = imagesByRow.get(rowNumber) ?? [];
    const itemImage = firstImage(images, "item");
    const pickupEvidence = firstImage(images, "pickup_evidence");
    const messages = [...location.warnings];
    const rawValues = {
      "Nama Barang": itemName,
      "Ditemukan Di-": cellText(locationCell.value),
      "Tanggal Turun dari Fakultas": cellText(eventCell.value),
      "Status Barang": rawStatus,
      "Tanggal Barang diambil": cellText(pickupCell.value),
    };

    if (eventAt.status !== "ok") messages.push(`Tanggal turun: ${eventAt.message}`);
    if (status.status === "error") messages.push(status.message);
    if (status.status === "ok" && status.reportStatus === "RESOLVED" && pickupDate.status !== "ok") {
      messages.push("Tanggal pengambilan wajib valid untuk status DIAMBIL MAHASISWA.");
    }
    if (!itemImage) messages.push("Foto barang tidak ditemukan atau tidak valid.");
    if (images.filter((image) => image.kind === "item").length > 1) messages.push("Lebih dari satu foto barang pada row; memakai foto pertama.");
    if (images.filter((image) => image.kind === "pickup_evidence").length > 1) messages.push("Lebih dari satu bukti pengambilan pada row; memakai bukti pertama.");

    const category = mapInventoryCategory(itemName);
    const normalizedEventAt = eventAt.status === "ok" ? eventAt.iso : null;
    const normalizedPickupDate = pickupDate.status === "ok" ? pickupDate.iso : null;
    const validationStatus =
      eventAt.status !== "ok"
      || status.status === "error"
      || (status.status === "ok" && status.reportStatus === "RESOLVED" && pickupDate.status !== "ok")
        ? "ERROR"
        : messages.length > 0 ? "WARNING" : "VALID";
    const rowFingerprint = buildInventoryRowFingerprint({
      itemName,
      locationDetail: location.value,
      eventAt: normalizedEventAt,
      rawStatus,
      itemImageSha256: itemImage?.sha256 ?? null,
    });

    rows.push({
      sourceRowNumber: rowNumber,
      rawValues,
      itemName,
      category,
      campus: INVENTORY_DEFAULT_CAMPUS,
      building: INVENTORY_DEFAULT_BUILDING,
      locationDetail: location.value,
      eventAt: normalizedEventAt,
      rawStatus,
      reportStatus: status.status === "ok" ? status.reportStatus : null,
      custodyStatus: status.status === "ok" ? status.custodyStatus : null,
      pickupDate: normalizedPickupDate,
      itemImage,
      pickupEvidence,
      itemImageSha256: itemImage?.sha256 ?? null,
      pickupEvidenceSha256: pickupEvidence?.sha256 ?? null,
      rowFingerprint,
      validationStatus,
      validationMessages: messages,
      publicDescription: buildPublicDescription({
        itemName,
        locationDetail: location.value,
        eventAt: normalizedEventAt,
        rawStatus,
      }),
    });
  }

  return {
    workbookSha256,
    sourceSheet: worksheet.name,
    totalRows: rows.length,
    validRows: rows.filter((row) => row.validationStatus === "VALID").length,
    warningRows: rows.filter((row) => row.validationStatus === "WARNING").length,
    errorRows: rows.filter((row) => row.validationStatus === "ERROR").length,
    rows,
  };
}
