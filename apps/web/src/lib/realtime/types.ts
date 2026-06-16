export type RealtimeTable = "reports" | "claims" | "handovers";
export type RealtimeEvent = "INSERT" | "UPDATE";

export type RealtimeRelevance =
  | "always"
  | "admin-report-queue"
  | "admin-claim-queue"
  | "admin-handover-queue"
  | "claimant-claims";

export type RealtimeSubscriptionConfig = {
  event: RealtimeEvent;
  schema: "public";
  table: RealtimeTable;
  filter?: string;
  relevance: RealtimeRelevance;
};

export type RealtimeChannelConfig = {
  channelName: string;
  subscriptions: RealtimeSubscriptionConfig[];
};

export type RealtimePayload = {
  eventType: string;
  schema?: string;
  table?: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
};
