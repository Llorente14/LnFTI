"use client";

import { IconX } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { cancelPendingClaimAction, type CancelClaimState } from "@/app/me/claims/actions";
import { Button } from "@/components/ui/button";

const initialState: CancelClaimState = {
  status: "idle",
  message: "",
};

export function CancelClaimButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(cancelPendingClaimAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form
      action={formAction}
      className="space-y-2"
      onSubmit={(event) => {
        if (!window.confirm("Batalkan klaim pending ini?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="claimId" value={claimId} />
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        <IconX size={16} aria-hidden="true" />
        Batalkan
      </Button>
      {state.message ? (
        <p
          className={state.status === "success" ? "text-xs text-green-800" : "text-xs text-primary"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
