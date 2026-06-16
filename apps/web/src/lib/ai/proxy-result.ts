import "server-only";

import {
  normalizeOcrResponse,
  normalizeYoloResponse,
  type AiAnalysisResult,
} from "@/lib/ai/schemas";
import type { UpstreamResult } from "@/lib/ai/upstream";

export type NormalizedUpstream<T> = {
  value: T | null;
  warning: string | null;
  status?: number;
  timedOut?: boolean;
};

export function normalizeDetectionResult(
  result: UpstreamResult,
): NormalizedUpstream<NonNullable<AiAnalysisResult["detection"]>> {
  if (result.status === "error") {
    return {
      value: null,
      warning: result.warning,
      status: result.upstreamStatus,
      timedOut: result.timedOut,
    };
  }

  try {
    return { value: normalizeYoloResponse(result.payload), warning: null };
  } catch {
    return { value: null, warning: "AI_ANALYSIS_FAILED" };
  }
}

export function normalizeOcrResult(
  result: UpstreamResult,
): NormalizedUpstream<NonNullable<AiAnalysisResult["ocr"]>> {
  if (result.status === "error") {
    return {
      value: null,
      warning: result.warning,
      status: result.upstreamStatus,
      timedOut: result.timedOut,
    };
  }

  try {
    return { value: normalizeOcrResponse(result.payload), warning: null };
  } catch {
    return { value: null, warning: "AI_ANALYSIS_FAILED" };
  }
}

export function buildAiAnalysisResult(
  detection: NormalizedUpstream<NonNullable<AiAnalysisResult["detection"]>>,
  ocr: NormalizedUpstream<NonNullable<AiAnalysisResult["ocr"]>>,
): AiAnalysisResult | null {
  if (!detection.value && !ocr.value) {
    return null;
  }

  return {
    status: detection.value && ocr.value ? "complete" : "partial",
    detection: detection.value,
    ocr: ocr.value,
    warnings: Array.from(new Set(
      [detection.warning, ocr.warning].filter((warning): warning is string => Boolean(warning)),
    )),
  };
}
