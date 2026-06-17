import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);

function transpile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function loadModule(path, customRequire = require) {
  const moduleRecord = { exports: {} };
  const evaluateModule = new Function("exports", "module", "require", transpile(path));
  evaluateModule(moduleRecord.exports, moduleRecord, customRequire);
  return moduleRecord.exports;
}

const constants = loadModule("src/lib/reports/constants.ts");
const importConstants = loadModule("src/lib/inventory-import/constants.ts");
const statusMapping = loadModule("src/lib/inventory-import/status-mapping.ts");
const categoryMapping = loadModule("src/lib/inventory-import/category-mapping.ts", (specifier) => {
  if (specifier === "@/lib/reports/constants") return constants;
  return require(specifier);
});
const locationNormalizer = loadModule("src/lib/inventory-import/location-normalizer.ts", (specifier) => {
  if (specifier === "@/lib/inventory-import/constants") return importConstants;
  return require(specifier);
});
const dateNormalizer = loadModule("src/lib/inventory-import/date-normalizer.ts");
const rowFingerprint = loadModule("src/lib/inventory-import/row-fingerprint.ts");
const rowNormalizer = loadModule("src/lib/inventory-import/row-normalizer.ts", (specifier) => {
  if (specifier === "@/lib/inventory-import/constants") return importConstants;
  if (specifier === "@/lib/inventory-import/category-mapping") return categoryMapping;
  if (specifier === "@/lib/inventory-import/date-normalizer") return dateNormalizer;
  if (specifier === "@/lib/inventory-import/location-normalizer") return locationNormalizer;
  if (specifier === "@/lib/inventory-import/row-fingerprint") return rowFingerprint;
  if (specifier === "@/lib/inventory-import/status-mapping") return statusMapping;
  if (specifier === "@/lib/reports/constants") return constants;
  return require(specifier);
});
const imageValidation = loadModule("src/lib/inventory-import/image-validation.ts", (specifier) => {
  if (specifier === "@/lib/inventory-import/constants") return importConstants;
  return require(specifier);
});
const cellSanitizer = loadModule("src/lib/inventory-export/cell-sanitizer.ts");
const exportStatus = loadModule("src/lib/inventory-export/status-mapping.ts");
const workbookBuilder = loadModule("src/lib/inventory-export/workbook-builder.ts", (specifier) => {
  if (specifier === "@/lib/inventory-export/cell-sanitizer") return cellSanitizer;
  if (specifier === "@/lib/inventory-export/status-mapping") return exportStatus;
  if (specifier === "exceljs") return { default: require("exceljs") };
  return require(specifier);
});

test("inventory status mapping is strict and deterministic", () => {
  assert.deepEqual(statusMapping.mapInventoryStatus("SEKRE DPM"), {
    status: "ok",
    normalizedStatus: "SEKRE DPM",
    reportStatus: "PUBLISHED",
    custodyStatus: "AT_DPM",
  });
  assert.equal(statusMapping.mapInventoryStatus("DIAMBIL MAHASISWA").reportStatus, "RESOLVED");
  assert.equal(statusMapping.mapInventoryStatus("misterius").status, "error");
});

test("inventory category mapping normalizes known keywords", () => {
  assert.equal(categoryMapping.mapInventoryCategory("Mouse Logitech"), "Elektronik");
  assert.equal(categoryMapping.mapInventoryCategory("thumbler biru"), "Botol & Wadah");
  assert.equal(categoryMapping.mapInventoryCategory("KTM Untar"), "KTM & Kartu");
  assert.equal(categoryMapping.mapInventoryCategory("barang random"), "Lainnya");
});

test("inventory location mapping keeps numeric rooms as strings", () => {
  assert.equal(locationNormalizer.normalizeInventoryLocation("805").value, "R. 805");
  assert.equal(locationNormalizer.normalizeInventoryLocation("-").value, "Area FTI (detail lokasi tidak tersedia)");
  assert.equal(locationNormalizer.normalizeInventoryLocation("  Lab   FTI  ").value, "Lab FTI");
});

test("inventory date parser accepts serial and rejects blank", () => {
  assert.equal(dateNormalizer.normalizeInventoryDate("").status, "blank");
  assert.equal(dateNormalizer.normalizeInventoryDate("not-date").status, "error");
  assert.match(dateNormalizer.normalizeInventoryDate(46000).iso, /^\d{4}-\d{2}-\d{2}T/);
});

test("row fingerprint changes when image hash changes", () => {
  const base = {
    itemName: "Mouse",
    locationDetail: "R. 805",
    eventAt: "2026-06-17T00:00:00.000Z",
    rawStatus: "SEKRE DPM",
    itemImageSha256: "a".repeat(64),
  };
  assert.notEqual(
    rowFingerprint.buildInventoryRowFingerprint(base),
    rowFingerprint.buildInventoryRowFingerprint({ ...base, itemImageSha256: "b".repeat(64) }),
  );
});

