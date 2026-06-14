import { PlaceholderPage } from "@/components/placeholder-page";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Klaim Saya" };

export default async function MyClaimsPage() {
  await requireUser("/me/claims");

  return (
    <PlaceholderPage
      eyebrow="Student workspace"
      title="Klaim saya"
      description="Riwayat dan status klaim akan diimplementasikan setelah claim workflow tersedia."
    />
  );
}
