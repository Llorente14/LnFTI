import type { AiAnalysisResult } from "@/lib/ai/schemas";

const PRIVATE_CHARACTERISTICS_MAX_LENGTH = 1000;

export type AppendOcrResult =
  | { status: "success"; value: string }
  | { status: "duplicate"; value: string }
  | { status: "too_long"; value: string };

export function ocrPrivateBlock(fullText: string): string {
  const trimmedText = fullText.trim();
  return trimmedText ? `Teks terlihat pada foto:\n${trimmedText}` : "";
}

export function appendOcrToPrivateCharacteristics(
  currentValue: string | null,
  fullText: string,
): AppendOcrResult {
  const block = ocrPrivateBlock(fullText);
  const current = (currentValue ?? "").trim();

  if (!block) {
    return { status: "duplicate", value: current };
  }

  if (current.includes(block)) {
    return { status: "duplicate", value: current };
  }

  const nextValue = current ? `${current}\n\n${block}` : block;
  if (nextValue.length > PRIVATE_CHARACTERISTICS_MAX_LENGTH) {
    return { status: "too_long", value: current };
  }

  return { status: "success", value: nextValue };
}

export function topDetectedLabel(result: AiAnalysisResult): string | null {
  return result.detection?.detections[0]?.label ?? null;
}
