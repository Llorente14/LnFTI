import { PlaceholderPage } from "@/components/placeholder-page";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Dashboard Verifier" };

export default async function AdminPage() {
  await requireUser("/admin");

  return (
    <PlaceholderPage
      eyebrow="Verifier workspace"
      title="Dashboard verifier"
      description="Review laporan, klaim, custody, serah-terima, audit log, dan ekspor akan ditempatkan di area ini."
    />
  );
}
