import { NextResponse } from "next/server";

import { requireRole } from "@/lib/auth/server";
import { INVENTORY_EXPORT_BUCKET } from "@/lib/inventory-import/constants";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const { user, profile } = await requireRole(["verifier", "admin"], `/admin/inventory/export/${jobId}/download`);
  const supabase = await createClient();
  const { data: job, error } = await supabase
    .from("export_jobs")
    .select("id, requested_by, status, storage_path, expires_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !job || !job.storage_path) {
    return new NextResponse("Export tidak ditemukan.", { status: 404 });
  }

  if (profile.role !== "admin" && job.requested_by !== user.id) {
    return new NextResponse("Export tidak ditemukan.", { status: 404 });
  }

  if (job.status !== "COMPLETED") {
    return new NextResponse("Export belum siap.", { status: 409 });
  }

  if (job.expires_at && new Date(job.expires_at).getTime() <= Date.now()) {
    await supabase.from("export_jobs").update({ status: "EXPIRED" }).eq("id", job.id);
    await supabase.rpc("log_inventory_audit", {
      event_action: "INVENTORY_EXPORT_EXPIRED",
      event_entity_type: "export_job",
      event_entity_id: job.id,
      event_metadata: { storage_path: job.storage_path },
    });
    return new NextResponse("Export sudah kedaluwarsa.", { status: 410 });
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(INVENTORY_EXPORT_BUCKET)
    .createSignedUrl(job.storage_path, 60 * 5);

  if (signedError || !signed?.signedUrl) {
    return new NextResponse("File export tidak tersedia.", { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
