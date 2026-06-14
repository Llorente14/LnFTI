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
const validation = loadModule("src/lib/reports/validation.ts", (specifier) => {
  if (specifier === "@/lib/reports/constants") {
    return constants;
  }

  return require(specifier);
});
const imagePath = loadModule("src/lib/reports/image-path.ts", (specifier) => {
  if (specifier === "@/lib/reports/constants") {
    return constants;
  }

  return require(specifier);
});

const baseReport = {
  reportType: "LOST",
  itemName: "Dompet hitam",
  category: "Dompet",
  publicDescription: "Dompet hitam hilang di sekitar lobi gedung utama.",
  privateCharacteristics: "Ada inisial kecil di bagian dalam.",
  campus: "Kampus 1",
  building: "Gedung R",
  locationDetail: "Dekat lift lantai 3",
  eventAt: "2026-01-01T10:00",
};

const validImagePath =
  "53500000-0000-0000-0000-000000000001/2d2d0000-0000-0000-0000-000000000002/a8ad0000-0000-0000-0000-000000000003.webp";

test("valid LOST report passes validation", () => {
  const parsed = validation.reportFormSchema.parse(baseReport);

  assert.equal(parsed.reportType, "LOST");
  assert.equal(parsed.category, "Dompet");
});

test("valid FOUND report passes validation", () => {
  const parsed = validation.reportFormSchema.parse({
    ...baseReport,
    reportType: "FOUND",
    itemName: "Botol minum biru",
    category: "Botol & Wadah",
  });

  assert.equal(parsed.reportType, "FOUND");
  assert.equal(parsed.category, "Botol & Wadah");
});

test("public description below 20 characters fails", () => {
  assert.throws(
    () => validation.reportFormSchema.parse({ ...baseReport, publicDescription: "Terlalu pendek" }),
    /minimal 20/,
  );
});

test("future event time fails", () => {
  assert.throws(
    () => validation.reportFormSchema.parse({ ...baseReport, eventAt: "2999-01-01T10:00" }),
    /masa depan/,
  );
});

test("server submission requires an explicit timezone", () => {
  assert.throws(
    () => validation.reportSubmissionSchema.parse(baseReport),
    /zona waktu/,
  );

  const parsed = validation.reportSubmissionSchema.parse({
    ...baseReport,
    eventAt: "2026-01-01T03:00:00.000Z",
  });

  assert.equal(parsed.eventAt, "2026-01-01T03:00:00.000Z");
});

test("more than three images fails", () => {
  const image = { name: "photo.jpg", size: 1024, type: "image/jpeg", altText: "" };

  assert.throws(() => validation.validateReportImageMetadata([image, image, image, image]), /Maksimal tiga/);
});

test("unsupported MIME type fails", () => {
  assert.throws(
    () => validation.validateReportImageMetadata([{ name: "photo.gif", size: 1024, type: "image/gif" }]),
    /JPEG, PNG, atau WebP/,
  );
});

test("image above 5 MiB fails", () => {
  assert.throws(
    () =>
      validation.validateReportImageMetadata([
        { name: "large.jpg", size: constants.REPORT_IMAGE_MAX_BYTES + 1, type: "image/jpeg" },
      ]),
    /5 MiB/,
  );
});

test("generated object path uses user ID, report ID, and UUID-safe extension", () => {
  assert.equal(
    imagePath.buildReportImagePath({
      userId: "53500000-0000-0000-0000-000000000001",
      reportId: "2d2d0000-0000-0000-0000-000000000002",
      objectId: "a8ad0000-0000-0000-0000-000000000003",
      mimeType: "image/webp",
    }),
    validImagePath,
  );
});

test("image path parser rejects prefix tricks and malformed IDs", () => {
  assert.equal(imagePath.parseReportImagePath(validImagePath)?.reportId, "2d2d0000-0000-0000-0000-000000000002");
  assert.equal(imagePath.parseReportImagePath(`${validImagePath}/extra`), null);
  assert.equal(imagePath.parseReportImagePath("53500000-0000-0000-0000-000000000001/not-a-uuid/photo.webp"), null);
  assert.throws(() => validation.reportIdSchema.parse("not-a-uuid"), /ID laporan/);
});

test("finalization metadata enforces sort order shape and alt text length", () => {
  assert.doesNotThrow(() =>
    validation.reportImageFinalizeSchema.parse([
      { storagePath: validImagePath, altText: "Foto dompet", sortOrder: 1 },
    ]),
  );

  assert.throws(
    () =>
      validation.reportImageFinalizeSchema.parse([
        { storagePath: validImagePath, altText: "x".repeat(161), sortOrder: 1 },
      ]),
    /160/,
  );
});
