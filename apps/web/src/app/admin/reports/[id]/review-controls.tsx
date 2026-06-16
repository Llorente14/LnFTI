"use client";

import { IconCheck, IconRotateClockwise, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { CUSTODY_STATUSES, type CustodyStatus } from "@/lib/admin/report-review-validation";
import {
  type AdminActionState,
  reviewReportAction,
  updateCustodyStatusAction,
} from "./actions";

const initialAdminActionState: AdminActionState = {
  status: "idle",
  message: "",
};

const custodyLabels: Record<CustodyStatus, string> = {
  WITH_FINDER: "Di penemu",
  AT_DPM: "Di DPM",
  HANDED_OVER: "Sudah diserahkan",
  UNKNOWN: "Belum diketahui",
};

function StatusMessage({ status, message }: { status: "idle" | "success" | "error"; message: string }) {
  if (!message) {
    return null;
  }

  return (
    <p
      className={
        status === "success"
          ? "rounded-md border border-green-700/20 bg-green-50 p-3 text-sm text-green-800"
          : "rounded-md border border-primary/20 bg-[var(--crimson-pale-2)] p-3 text-sm text-primary"
      }
      aria-live="polite"
    >
      {message}
    </p>
  );
}

export function ReviewDecisionForm({
  reportId,
  disabled,
}: {
  reportId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(reviewReportAction, initialAdminActionState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border bg-surface p-5"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const decision = submitter?.value;
        const label = decision === "APPROVE" ? "menyetujui dan mempublikasikan" : "menolak";

        if (!window.confirm(`Konfirmasi ${label} laporan ini?`)) {
          event.preventDefault();
        }
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-bold">Keputusan review</h2>
        <p className="mt-1 text-sm text-muted-foreground">Alasan dicatat pada audit log untuk keputusan apa pun.</p>
      </div>
      <input type="hidden" name="reportId" value={reportId} />
      <div className="space-y-2">
        <label htmlFor="review-reason" className="font-heading text-sm font-semibold">Alasan</label>
        <textarea
          id="review-reason"
          name="reason"
          required
          minLength={5}
          maxLength={500}
          rows={4}
          disabled={disabled || pending}
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <StatusMessage status={state.status} message={state.message} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" name="decision" value="APPROVE" disabled={disabled || pending}>
          <IconCheck size={17} aria-hidden="true" />
          Setujui
        </Button>
        <Button type="submit" name="decision" value="REJECT" variant="secondary" disabled={disabled || pending}>
          <IconX size={17} aria-hidden="true" />
          Tolak
        </Button>
      </div>
    </form>
  );
}

export function CustodyStatusForm({
  reportId,
  currentStatus,
}: {
  reportId: string;
  currentStatus: CustodyStatus;
}) {
  const router = useRouter();
  const [selectedStatus, setSelectedStatus] = useState<CustodyStatus>(currentStatus);
  const [state, formAction, pending] = useActionState(updateCustodyStatusAction, initialAdminActionState);
  const unchanged = selectedStatus === currentStatus;
  const lockedByHandover = currentStatus === "HANDED_OVER";

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border bg-surface p-5"
      onSubmit={(event) => {
        if (unchanged) {
          event.preventDefault();
          return;
        }

        if (!window.confirm("Konfirmasi perubahan status penitipan?")) {
          event.preventDefault();
        }
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-bold">Status penitipan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Status HANDED_OVER hanya ditetapkan melalui penyelesaian serah-terima dari klaim yang telah disetujui.
        </p>
      </div>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="currentCustodyStatus" value={currentStatus} />
      <div className="space-y-2">
        <label htmlFor="newCustodyStatus" className="font-heading text-sm font-semibold">Status baru</label>
        <select
          id="newCustodyStatus"
          name="newCustodyStatus"
          value={lockedByHandover ? "UNKNOWN" : selectedStatus}
          onChange={(event) => setSelectedStatus(event.target.value as CustodyStatus)}
          disabled={pending || lockedByHandover}
          className="h-11 w-full rounded-md border bg-surface px-3 text-sm"
        >
          {CUSTODY_STATUSES.map((status) => (
            <option key={status} value={status}>{custodyLabels[status]}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label htmlFor="custody-reason" className="font-heading text-sm font-semibold">Alasan</label>
        <textarea
          id="custody-reason"
          name="reason"
          required
          minLength={5}
          maxLength={500}
          rows={3}
          disabled={pending || lockedByHandover}
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
        />
      </div>
      <StatusMessage status={state.status} message={state.message} />
      <Button type="submit" variant="gold" disabled={pending || unchanged || lockedByHandover}>
        <IconRotateClockwise size={17} aria-hidden="true" />
        Perbarui custody
      </Button>
    </form>
  );
}
