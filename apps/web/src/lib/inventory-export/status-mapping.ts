export function mapReportToDpmStatus(input: {
  reportStatus: string;
  custodyStatus: string;
  rawStatus?: string | null;
}) {
  const rawStatus = input.rawStatus?.trim().toUpperCase() ?? "";

  if (input.reportStatus === "PUBLISHED" && input.custodyStatus === "AT_DPM") {
    return { status: "ok" as const, value: "SEKRE DPM" };
  }

  if (input.reportStatus === "RESOLVED" && input.custodyStatus === "HANDED_OVER") {
    return { status: "ok" as const, value: "DIAMBIL MAHASISWA" };
  }

  if (input.reportStatus === "CLOSED" && rawStatus === "PROKER") {
    return { status: "ok" as const, value: "PROKER" };
  }

  if (input.reportStatus === "CLOSED" && rawStatus === "SIAP DIDONASIKAN") {
    return { status: "ok" as const, value: "SIAP DIDONASIKAN" };
  }

  return { status: "warning" as const, value: "STATUS TIDAK TERPETAKAN" };
}
