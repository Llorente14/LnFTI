import { requireRole } from "@/lib/auth/server";

export default async function Layout(props: Readonly<{ children: React.ReactNode }>) {
  await requireRole(["verifier", "admin"], "/admin");
  return props.children;
}
