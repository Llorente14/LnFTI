import { createHash } from "node:crypto";

import { INVENTORY_IMAGE_MAX_BYTES } from "@/lib/inventory-import/constants";

export type InventoryImageValidation =
  | { status: "ok"; contentType: "image/jpeg" | "image/png" | "image/webp"; extension: "jpg" | "png" | "webp"; sha256: string }
  | { status: "error"; message: string };

export function validateInventoryImage(bytes: Uint8Array): InventoryImageValidation {
  if (bytes.byteLength === 0) {
    return { status: "error", message: "Gambar kosong." };
  }

  if (bytes.byteLength > INVENTORY_IMAGE_MAX_BYTES) {
    return { status: "error", message: "Ukuran gambar melebihi 5 MiB." };
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { status: "ok", contentType: "image/jpeg", extension: "jpg", sha256 };
  }

  if (
    bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return { status: "ok", contentType: "image/png", extension: "png", sha256 };
  }

  if (
    bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46
    && bytes[8] === 0x57
    && bytes[9] === 0x45
    && bytes[10] === 0x42
    && bytes[11] === 0x50
  ) {
    return { status: "ok", contentType: "image/webp", extension: "webp", sha256 };
  }

  return { status: "error", message: "Magic bytes gambar tidak didukung." };
}
