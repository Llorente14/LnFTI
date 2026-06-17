import "server-only";

import { createClient } from "@/lib/supabase/server";

export type InventorySchemaStatus =
  | { ready: true }
  | { ready: false; message: string };

const SCHEMA_UNAVAILABLE_MESSAGE =
  "Schema inventaris belum diterapkan pada environment ini. Jalankan migration LNFTI-34 sebelum menggunakan import atau export.";

export async function getInventorySchemaStatus(): Promise<InventorySchemaStatus> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("inventory_import_jobs")
    .select("id", { head: true, count: "exact" })
    .limit(1);

  if (!error) return { ready: true };

  const schemaMissing =
    error.code === "PGRST205"
    || error.code === "42P01"
    || error.message.toLowerCase().includes("inventory_import_jobs");

  return {
    ready: false,
    message: schemaMissing
      ? SCHEMA_UNAVAILABLE_MESSAGE
      : "Status schema inventaris tidak dapat diverifikasi. Muat ulang halaman atau periksa koneksi database.",
  };
}
