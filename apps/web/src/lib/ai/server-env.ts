import "server-only";

import { validateAiServiceEnv } from "@/lib/env";

export function getAiServiceEnv() {
  return validateAiServiceEnv({
    aiServiceUrl: process.env.AI_SERVICE_URL,
    aiInternalApiToken: process.env.AI_INTERNAL_API_TOKEN,
    aiRequestTimeoutMs: process.env.AI_REQUEST_TIMEOUT_MS,
  });
}
