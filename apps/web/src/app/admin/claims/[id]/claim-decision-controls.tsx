"use client";

import { IconCheck, IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reviewClaimAction, type ClaimDecisionState } from "./actions";

const initialState: ClaimDecisionState = {
  status: "idle",
  message: "",
};

export function ClaimDecisionControls({
  claimId,
  disabled,
}: {
  claimId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(reviewClaimAction, initialState);

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
        const message = decision === "APPROVE"
          ? "Setujui klaim ini? Klaim lain untuk laporan ini akan ditolak, dan serah-terima fisik tetap wajib dilakukan."
          : "Tolak klaim ini? Hanya klaim ini yang ditolak, laporan tetap publik, dan klaim lain dapat ditinjau nanti.";

        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-bold">Keputusan klaim</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval memblok klaim lain untuk laporan ini. Handover fisik tetap ticket berikutnya.
        </p>
      </div>
      <input type="hidden" name="claimId" value={claimId} />
      <div className="space-y-2">
        <label htmlFor="claim-decision-reason" className="font-heading text-sm font-semibold">Alasan keputusan</label>
        <textarea
          id="claim-decision-reason"
          name="reason"
          required
          minLength={5}
          maxLength={500}
          rows={4}
          disabled={disabled || pending}
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
        />
      </div>
      {state.message ? (
        <p
          className={state.status === "success"
            ? "rounded-md border border-green-700/20 bg-green-50 p-3 text-sm text-green-800"
            : "rounded-md border border-primary/20 bg-[var(--crimson-pale-2)] p-3 text-sm text-primary"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
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
