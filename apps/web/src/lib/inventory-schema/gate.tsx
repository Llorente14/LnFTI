import type { ReactNode } from "react";
import { getInventorySchemaStatus } from "@/lib/inventory-schema/server";

export async function InventorySchemaGate({ children }: { children: ReactNode }) {
  const schema = await getInventorySchemaStatus();
  return schema.ready ? children : <p>{schema.message}</p>;
}
