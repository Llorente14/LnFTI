"use client";

import Link from "next/link";
import { useActionState } from "react";

import { previewInventoryImportAction } from "@/app/admin/inventory/import/actions";
import { Button } from "@/components/ui/button";

const initialState = { status: "idle" as const };

export function InventoryImportForm() {
  const [state, formAction, isPending] = useActionState(previewInventoryImportAction, initialState);

  return (
    <form action={formAction} className="mt-6 rounded-lg border bg-surface p-5">
      <label htmlFor="workbook" className="font-heading text-sm font-semibold">
        Workbook .xlsx
      </label>
      <input
        id="workbook"
        name="workbook"
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        required
        className="mt-2 block w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Maksimal 40 MB. Workbook production tidak disimpan di repository.
      </p>

      {state.status === "error" ? (
        <p className="mt-4 rounded-md border border-primary/30 bg-[var(--crimson-pale-2)] px-3 py-2 text-sm text-primary">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p className="mt-4 rounded-md border bg-muted px-3 py-2 text-sm">
          Preview siap: {state.totalRows} row.{" "}
          <Link href={`/admin/inventory/import/${state.jobId}`} className="font-semibold text-primary">
            Buka preview
          </Link>
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="mt-5">
        {isPending ? "Memproses..." : "Buat preview"}
      </Button>
    </form>
  );
}
