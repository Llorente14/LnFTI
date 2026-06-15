"use client";

import { IconSend } from "@tabler/icons-react";
import { useActionState, useMemo, useState } from "react";

import { submitOwnershipClaimAction, type ClaimSubmissionState } from "@/app/reports/[id]/claim-actions";
import { Button } from "@/components/ui/button";
import { CLAIM_EVIDENCE_MAX_LENGTH, CLAIM_EVIDENCE_MIN_LENGTH } from "@/lib/claims/validation";

const initialState: ClaimSubmissionState = {
  status: "idle",
  message: "",
};

export function ClaimForm({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState(submitOwnershipClaimAction, initialState);
  const [evidence, setEvidence] = useState("");
  const [confirming, setConfirming] = useState(false);
  const trimmedLength = useMemo(() => evidence.trim().length, [evidence]);
  const tooShort = trimmedLength > 0 && trimmedLength < CLAIM_EVIDENCE_MIN_LENGTH;
  const remaining = CLAIM_EVIDENCE_MAX_LENGTH - evidence.length;

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(event) => {
        if (!confirming) {
          event.preventDefault();
          setConfirming(true);
          return;
        }

        if (!window.confirm("Kirim klaim ini untuk ditinjau verifier?")) {
          event.preventDefault();
          setConfirming(false);
        }
      }}
    >
      <input type="hidden" name="reportId" value={reportId} />
      <div className="space-y-2">
        <label htmlFor="ownershipEvidence" className="font-heading text-sm font-semibold">
          Bukti kepemilikan privat
        </label>
        <textarea
          id="ownershipEvidence"
          name="ownershipEvidence"
          value={evidence}
          onChange={(event) => {
            setEvidence(event.target.value);
            setConfirming(false);
          }}
          required
          minLength={CLAIM_EVIDENCE_MIN_LENGTH}
          maxLength={CLAIM_EVIDENCE_MAX_LENGTH}
          rows={6}
          disabled={pending}
          aria-describedby="ownershipEvidenceHelp ownershipEvidenceCount"
          className="w-full rounded-md border bg-surface px-3 py-2 text-sm"
        />
        <p id="ownershipEvidenceHelp" className="text-xs text-muted-foreground">
          Tulis ciri yang tidak terlihat publik: goresan unik, isi barang, potongan nomor seri, detail warna, aksesori, casing, atau ciri khas lain. Jangan kirim password, PIN, nomor kartu lengkap, nomor dokumen identitas lengkap, atau kredensial akun.
        </p>
        <p id="ownershipEvidenceCount" className={tooShort || remaining < 0 ? "text-xs text-primary" : "text-xs text-muted-foreground"}>
          {trimmedLength} karakter privat. Sisa {remaining} karakter.
        </p>
      </div>

      {confirming ? (
        <div className="rounded-md border border-primary/25 bg-[var(--crimson-pale-2)] p-3 text-sm text-muted-foreground">
          Bukti ini privat dan hanya ditinjau verifier. Pengajuan klaim tidak menjamin persetujuan.
        </div>
      ) : null}

      {state.message ? (
        <p className="rounded-md border border-primary/20 bg-[var(--crimson-pale-2)] p-3 text-sm text-primary" aria-live="polite">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || trimmedLength < CLAIM_EVIDENCE_MIN_LENGTH || evidence.length > CLAIM_EVIDENCE_MAX_LENGTH}>
        <IconSend size={17} aria-hidden="true" />
        {confirming ? "Konfirmasi kirim klaim" : "Ajukan klaim"}
      </Button>
    </form>
  );
}
