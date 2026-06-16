import { z } from "zod";

import { REPORT_CATEGORIES } from "@/lib/reports/constants";

export const MAX_BROWSER_DETECTIONS = 5;
export const MAX_BROWSER_OCR_LINES = 10;
export const MAX_BROWSER_OCR_TEXT_CHARS = 1000;

const finiteNonNegative = z.number().finite().nonnegative();
const confidence = z.number().finite().min(0).max(1);
const reportCategorySchema = z.enum(REPORT_CATEGORIES);

const upstreamDetectionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  confidence,
});

export const upstreamYoloResponseSchema = z.object({
  suggested_category: z.string().nullable(),
  detections: z.array(upstreamDetectionSchema).max(100),
  inference_ms: finiteNonNegative,
});

const upstreamOcrLineSchema = z.object({
  text: z.string().trim().min(1).max(300),
  confidence,
});

export const upstreamOcrResponseSchema = z.object({
  lines: z.array(upstreamOcrLineSchema).max(100),
  full_text: z.string().max(10_000),
  average_confidence: confidence.nullable(),
  inference_ms: finiteNonNegative,
  truncated: z.boolean().default(false),
});

export const aiAnalysisResultSchema = z.object({
  status: z.enum(["complete", "partial"]),
  detection: z
    .object({
      suggestedCategory: reportCategorySchema.nullable(),
      detections: z.array(
        z.object({
          label: z.string().min(1).max(80),
          confidence,
        }),
      ),
      inferenceMs: finiteNonNegative,
    })
    .nullable(),
  ocr: z
    .object({
      lines: z.array(
        z.object({
          text: z.string().min(1).max(300),
          confidence,
        }),
      ),
      fullText: z.string().max(MAX_BROWSER_OCR_TEXT_CHARS),
      averageConfidence: confidence.nullable(),
      inferenceMs: finiteNonNegative,
      truncated: z.boolean(),
    })
    .nullable(),
  warnings: z.array(z.string().min(1).max(80)).max(4),
});

export type AiAnalysisResult = z.infer<typeof aiAnalysisResultSchema>;

export function normalizeYoloResponse(payload: unknown): NonNullable<AiAnalysisResult["detection"]> {
  const parsed = upstreamYoloResponseSchema.parse(payload);
  const suggestedCategory = reportCategorySchema.safeParse(parsed.suggested_category);

  return {
    suggestedCategory: suggestedCategory.success ? suggestedCategory.data : null,
    detections: parsed.detections.slice(0, MAX_BROWSER_DETECTIONS).map((detection) => ({
      label: detection.label,
      confidence: detection.confidence,
    })),
    inferenceMs: parsed.inference_ms,
  };
}

export function normalizeOcrResponse(payload: unknown): NonNullable<AiAnalysisResult["ocr"]> {
  const parsed = upstreamOcrResponseSchema.parse(payload);
  let remainingChars = MAX_BROWSER_OCR_TEXT_CHARS;
  const lines: Array<{ text: string; confidence: number }> = [];

  for (const line of parsed.lines.slice(0, MAX_BROWSER_OCR_LINES)) {
    const separatorChars = lines.length > 0 ? 1 : 0;
    const availableChars = remainingChars - separatorChars;

    if (availableChars <= 0) {
      break;
    }

    const text = line.text.slice(0, availableChars);
    if (!text) {
      break;
    }

    lines.push({ text, confidence: line.confidence });
    remainingChars -= separatorChars + text.length;
  }

  const fullText = lines.map((line) => line.text).join("\n");
  const averageConfidence = lines.length > 0
    ? Math.round((lines.reduce((sum, line) => sum + line.confidence, 0) / lines.length) * 10_000) / 10_000
    : null;

  return {
    lines,
    fullText,
    averageConfidence,
    inferenceMs: parsed.inference_ms,
    truncated: parsed.truncated || parsed.lines.length > lines.length || parsed.full_text.length > fullText.length,
  };
}
