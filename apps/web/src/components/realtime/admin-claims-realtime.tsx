"use client";

import { RealtimeRefreshBoundary } from "@/components/realtime/realtime-refresh-boundary";
import {
  buildAdminClaimDetailRealtimeConfig,
  buildAdminClaimQueueRealtimeConfig,
} from "@/lib/realtime/constants";

export function AdminClaimsRealtime({
  claimId,
  reportId,
}: {
  claimId?: string;
  reportId?: string | null;
}) {
  const config = claimId
    ? buildAdminClaimDetailRealtimeConfig(claimId, reportId ?? null)
    : buildAdminClaimQueueRealtimeConfig();

  return (
    <RealtimeRefreshBoundary
      config={config}
      mode={claimId ? "manual" : "auto"}
      refreshMessage="Status klaim diperbarui."
    />
  );
}
