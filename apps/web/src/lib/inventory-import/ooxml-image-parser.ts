import path from "node:path";

import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";

import {
  INVENTORY_ITEM_IMAGE_COLUMN,
  INVENTORY_MAX_EXTRACTED_MEDIA_BYTES,
  INVENTORY_PICKUP_EVIDENCE_COLUMN,
} from "@/lib/inventory-import/constants";
import { validateInventoryImage } from "@/lib/inventory-import/image-validation";
import type { InventoryImageKind, ParsedInventoryImage } from "@/lib/inventory-import/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
});

type AnchorImage = {
  row: number;
  column: number;
  embedId: string;
};

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeZipPath(value: string) {
  const normalized = path.posix.normalize(value.replace(/\\/g, "/"));

  if (normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("Workbook relationship path traversal ditolak.");
  }

  return normalized.replace(/^\/+/, "");
}

function resolveRelative(baseFile: string, target: string) {
  if (/^[a-z]+:/i.test(target)) {
    throw new Error("External relationship workbook ditolak.");
  }

  const baseDir = path.posix.dirname(baseFile);
  return normalizeZipPath(path.posix.join(baseDir, target));
}

async function readXml(zip: JSZip, filePath: string) {
  const file = zip.file(filePath);
  if (!file) {
    throw new Error(`File OOXML tidak ditemukan: ${filePath}`);
  }

  return parser.parse(await file.async("text"));
}

async function findWorksheetPath(zip: JSZip, sheetName: string) {
  const workbook = await readXml(zip, "xl/workbook.xml");
  const workbookRels = await readXml(zip, "xl/_rels/workbook.xml.rels");
  const sheets = asArray(workbook.workbook?.sheets?.sheet);
  const targetSheet = sheets.find((sheet) => sheet.name === sheetName) ?? sheets[0];

  if (!targetSheet?.id) {
    throw new Error("Workbook tanpa sheet yang kompatibel.");
  }

  const rels = asArray(workbookRels.Relationships?.Relationship);
  const rel = rels.find((item) => item.Id === targetSheet.id);

  if (!rel?.Target) {
    throw new Error("Worksheet relationship tidak ditemukan.");
  }

  return {
    sheetName: targetSheet.name as string,
    worksheetPath: resolveRelative("xl/workbook.xml", rel.Target),
  };
}

async function findDrawingPath(zip: JSZip, worksheetPath: string) {
  const worksheet = await readXml(zip, worksheetPath);
  const drawingRelId = worksheet.worksheet?.drawing?.id;

  if (!drawingRelId) {
    return null;
  }

  const relsPath = path.posix.join(
    path.posix.dirname(worksheetPath),
    "_rels",
    `${path.posix.basename(worksheetPath)}.rels`,
  );
  const relsXml = await readXml(zip, relsPath);
  const rel = asArray(relsXml.Relationships?.Relationship).find((item) => item.Id === drawingRelId);

  if (!rel?.Target) {
    return null;
  }

  return resolveRelative(worksheetPath, rel.Target);
}

function extractAnchors(drawingXml: unknown): AnchorImage[] {
  const drawing = drawingXml as {
    wsDr?: {
      oneCellAnchor?: unknown;
      twoCellAnchor?: unknown;
    };
  };
  const anchors = [
    ...asArray(drawing.wsDr?.oneCellAnchor),
    ...asArray(drawing.wsDr?.twoCellAnchor),
  ] as Array<Record<string, unknown>>;

  return anchors.flatMap((anchor) => {
    const from = anchor.from as Record<string, unknown> | undefined;
    const pic = anchor.pic as { blipFill?: { blip?: { embed?: string } } } | undefined;
    const row = Number(from?.row);
    const column = Number(from?.col) + 1;
    const embedId = pic?.blipFill?.blip?.embed;

    if (!Number.isInteger(row) || !Number.isInteger(column) || !embedId) {
      return [];
    }

    return [{ row: row + 1, column, embedId }];
  });
}

function mediaKindForColumn(column: number): InventoryImageKind | null {
  if (column === INVENTORY_ITEM_IMAGE_COLUMN) return "item";
  if (column === INVENTORY_PICKUP_EVIDENCE_COLUMN) return "pickup_evidence";
  return null;
}

export async function extractInventoryImages(buffer: Buffer, sheetName: string) {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false });
  const { worksheetPath, sheetName: actualSheetName } = await findWorksheetPath(zip, sheetName);
  const drawingPath = await findDrawingPath(zip, worksheetPath);

  if (!drawingPath) {
    return { sheetName: actualSheetName, imagesByRow: new Map<number, ParsedInventoryImage[]>() };
  }

  const drawingXml = await readXml(zip, drawingPath);
  const drawingRelsPath = path.posix.join(
    path.posix.dirname(drawingPath),
    "_rels",
    `${path.posix.basename(drawingPath)}.rels`,
  );
  const drawingRels = await readXml(zip, drawingRelsPath);
  const rels = new Map(
    asArray(drawingRels.Relationships?.Relationship).map((rel) => [rel.Id, rel.Target]),
  );
  const imagesByRow = new Map<number, ParsedInventoryImage[]>();
  const mediaCache = new Map<string, { bytes: Uint8Array; contentType: ParsedInventoryImage["contentType"]; extension: ParsedInventoryImage["extension"]; sha256: string }>();
  let totalMediaBytes = 0;

  for (const anchor of extractAnchors(drawingXml)) {
    const kind = mediaKindForColumn(anchor.column);
    const target = rels.get(anchor.embedId);
    if (!kind || !target) continue;

    const mediaPath = resolveRelative(drawingPath, target);
    let media = mediaCache.get(mediaPath);

    if (!media) {
      const file = zip.file(mediaPath);
      if (!file) continue;

      const bytes = await file.async("uint8array");
      totalMediaBytes += bytes.byteLength;
      if (totalMediaBytes > INVENTORY_MAX_EXTRACTED_MEDIA_BYTES) {
        throw new Error("Total media workbook melebihi 30 MiB.");
      }

      const validation = validateInventoryImage(bytes);
      if (validation.status === "error") continue;

      media = {
        bytes,
        contentType: validation.contentType,
        extension: validation.extension,
        sha256: validation.sha256,
      };
      mediaCache.set(mediaPath, media);
    }

    const current = imagesByRow.get(anchor.row) ?? [];
    current.push({
      kind,
      sourceRowNumber: anchor.row,
      column: anchor.column,
      mediaPath,
      ...media,
    });
    imagesByRow.set(anchor.row, current);
  }

  return { sheetName: actualSheetName, imagesByRow };
}
