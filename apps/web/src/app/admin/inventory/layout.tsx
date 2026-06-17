import type { ReactNode } from "react";
import { InventorySchemaGate } from "@/lib/inventory-schema/gate";

export default function Layout({ children }: { children: ReactNode }) {
  return <InventorySchemaGate>{children}</InventorySchemaGate>;
}
