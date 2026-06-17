import { createHash } from "node:crypto";

export function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function buildInventoryRowFingerprint(input: {
  itemName: string;
  locationDetail: string;
  eventAt: string | null;
  rawStatus: string;
  itemImageSha256: string | null;
}) {
  return sha256Hex([
    input.itemName.trim().toLowerCase(),
    input.locationDetail.trim().toLowerCase(),
    input.eventAt ?? "",
    input.rawStatus.trim().toUpperCase(),
    input.itemImageSha256 ?? "",
  ].join("\u001f"));
}
