import { aiAnalysisResultSchema, type AiAnalysisResult } from "@/lib/ai/schemas";

const GENERIC_ANALYSIS_ERROR = "Analisis AI gagal. Data laporan Anda belum berubah.";

export async function analyzeReportImage(file: File, signal?: AbortSignal): Promise<AiAnalysisResult> {
  const formData = new FormData();
  formData.set("file", file);

  let response: Response;
  try {
    response = await fetch("/api/ai/analyze-image", {
      method: "POST",
      body: formData,
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new Error(GENERIC_ANALYSIS_ERROR);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : GENERIC_ANALYSIS_ERROR;
    throw new Error(message);
  }

  const parsed = aiAnalysisResultSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(GENERIC_ANALYSIS_ERROR);
  }

  return parsed.data;
}
