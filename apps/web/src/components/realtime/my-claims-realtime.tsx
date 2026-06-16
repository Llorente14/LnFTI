"use client";

import { RealtimeRefreshBoundary } from "@/components/realtime/realtime-refresh-boundary";
import { buildMyClaimsRealtimeConfig } from "@/lib/realtime/constants";

export function MyClaimsRealtime({ userId }: { userId: string }) {
  return (
    <RealtimeRefreshBoundary
      config={buildMyClaimsRealtimeConfig(userId)}
      refreshMessage="Status klaim diperbarui."
    />
  );
}
