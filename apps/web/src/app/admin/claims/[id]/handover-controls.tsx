"use client";

import { IconPackageExport } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import {
  HANDOVER_LOCATION_MAX_LENGTH,
  HANDOVER_LOCATION_MIN_LENGTH,
  HANDOVER_NOTES_MAX_LENGTH,
} from "@/lib/admin/handover-validation";
import { completeHandoverAction, type HandoverActionState } from "./actions";

const initialState: HandoverActionState = {
  status: "idle",
  message: "",
};

export function HandoverControls({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(completeHandoverAction, initialState);

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
        const message = [
          "Konfirmasi serah-terima fisik?",
          "Barang sudah diperiksa secara fisik.",
          "Identitas penerima sesuai pengklaim yang disetujui.",
          "Aksi ini menyelesaikan klaim, menyelesaikan laporan, menandai custody HANDED_OVER, dan tidak dapat diulang.",
        ].join("\n\n");

        if (!window.confirm(message)) {
          event.preventDefault();
        }
      }}
    >
      <div>
        <h2 className="font-heading text-lg font-bold">Serah-terima fisik</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lengkapi setelah barang dan identitas penerima sudah diverifikasi.
        </p>
      </div>
      <input type="hidden" name="claimId" value={claimId} />
      <div className="space-y-2">
        <label htmlFor="handover-location" className="font-heading text-sm font-semibold">Lokasi serah-terima</label>
        <input
          id="handover-location"
          name="handoverLocation"
          required
          minLength={HANDOVER_LOCATION_MIN_LENGTH}
          maxLength={HANDOVER_LOCATION_MAX_LENGTH}
          placeholder="Pos DPM FTI"
          disabled={pending}
          className="h-11 w-full rounded-md border bg-surface px-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Contoh: Pos DPM FTI, Ruang Sekretariat, Lobby Gedung R.
        </p>
      </div>
      <div className="space-y-2">
        <label htmlFor="handover-notes" className="font-heading text-sm font-semibold">Catatan serah-terima (opsional)</label>
        <textarea
          id="handover-notes"
          name="notes"
          maxLength={HANDOVER_NOTES_MAX_LENGTH}
          rows={3}
          disabled={pending}
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Catatan ini akan terlihat oleh mahasiswa penerima pada riwayat klaim.
        </p>
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
      <Button type="submit" disabled={pending} size="lg">
        <IconPackageExport size={17} aria-hidden="true" />
        Selesaikan serah-terima
      </Button>
    </form>
  );
}
