import { PlaceholderPage } from "@/components/placeholder-page";

export const metadata = { title: "Laporan Saya" };

export default function MyReportsPage() {
  return (
    <PlaceholderPage
      eyebrow="Student workspace"
      title="Laporan saya"
      description="Daftar laporan milik pengguna akan tersedia setelah autentikasi, schema, dan RLS selesai."
    />
  );
}
