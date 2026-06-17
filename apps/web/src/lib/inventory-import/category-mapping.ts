import { REPORT_CATEGORIES } from "@/lib/reports/constants";
import type { InventoryCategory } from "@/lib/inventory-import/types";

const keywordMappings: Array<{ pattern: RegExp; category: InventoryCategory }> = [
  { pattern: /\b(mouse|charger|casan|adapter|kabel|headset|tws|usb|calculator)\b/i, category: "Elektronik" },
  { pattern: /\b(botol|tumbler|thumbler|wadah)\b/i, category: "Botol & Wadah" },
  { pattern: /\b(kartu|flazz|e-money|ktm)\b/i, category: "KTM & Kartu" },
  { pattern: /\b(binder|buku|dokumen)\b/i, category: "Dokumen" },
  { pattern: /\b(pouch|tas)\b/i, category: "Tas" },
  { pattern: /\b(kacamata|jepitan|bando|keychain)\b/i, category: "Aksesori" },
];

export function mapInventoryCategory(itemName: string): InventoryCategory {
  const normalized = itemName.trim().replace(/\s+/g, " ");

  for (const mapping of keywordMappings) {
    if (mapping.pattern.test(normalized)) {
      return mapping.category;
    }
  }

  return REPORT_CATEGORIES.includes(normalized as InventoryCategory)
    ? normalized as InventoryCategory
    : "Lainnya";
}
