import { PlaceholderPage } from "@/components/placeholder-page";

interface ReportDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ReportDetailPage({ params }: ReportDetailPageProps) {
  const { id } = await params;

  return (
    <PlaceholderPage
      eyebrow={`Report ${id}`}
      title="Detail laporan"
      description="Gallery, informasi publik, custody status, dan alur klaim akan dihubungkan setelah model database tersedia."
    />
  );
}
