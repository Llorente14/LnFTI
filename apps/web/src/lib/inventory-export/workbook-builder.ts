import ExcelJS from "exceljs";

import { sanitizeSpreadsheetCell } from "@/lib/inventory-export/cell-sanitizer";
import { mapReportToDpmStatus } from "@/lib/inventory-export/status-mapping";
import type { InventoryExportReport } from "@/lib/inventory-export/types";

const columns = [
  { header: "Nama Barang", key: "itemName", width: 32 },
  { header: "Foto Barang", key: "itemImage", width: 18 },
  { header: "Ditemukan Di-", key: "location", width: 28 },
  { header: "Tanggal Turun dari Fakultas", key: "eventAt", width: 22 },
  { header: "Status Barang", key: "status", width: 22 },
  { header: "Tanggal Barang diambil", key: "pickupDate", width: 22 },
  { header: "Foto Bukti Pengambilan Barang", key: "pickupEvidence", width: 26 },
] as const;

function jakartaDate(value: string | null) {
  if (!value) return null;
  return new Date(value);
}

function imageExtension(contentType: NonNullable<InventoryExportReport["item_image"]>["contentType"]) {
  if (contentType === "image/jpeg") return "jpeg";
  if (contentType === "image/png") return "png";
  throw new Error("Export XLSX tidak mendukung WebP. Ubah foto ke JPEG/PNG atau gunakan CSV.");
}

function imageSize(bytes: Buffer) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }

  for (let index = 2; index < bytes.length - 9; index += 1) {
    if (bytes[index] !== 0xff) continue;
    const marker = bytes[index + 1];
    const isSizeMarker = marker >= 0xc0 && marker <= 0xc3;
    if (isSizeMarker) {
      return {
        height: bytes.readUInt16BE(index + 5),
        width: bytes.readUInt16BE(index + 7),
      };
    }
  }

  return { width: 120, height: 90 };
}

function fitImage(bytes: Buffer) {
  const size = imageSize(bytes);
  const maxWidth = 120;
  const maxHeight = 90;
  const ratio = Math.min(maxWidth / size.width, maxHeight / size.height, 1);

  return {
    width: Math.max(1, Math.round(size.width * ratio)),
    height: Math.max(1, Math.round(size.height * ratio)),
  };
}

function addCellImage(
  workbook: ExcelJS.Workbook,
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  columnIndex: number,
  image: NonNullable<InventoryExportReport["item_image"]>,
) {
  const dimensions = fitImage(image.bytes);
  const imageId = workbook.addImage({
    buffer: image.bytes as unknown as ExcelJS.Buffer,
    extension: imageExtension(image.contentType),
  });

  worksheet.addImage(imageId, {
    tl: { col: columnIndex, row: rowNumber - 1 },
    ext: dimensions,
    editAs: "oneCell",
  });
}

export async function buildInventoryWorkbook(reports: InventoryExportReport[], periodYear: number) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LnFTI";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(`Periode ${periodYear}`);

  worksheet.getCell("B4").value = "Status";
  worksheet.getCell("C4").value = "Arti";
  [
    ["SEKRE DPM", "Barang berada di DPM"],
    ["PROKER", "Ditutup untuk program kerja"],
    ["SIAP DIDONASIKAN", "Ditutup dan siap didonasikan"],
    ["DIAMBIL MAHASISWA", "Sudah diambil"],
  ].forEach(([status, description], index) => {
    worksheet.getCell(`B${5 + index}`).value = status;
    worksheet.getCell(`C${5 + index}`).value = description;
  });

  worksheet.getCell("B11").value = `Data Barang Lost & Found Fakultas Teknologi Informasi - ${periodYear}`;
  worksheet.getCell("B11").font = { bold: true, size: 14 };

  columns.forEach((column, index) => {
    const cell = worksheet.getCell(13, 2 + index);
    cell.value = column.header;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
    worksheet.getColumn(2 + index).width = column.width;
  });

  reports.forEach((report, index) => {
    const rowNumber = 14 + index;
    const mappedStatus = mapReportToDpmStatus({
      reportStatus: report.report_status,
      custodyStatus: report.custody_status,
      rawStatus: report.raw_status,
    });
    const location = report.location_detail || [report.campus, report.building].filter(Boolean).join(" / ");

    worksheet.getCell(rowNumber, 2).value = sanitizeSpreadsheetCell(report.item_name);
    worksheet.getCell(rowNumber, 4).value = sanitizeSpreadsheetCell(location);
    worksheet.getCell(rowNumber, 5).value = jakartaDate(report.event_at);
    worksheet.getCell(rowNumber, 5).numFmt = "dd/mm/yyyy";
    worksheet.getCell(rowNumber, 6).value = mappedStatus.value;
    worksheet.getCell(rowNumber, 7).value = jakartaDate(report.resolved_at);
    worksheet.getCell(rowNumber, 7).numFmt = "dd/mm/yyyy";
    worksheet.getRow(rowNumber).height = 75;

    if (report.item_image) {
      addCellImage(workbook, worksheet, rowNumber, 2, report.item_image);
    }

    if (report.pickup_evidence) {
      addCellImage(workbook, worksheet, rowNumber, 7, report.pickup_evidence);
    }
  });

  worksheet.autoFilter = {
    from: "B13",
    to: `H${Math.max(13, 13 + reports.length)}`,
  };
  worksheet.views = [{ state: "frozen", ySplit: 13 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildInventoryCsv(reports: InventoryExportReport[]) {
  const headers = [
    "report_id",
    "item_name",
    "location",
    "category",
    "event_date",
    "report_status",
    "custody_status",
    "dpm_status",
    "has_item_image",
    "has_pickup_evidence",
  ];
  const rows = reports.map((report) => {
    const dpmStatus = mapReportToDpmStatus({
      reportStatus: report.report_status,
      custodyStatus: report.custody_status,
      rawStatus: report.raw_status,
    }).value;

    return [
      report.id,
      report.item_name,
      report.location_detail ?? "",
      report.category,
      report.event_at,
      report.report_status,
      report.custody_status,
      dpmStatus,
      report.has_item_image || report.item_image ? "true" : "false",
      report.has_pickup_evidence || report.pickup_evidence ? "true" : "false",
    ].map((value) => csvEscape(sanitizeSpreadsheetCell(value))).join(",");
  });

  return `${headers.join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
