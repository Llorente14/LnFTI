"use client";

import { RealtimeRefreshBoundary } from "@/components/realtime/realtime-refresh-boundary";
import {
  buildAdminClaimQueueRealtimeConfig,
  buildAdminHandoverQueueRealtimeConfig,
  buildAdminReportQueueRealtimeConfig,
} from "@/lib/realtime/constants";
import type { RealtimeChannelConfig } from "@/lib/realtime/types";

const adminDashboardConfig: RealtimeChannelConfig = {
  channelName: "admin-dashboard-workflow",
  subscriptions: [
    ...buildAdminReportQueueRealtimeConfig().subscriptions,
    ...buildAdminClaimQueueRealtimeConfig().subscriptions,
    { event: "INSERT", schema: "public", table: "handovers", relevance: "always" },
  ],
};

export function AdminHandoversRealtime() {
  return (
    <RealtimeRefreshBoundary
      config={buildAdminHandoverQueueRealtimeConfig()}
      refreshMessage="Status serah-terima diperbarui."
    />
  );
}

export function AdminDashboardRealtime() {
  return (
    <RealtimeRefreshBoundary
      config={adminDashboardConfig}
      refreshMessage="Ringkasan workflow diperbarui."
    />
  );
}
