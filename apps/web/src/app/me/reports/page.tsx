import { PlaceholderPage } from "@/components/placeholder-page";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Laporan Saya" };

export default async function MyReportsPage() {
  await requireUser("/me/reports");

  return (
    <PlaceholderPage
      eyebrow="Student workspace"
      title="Laporan saya"
      description="Daftar laporan milik pengguna akan tersedia setelah autentikasi, schema, dan RLS selesai."
    />
  );
}
