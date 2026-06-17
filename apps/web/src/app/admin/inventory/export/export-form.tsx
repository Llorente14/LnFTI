"use client";

import { useActionState } from "react";

import { createInventoryExportAction } from "@/app/admin/inventory/export/actions";
import { Button } from "@/components/ui/button";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";

const initialState = { status: "idle" as const };
const reportStatuses = ["", "PUBLISHED", "RESOLVED", "CLOSED", "MATCHING", "REJECTED"];
const custodyStatuses = ["", "AT_DPM", "HANDED_OVER", "WITH_FINDER", "UNKNOWN"];

export function InventoryExportForm() {
  const [state, formAction, isPending] = useActionState(createInventoryExportAction, initialState);

  return (
    <form action={formAction} className="mt-6 rounded-lg border bg-surface p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm font-semibold">
          <span>Format</span>
          <select name="format" className="h-11 w-full rounded-md border bg-background px-3">
            <option value="XLSX">XLSX</option>
            <option value="CSV">CSV</option>
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Dari</span>
          <input name="from" type="date" className="h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Sampai</span>
          <input name="to" type="date" className="h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Report status</span>
          <select name="reportStatus" className="h-11 w-full rounded-md border bg-background px-3">
            {reportStatuses.map((status) => <option key={status} value={status}>{status || "Semua"}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Custody status</span>
          <select name="custodyStatus" className="h-11 w-full rounded-md border bg-background px-3">
            {custodyStatuses.map((status) => <option key={status} value={status}>{status || "Semua"}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Periode tahun</span>
          <input name="periodYear" type="number" min="2000" max="2100" className="h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Lokasi</span>
          <input name="location" type="search" className="h-11 w-full rounded-md border bg-background px-3" />
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Kategori</span>
          <select name="category" className="h-11 w-full rounded-md border bg-background px-3">
            <option value="">Semua</option>
            {REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 grid gap-4 rounded-md border bg-muted/40 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input name="includeSensitive" type="checkbox" className="size-4" />
          Sertakan bukti pengambilan
        </label>
        <label className="space-y-2 text-sm font-semibold">
          <span>Alasan ekspor sensitif</span>
          <input name="sensitiveReason" minLength={10} className="h-11 w-full rounded-md border bg-background px-3" />
        </label>
      </div>

      {state.status === "error" ? (
        <p className="mt-4 rounded-md border border-primary/30 bg-[var(--crimson-pale-2)] px-3 py-2 text-sm text-primary">
          {state.message}
        </p>
      ) : null}

      {state.status === "success" ? (
        <p className="mt-4 rounded-md border bg-muted px-3 py-2 text-sm">
          Export {state.format} siap: {state.rowCount} row.{" "}
          <a href={state.downloadUrl} className="font-semibold text-primary">
            Download file
          </a>
        </p>
      ) : null}

      <Button type="submit" disabled={isPending} className="mt-5">
        {isPending ? "Membuat..." : "Buat export"}
      </Button>
    </form>
  );
}
