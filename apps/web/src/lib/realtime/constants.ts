import type { RealtimeChannelConfig } from "@/lib/realtime/types";

const publicSchema = "public" as const;
const adminReportWorkflowFilter = "report_status=in.(PENDING_REVIEW,PUBLISHED,REJECTED)";
const handoverClaimFilter = "claim_status=in.(APPROVED,COMPLETED)";
const handoverReportFilter = "report_status=in.(MATCHING,RESOLVED)";

export function buildMyClaimsRealtimeConfig(userId: string): RealtimeChannelConfig {
  return {
    channelName: `my-claims-status-${userId}`,
    subscriptions: [
      {
        event: "UPDATE",
        schema: publicSchema,
        table: "claims",
        filter: `claimant_id=eq.${userId}`,
        relevance: "claimant-claims",
      },
      {
        event: "INSERT",
        schema: publicSchema,
        table: "handovers",
        filter: `recipient_id=eq.${userId}`,
        relevance: "always",
      },
    ],
  };
}

export function buildAdminReportQueueRealtimeConfig(): RealtimeChannelConfig {
  return {
    channelName: "admin-report-queue",
    subscriptions: [
      {
        event: "INSERT",
        schema: publicSchema,
        table: "reports",
        filter: adminReportWorkflowFilter,
        relevance: "admin-report-queue",
      },
      {
        event: "UPDATE",
        schema: publicSchema,
        table: "reports",
        filter: adminReportWorkflowFilter,
        relevance: "admin-report-queue",
      },
    ],
  };
}

export function buildAdminReportDetailRealtimeConfig(reportId: string): RealtimeChannelConfig {
  return {
    channelName: `admin-report-detail-${reportId}`,
    subscriptions: [
      { event: "UPDATE", schema: publicSchema, table: "reports", filter: `id=eq.${reportId}`, relevance: "always" },
    ],
  };
}

export function buildAdminClaimQueueRealtimeConfig(): RealtimeChannelConfig {
  return {
    channelName: "admin-claim-queue",
    subscriptions: [
      { event: "INSERT", schema: publicSchema, table: "claims", relevance: "admin-claim-queue" },
      { event: "UPDATE", schema: publicSchema, table: "claims", relevance: "admin-claim-queue" },
    ],
  };
}

export function buildAdminClaimDetailRealtimeConfig(claimId: string, reportId: string | null): RealtimeChannelConfig {
  const subscriptions: RealtimeChannelConfig["subscriptions"] = [
    { event: "UPDATE", schema: publicSchema, table: "claims", filter: `id=eq.${claimId}`, relevance: "always" },
    { event: "INSERT", schema: publicSchema, table: "handovers", filter: `claim_id=eq.${claimId}`, relevance: "always" },
  ];

  if (reportId) {
    subscriptions.push({
      event: "UPDATE",
      schema: publicSchema,
      table: "reports",
      filter: `id=eq.${reportId}`,
      relevance: "always",
    });
  }

  return {
    channelName: `admin-claim-detail-${claimId}`,
    subscriptions,
  };
}

export function buildAdminHandoverQueueRealtimeConfig(): RealtimeChannelConfig {
  return {
    channelName: "admin-handover-queue",
    subscriptions: [
      {
        event: "UPDATE",
        schema: publicSchema,
        table: "claims",
        filter: handoverClaimFilter,
        relevance: "admin-handover-queue",
      },
      {
        event: "UPDATE",
        schema: publicSchema,
        table: "reports",
        filter: handoverReportFilter,
        relevance: "admin-handover-queue",
      },
      { event: "INSERT", schema: publicSchema, table: "handovers", relevance: "admin-handover-queue" },
    ],
  };
}
