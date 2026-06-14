import { PlaceholderPage } from "@/components/placeholder-page";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Buat Laporan" };

export default async function NewReportPage() {
  await requireUser("/report/new");

  return (
    <PlaceholderPage
      eyebrow="Authenticated route"
      title="Laporkan barang hilang atau temuan"
      description="Shell route telah siap. Form LOST/FOUND, upload foto, validasi, dan AI suggestion akan dikerjakan pada ticket workflow terkait."
    />
  );
}
