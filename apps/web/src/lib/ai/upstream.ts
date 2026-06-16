import "server-only";

import type { AiServiceEnv } from "@/lib/env";

const MIME_TO_FILENAME: Record<string, string> = {
  "image/jpeg": "image.jpg",
  "image/png": "image.png",
  "image/webp": "image.webp",
};

export type UpstreamResult =
  | { status: "success"; payload: unknown }
  | { status: "error"; warning: string; upstreamStatus?: number; timedOut?: boolean };

export async function callAiEndpoint(
  env: AiServiceEnv,
  path: "/api/v1/images/detect" | "/api/v1/images/ocr",
  bytes: ArrayBuffer,
  mimeType: string,
): Promise<UpstreamResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.aiRequestTimeoutMs);
  const formData = new FormData();
  formData.set("file", new File([bytes], MIME_TO_FILENAME[mimeType], { type: mimeType }));

  try {
    const response = await fetch(`${env.aiServiceUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: ["Bearer", env.aiInternalApiToken].join(" "),
        Accept: "application/json",
      },
      body: formData,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        status: "error",
        warning: response.status === 503 ? "AI_MODEL_UNAVAILABLE" : "AI_ANALYSIS_FAILED",
        upstreamStatus: response.status,
      };
    }

    return { status: "success", payload: await response.json() };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return {
      status: "error",
      warning: timedOut ? "AI_TIMEOUT" : "AI_ANALYSIS_FAILED",
      timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }
}
