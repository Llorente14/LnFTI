import { z } from "zod";

import {
  REPORT_CATEGORIES,
  REPORT_IMAGE_ALLOWED_MIME_TYPES,
  REPORT_IMAGE_MAX_BYTES,
  REPORT_IMAGE_MAX_COUNT,
  REPORT_TYPES,
} from "@/lib/reports/constants";

const trimmedString = z.string().trim();
const explicitTimezonePattern = /(?:Z|[+-]\d{2}:\d{2})$/;

const optionalTrimmedString = (maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `Maksimal ${maxLength} karakter.`)
    .optional()
    .transform((value) => (value ? value : null));

const eventAtSchema = trimmedString.refine((value) => {
  const date = new Date(value);

  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}, "Waktu kejadian wajib valid dan tidak boleh di masa depan.");

export const reportIdSchema = z.string().uuid("ID laporan tidak valid.");

export const reportFormSchema = z.object({
  reportType: z.enum(REPORT_TYPES, { message: "Pilih jenis laporan." }),
  itemName: trimmedString
    .min(3, "Nama barang minimal 3 karakter.")
    .max(100, "Nama barang maksimal 100 karakter."),
  category: z.enum(REPORT_CATEGORIES, { message: "Pilih kategori." }),
  publicDescription: trimmedString
    .min(20, "Deskripsi publik minimal 20 karakter.")
    .max(1000, "Deskripsi publik maksimal 1000 karakter."),
  privateCharacteristics: optionalTrimmedString(1000),
  campus: optionalTrimmedString(120),
  building: trimmedString.min(1, "Gedung wajib diisi.").max(120, "Gedung maksimal 120 karakter."),
  locationDetail: optionalTrimmedString(300),
  eventAt: eventAtSchema,
});

export const reportSubmissionSchema = reportFormSchema.extend({
  eventAt: trimmedString.refine((value) => {
    const date = new Date(value);

    return explicitTimezonePattern.test(value) && !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
  }, "Waktu kejadian wajib menyertakan zona waktu dan tidak boleh di masa depan."),
});

export type ReportFormValues = z.infer<typeof reportFormSchema>;

export const reportImageMetadataSchema = z.object({
  name: z.string().min(1),
  size: z
    .number()
    .int()
    .min(1, "File gambar kosong.")
    .max(REPORT_IMAGE_MAX_BYTES, "Ukuran gambar maksimal 5 MiB."),
  type: z.enum(REPORT_IMAGE_ALLOWED_MIME_TYPES, {
    message: "Format gambar harus JPEG, PNG, atau WebP.",
  }),
  altText: z.string().trim().max(160, "Alt text maksimal 160 karakter.").optional(),
});

export const reportImagesSchema = z
  .array(reportImageMetadataSchema)
  .max(REPORT_IMAGE_MAX_COUNT, "Maksimal tiga gambar per laporan.");

export const reportImageFinalizeSchema = z
  .array(
    z.object({
      storagePath: z.string().trim().min(1, "Path gambar wajib diisi."),
      altText: z.string().trim().max(160, "Alt text maksimal 160 karakter."),
      sortOrder: z.number().int().min(1).max(REPORT_IMAGE_MAX_COUNT),
    }),
  )
  .max(REPORT_IMAGE_MAX_COUNT, "Maksimal tiga gambar per laporan.");

export type ReportImageMetadata = z.infer<typeof reportImageMetadataSchema>;
export type ReportImageMetadataInput = {
  name: string;
  size: number;
  type: string;
  altText?: string;
};

export function validateReportImageMetadata(images: ReportImageMetadataInput[]) {
  return reportImagesSchema.parse(images);
}

export function formatDatetimeLocal(date: Date) {
  const offsetMs = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
