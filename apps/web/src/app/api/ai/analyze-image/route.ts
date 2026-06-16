import { NextResponse, type NextRequest } from "next/server";

import {
  buildAiAnalysisResult,
  normalizeDetectionResult,
  normalizeOcrResult,
} from "@/lib/ai/proxy-result";
import {
  AiProxyRequestError,
  readValidatedImage,
  requireVerifiedStudent,
} from "@/lib/ai/proxy-request";
import { getAiServiceEnv } from "@/lib/ai/server-env";
import { callAiEndpoint } from "@/lib/ai/upstream";

export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function jsonResponse(payload: object, status = 200) {
  return NextResponse.json(payload, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(status: number, code: string, message: string) {
  return jsonResponse({ code, message }, status);
}

export async function POST(request: NextRequest) {
  try {
    await requireVerifiedStudent();
  } catch (error) {
    if (error instanceof AiProxyRequestError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(503, "AUTH_CHECK_FAILED", "Permintaan belum dapat diproses.");
  }

  let image: Awaited<ReturnType<typeof readValidatedImage>>;
  try {
    image = await readValidatedImage(request);
  } catch (error) {
    if (error instanceof AiProxyRequestError) {
      return errorResponse(error.status, error.code, error.message);
    }
    return errorResponse(400, "INVALID_MULTIPART", "Permintaan gambar tidak valid.");
  }

  let env;
  try {
    env = getAiServiceEnv();
  } catch {
    return errorResponse(503, "AI_CONFIGURATION_MISSING", "Analisis AI belum dikonfigurasi.");
  }

  const settled = await Promise.allSettled([
    callAiEndpoint(env, "/api/v1/images/detect", image.bytes, image.mimeType),
    callAiEndpoint(env, "/api/v1/images/ocr", image.bytes, image.mimeType),
  ]);

  const detection = normalizeDetectionResult(
    settled[0].status === "fulfilled"
      ? settled[0].value
      : { status: "error", warning: "AI_ANALYSIS_FAILED" },
  );
  const ocr = normalizeOcrResult(
    settled[1].status === "fulfilled"
      ? settled[1].value
      : { status: "error", warning: "OCR_UNAVAILABLE" },
  );
  const result = buildAiAnalysisResult(detection, ocr);

  if (result) {
    return jsonResponse(result);
  }

  if (detection.status === 422 && ocr.status === 422) {
    return errorResponse(
      422,
      "INVALID_IMAGE",
      "Gambar tidak dapat dianalisis. Pilih gambar lain atau lanjutkan secara manual.",
    );
  }

  const timedOut = detection.timedOut || ocr.timedOut;
  return errorResponse(
    503,
    "AI_ANALYSIS_UNAVAILABLE",
    timedOut
      ? "Analisis membutuhkan waktu terlalu lama. Anda tetap dapat mengisi laporan secara manual."
      : "Analisis AI belum tersedia. Anda tetap dapat mengisi laporan secara manual.",
  );
}
