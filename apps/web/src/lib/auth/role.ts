export type ApplicationRole = "student" | "verifier" | "admin";

export function isAllowedRole(
  role: string | null | undefined,
  allowedRoles: readonly ApplicationRole[],
): role is ApplicationRole {
  return role !== null
    && role !== undefined
    && allowedRoles.includes(role as ApplicationRole);
}
