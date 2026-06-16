"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createRefreshDebouncer } from "@/lib/realtime/debounce";
import { isSubscriptionRelevant } from "@/lib/realtime/event-relevance";
import type { RealtimeChannelConfig, RealtimePayload } from "@/lib/realtime/types";
import { createClient } from "@/lib/supabase/client";

type RealtimeRefreshBoundaryProps = {
  config: RealtimeChannelConfig;
  mode?: "auto" | "manual";
  debounceMs?: number;
  refreshMessage?: string;
  availableMessage?: string;
};

function statusLabel(status: string) {
  if (status === "SUBSCRIBED") {
    return "Pembaruan langsung aktif";
  }

  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    return "Pembaruan otomatis terputus";
  }

  return "";
}

function minimalRealtimeRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    report_id: row.report_id,
    claimant_id: row.claimant_id,
    recipient_id: row.recipient_id,
    claim_id: row.claim_id,
    report_status: row.report_status,
    claim_status: row.claim_status,
    custody_status: row.custody_status,
  };
}

export function RealtimeRefreshBoundary({
  config,
  mode = "auto",
  debounceMs = 400,
  refreshMessage = "Data diperbarui.",
  availableMessage = "Data baru tersedia.",
}: RealtimeRefreshBoundaryProps) {
  const router = useRouter();
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [hasPendingUpdate, setHasPendingUpdate] = useState(false);
  const configKey = useMemo(() => JSON.stringify(config), [config]);
  const visibleStatus = statusLabel(subscriptionStatus);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const channel = supabase.channel(config.channelName);
    const debouncer = createRefreshDebouncer(() => {
      if (!mounted) {
        return;
      }

      setAnnouncement(refreshMessage);

      if (mode === "manual") {
        setHasPendingUpdate(true);
        return;
      }

      router.refresh();
    }, debounceMs);

    for (const subscription of config.subscriptions) {
      channel.on(
        "postgres_changes",
        {
          event: subscription.event,
          schema: subscription.schema,
          table: subscription.table,
          filter: subscription.filter,
        },
        (payload) => {
          const minimalPayload: RealtimePayload = {
            eventType: payload.eventType,
            schema: payload.schema,
            table: payload.table ?? subscription.table,
            new: minimalRealtimeRow(payload.new),
          };

          if (isSubscriptionRelevant(subscription, minimalPayload)) {
            debouncer.schedule();
          }
        },
      );
    }

    channel.subscribe((status) => {
      if (mounted) {
        setSubscriptionStatus(status);
      }
    });

    return () => {
      mounted = false;
      debouncer.cancel();
      void supabase.removeChannel(channel);
    };
  }, [config.channelName, config.subscriptions, configKey, debounceMs, mode, refreshMessage, router]);

  return (
    <div className="mt-4 space-y-2" aria-live="polite">
      {visibleStatus ? (
        <p className="text-xs text-muted-foreground">{visibleStatus}</p>
      ) : null}
      {announcement ? (
        <p className="text-sm text-muted-foreground">{announcement}</p>
      ) : null}
      {hasPendingUpdate ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-surface p-3 text-sm">
          <span className="text-muted-foreground">{availableMessage}</span>
          <button
            type="button"
            onClick={() => {
              setHasPendingUpdate(false);
              router.refresh();
            }}
            className="inline-flex min-h-10 items-center rounded-md border px-4 font-semibold text-primary hover:bg-muted"
          >
            Muat ulang data
          </button>
        </div>
      ) : null}
    </div>
  );
}
