"use client";

import { RealtimeRefreshBoundary } from "@/components/realtime/realtime-refresh-boundary";
import {
  buildAdminReportDetailRealtimeConfig,
  buildAdminReportQueueRealtimeConfig,
} from "@/lib/realtime/constants";

export function AdminReportsRealtime({ reportId }: { reportId?: string }) {
  const config = reportId
    ? buildAdminReportDetailRealtimeConfig(reportId)
    : buildAdminReportQueueRealtimeConfig();

  return (
    <RealtimeRefreshBoundary
      config={config}
      mode={reportId ? "manual" : "auto"}
      refreshMessage="Status laporan diperbarui."
    />
  );
}
