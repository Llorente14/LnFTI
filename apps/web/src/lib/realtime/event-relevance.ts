import type { RealtimePayload, RealtimeRelevance, RealtimeSubscriptionConfig } from "@/lib/realtime/types";

const ADMIN_REPORT_STATUSES = new Set(["PENDING_REVIEW", "PUBLISHED", "REJECTED"]);
const ADMIN_CLAIM_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "CANCELLED", "COMPLETED"]);
const HANDOVER_CLAIM_STATUSES = new Set(["APPROVED", "COMPLETED"]);
const HANDOVER_REPORT_STATUSES = new Set(["MATCHING", "RESOLVED"]);
const CLAIMANT_STATUSES = ADMIN_CLAIM_STATUSES;

function readString(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];

  return typeof value === "string" ? value : "";
}

export function isRealtimeEventTypeAllowed(payload: RealtimePayload) {
  return payload.eventType === "INSERT" || payload.eventType === "UPDATE";
}

export function isRealtimePayloadRelevant(payload: RealtimePayload, relevance: RealtimeRelevance) {
  if (!isRealtimeEventTypeAllowed(payload)) {
    return false;
  }

  if (relevance === "always") {
    return true;
  }

  const next = payload.new;

  if (relevance === "admin-report-queue") {
    return ADMIN_REPORT_STATUSES.has(readString(next, "report_status"));
  }

  if (relevance === "admin-claim-queue") {
    return ADMIN_CLAIM_STATUSES.has(readString(next, "claim_status"));
  }

  if (relevance === "claimant-claims") {
    return CLAIMANT_STATUSES.has(readString(next, "claim_status"));
  }

  if (relevance === "admin-handover-queue") {
    if (payload.table === "claims") {
      return HANDOVER_CLAIM_STATUSES.has(readString(next, "claim_status"));
    }

    if (payload.table === "reports") {
      return HANDOVER_REPORT_STATUSES.has(readString(next, "report_status"));
    }

    return payload.table === "handovers" && payload.eventType === "INSERT";
  }

  return false;
}

export function isSubscriptionRelevant(subscription: RealtimeSubscriptionConfig, payload: RealtimePayload) {
  return payload.table === subscription.table
    && payload.eventType === subscription.event
    && isRealtimePayloadRelevant(payload, subscription.relevance);
}
