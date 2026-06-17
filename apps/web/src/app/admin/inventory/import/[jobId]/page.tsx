import Link from "next/link";
import { notFound } from "next/navigation";

import { commitInventoryRowsAction, updateInventoryImportRowAction } from "@/app/admin/inventory/import/actions";
import { Button } from "@/components/ui/button";
import { INVENTORY_IMPORT_BUCKET } from "@/lib/inventory-import/constants";
import { REPORT_CATEGORIES } from "@/lib/reports/constants";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Preview Import Inventaris" };

type PageProps = {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImportPreviewPage({ params, searchParams }: PageProps) {
  const { jobId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("inventory_import_jobs")
    .select("id, original_filename, total_rows, valid_rows, warning_rows, error_rows, imported_rows, status")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) notFound();

  const { data: rows } = await supabase
    .from("inventory_import_rows")
    .select("id, source_row_number, raw_values, item_name, category, location_detail, event_at, raw_status, report_status, custody_status, pickup_date, validation_status, validation_messages, report_id, item_image_storage_path, pickup_evidence_storage_path, item_image_sha256, row_fingerprint")
    .eq("import_job_id", jobId)
    .order("source_row_number", { ascending: true });

  const importableRows = (rows ?? []).filter((row) =>
    row.validation_status === "VALID" || row.validation_status === "WARNING",
  );
  const duplicateFingerprints = new Set(
    (rows ?? [])
      .map((row) => row.row_fingerprint)
      .filter((fingerprint, _index, all) => all.indexOf(fingerprint) !== all.lastIndexOf(fingerprint)),
  );
  const imageUrls = new Map<string, string>();

  for (const row of rows ?? []) {
    for (const path of [row.item_image_storage_path, row.pickup_evidence_storage_path]) {
      if (!path) continue;
      const { data: signed } = await supabase.storage.from(INVENTORY_IMPORT_BUCKET).createSignedUrl(path, 60 * 5);
      if (signed?.signedUrl) imageUrls.set(path, signed.signedUrl);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/admin/inventory/import" className="font-heading text-sm font-semibold text-primary hover:text-primary-strong">
        Kembali ke import
      </Link>
      <div className="mt-5 border-b pb-6">
        <p className="font-heading text-xs font-bold uppercase tracking-[0.18em] text-primary">Preview import</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">{job.original_filename}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {job.total_rows} row / {job.valid_rows} valid / {job.warning_rows} warning / {job.error_rows} error / {job.imported_rows} imported.
        </p>
      </div>

      {query.committed ? (
        <p className="mt-5 rounded-md border bg-muted px-3 py-2 text-sm">
          Commit import selesai diproses. {query.failed ? `${query.failed} row gagal diproses. ` : ""}Periksa status tiap row.
        </p>
      ) : null}

      {query.updated ? (
        <p className="mt-5 rounded-md border bg-muted px-3 py-2 text-sm">Perbaikan row tersimpan.</p>
      ) : null}

      <div className="mt-6 space-y-4">
        {(rows ?? []).map((row) => {
          const itemImageUrl = row.item_image_storage_path ? imageUrls.get(row.item_image_storage_path) : null;
          const pickupImageUrl = row.pickup_evidence_storage_path ? imageUrls.get(row.pickup_evidence_storage_path) : null;
          const locked = row.validation_status === "IMPORTED";

          return (
            <form key={row.id} action={updateInventoryImportRowAction} className="rounded-lg border bg-surface p-4">
              <input type="hidden" name="jobId" value={job.id} />
              <input type="hidden" name="rowId" value={row.id} />
              <input type="hidden" name="itemName" value={row.item_name} />
              <input type="hidden" name="itemImageSha256" value={row.item_image_sha256 ?? ""} />
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-heading text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Source row {row.source_row_number}</p>
                  <h2 className="mt-1 font-heading text-lg font-bold">{row.item_name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.report_status ?? "-"} / {row.custody_status ?? "-"} {duplicateFingerprints.has(row.row_fingerprint) ? " / duplicate di job ini" : ""}
                  </p>
                </div>
                <p className="rounded-md border px-3 py-1 text-xs font-semibold">{row.validation_status}{row.report_id ? ` -> ${row.report_id}` : ""}</p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[160px_160px_1fr]">
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Foto barang</p>
                  {itemImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itemImageUrl} alt="" className="h-28 w-full rounded-md border object-contain" />
                  ) : <div className="flex h-28 items-center justify-center rounded-md border text-xs text-muted-foreground">Tidak ada</div>}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Bukti pengambilan</p>
                  {pickupImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={pickupImageUrl} alt="" className="h-28 w-full rounded-md border object-contain" />
                  ) : <div className="flex h-28 items-center justify-center rounded-md border text-xs text-muted-foreground">Tidak ada</div>}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1 text-sm font-semibold">
                    <span>Kategori</span>
                    <select name="category" defaultValue={row.category} disabled={locked} className="h-10 w-full rounded-md border bg-background px-3">
                      {REPORT_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold">
                    <span>Lokasi</span>
                    <input name="locationDetail" defaultValue={row.location_detail} disabled={locked} className="h-10 w-full rounded-md border bg-background px-3" />
                  </label>
                  <label className="space-y-1 text-sm font-semibold">
                    <span>Tanggal ditemukan</span>
                    <input name="eventDate" type="date" defaultValue={row.event_at ? row.event_at.slice(0, 10) : ""} disabled={locked} className="h-10 w-full rounded-md border bg-background px-3" />
                  </label>
                  <label className="space-y-1 text-sm font-semibold">
                    <span>Status DPM</span>
                    <select name="rawStatus" defaultValue={row.raw_status} disabled={locked} className="h-10 w-full rounded-md border bg-background px-3">
                      {["SEKRE DPM", "PROKER", "SIAP DIDONASIKAN", "DIAMBIL MAHASISWA"].map((status) => <option key={status} value={status}>{status}</option>)}
                      <option value={row.raw_status}>{row.raw_status}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-semibold">
                    <span>Tanggal pengambilan</span>
                    <input name="pickupDate" type="date" defaultValue={row.pickup_date ? row.pickup_date.slice(0, 10) : ""} disabled={locked} className="h-10 w-full rounded-md border bg-background px-3" />
                  </label>
                </div>
              </div>

              {(row.validation_messages as string[] | null)?.length ? (
                <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{(row.validation_messages as string[]).join("; ")}</p>
              ) : null}
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-semibold">Raw source values</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3">{JSON.stringify(row.raw_values, null, 2)}</pre>
              </details>
              <Button type="submit" disabled={locked} variant="secondary" className="mt-4">Simpan perbaikan</Button>
            </form>
          );
        })}
      </div>

      <form action={commitInventoryRowsAction} className="mt-6">
        <input type="hidden" name="jobId" value={job.id} />
        <div className="overflow-x-auto rounded-lg border bg-surface">
          <table className="min-w-full divide-y text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="px-3 py-3">Pilih</th>
                <th className="px-3 py-3">Row</th>
                <th className="px-3 py-3">Barang</th>
                <th className="px-3 py-3">Kategori</th>
                <th className="px-3 py-3">Lokasi</th>
                <th className="px-3 py-3">Status DPM</th>
                <th className="px-3 py-3">Mapping</th>
                <th className="px-3 py-3">Validasi</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(rows ?? []).map((row) => {
                const canImport = importableRows.some((item) => item.id === row.id) && !row.report_id;
                return (
                  <tr key={row.id}>
                    <td className="px-3 py-3">
                      <input type="checkbox" name="rowId" value={row.id} disabled={!canImport} defaultChecked={canImport} />
                    </td>
                    <td className="px-3 py-3">{row.source_row_number}</td>
                    <td className="px-3 py-3 font-medium">{row.item_name}</td>
                    <td className="px-3 py-3">{row.category}</td>
                    <td className="px-3 py-3">{row.location_detail}</td>
                    <td className="px-3 py-3">{row.raw_status}</td>
                    <td className="px-3 py-3">{row.report_status ?? "-"} / {row.custody_status ?? "-"}</td>
                    <td className="px-3 py-3">
                      <p className="font-semibold">{row.validation_status}{row.report_id ? ` -> ${row.report_id}` : ""}</p>
                      {(row.validation_messages as string[] | null)?.length ? (
                        <p className="mt-1 text-xs text-muted-foreground">{(row.validation_messages as string[]).join("; ")}</p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button type="submit" className="mt-5">Commit row terpilih</Button>
        <Button type="submit" variant="secondary" className="ml-3 mt-5">Retry row gagal</Button>
      </form>
    </main>
  );
}
