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

  return {
    ready: false,
    message: SCHEMA_UNAVAILABLE_MESSAGE,
  };
}