test("image magic bytes accept jpeg and reject unknown", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
  assert.equal(imageValidation.validateInventoryImage(jpeg).contentType, "image/jpeg");
  assert.equal(imageValidation.validateInventoryImage(Uint8Array.from([1, 2, 3])).status, "error");
});

test("export mapping and spreadsheet formula sanitizer", () => {
  assert.equal(exportStatus.mapReportToDpmStatus({ reportStatus: "PUBLISHED", custodyStatus: "AT_DPM" }).value, "SEKRE DPM");
  assert.equal(exportStatus.mapReportToDpmStatus({ reportStatus: "CLOSED", custodyStatus: "AT_DPM", rawStatus: "PROKER" }).value, "PROKER");
  assert.equal(exportStatus.mapReportToDpmStatus({ reportStatus: "CLOSED", custodyStatus: "UNKNOWN" }).value, "STATUS TIDAK TERPETAKAN");
  assert.equal(cellSanitizer.sanitizeSpreadsheetCell("=cmd"), "'=cmd");
});

test("resolved imported row without pickup date is a blocking error", () => {
  const result = rowNormalizer.normalizeEditableInventoryRow({
    itemName: "Mouse",
    category: "Elektronik",
    locationDetail: "805",
    eventDate: "2026-06-17",
    rawStatus: "DIAMBIL MAHASISWA",
    pickupDate: "",
    itemImageSha256: "a".repeat(64),
  });

  assert.equal(result.reportStatus, "RESOLVED");
  assert.equal(result.custodyStatus, "HANDED_OVER");
  assert.equal(result.validationStatus, "ERROR");
  assert.match(result.validationMessages.join("; "), /Tanggal pengambilan wajib valid/);
});

test("xlsx export embeds item and sensitive pickup images", async () => {
  const ExcelJS = require("exceljs");
  const JSZip = require("jszip");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  const report = {
    id: "00000000-0000-0000-0000-000000000001",
    item_name: "Mouse",
    category: "Elektronik",
    campus: "Kampus 1",
    building: "Gedung R",
    location_detail: "R. 805",
    event_at: "2026-06-17T00:00:00.000Z",
    report_status: "RESOLVED",
    custody_status: "HANDED_OVER",
    resolved_at: "2026-06-18T00:00:00.000Z",
    raw_status: "DIAMBIL MAHASISWA",
    item_image: { storagePath: "item.png", bytes: png, contentType: "image/png" },
    pickup_evidence: { storagePath: "pickup.png", bytes: png, contentType: "image/png" },
  };

  const buffer = await workbookBuilder.buildInventoryWorkbook([report], 2026);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet("Periode 2026");
  assert.ok(worksheet);
  assert.equal(worksheet.getCell("B13").value, "Nama Barang");
  assert.equal(worksheet.getCell("H13").value, "Foto Bukti Pengambilan Barang");
  assert.equal(worksheet.getCell("B14").value, "Mouse");
  assert.equal(worksheet.getCell("C14").value, null);
  assert.equal(worksheet.getCell("H14").value, null);
  assert.equal(worksheet.getCell("E14").value instanceof Date, true);

  const zip = await JSZip.loadAsync(buffer);
  const drawingPath = Object.keys(zip.files).find((path) => path.startsWith("xl/drawings/drawing") && path.endsWith(".xml"));
  assert.ok(drawingPath);
  const drawing = await zip.file(drawingPath).async("text");
  assert.equal((drawing.match(/<xdr:pic/g) ?? []).length, 2);
  assert.match(drawing, /editAs="oneCell"/);
});

test("xlsx export omits pickup evidence by default", async () => {
  const JSZip = require("jszip");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
  const buffer = await workbookBuilder.buildInventoryWorkbook([{
    id: "00000000-0000-0000-0000-000000000002",
    item_name: "Mouse",
    category: "Elektronik",
    campus: "Kampus 1",
    building: "Gedung R",
    location_detail: "R. 805",
    event_at: "2026-06-17T00:00:00.000Z",
    report_status: "PUBLISHED",
    custody_status: "AT_DPM",
    resolved_at: null,
    raw_status: "SEKRE DPM",
    item_image: { storagePath: "item.png", bytes: png, contentType: "image/png" },
    pickup_evidence: null,
  }], 2026);
  const zip = await JSZip.loadAsync(buffer);
  const drawingPath = Object.keys(zip.files).find((path) => path.startsWith("xl/drawings/drawing") && path.endsWith(".xml"));
  const drawing = await zip.file(drawingPath).async("text");
  assert.equal((drawing.match(/<xdr:pic/g) ?? []).length, 1);
});
