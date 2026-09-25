import type { AuthContext, TenantMemberRole } from "../../types/index.js";
import { getMember } from "../dynamodb/member.repository.js";
import { getCustomRole } from "../dynamodb/role.repository.js";

export const PERMISSIONS = [
  "bots.read",
  "bots.write",
  "bots.delete",
  "campaigns.read",
  "campaigns.write",
  "campaigns.send",
  "contacts.read",
  "contacts.write",
  "contacts.delete",
  "payments.read",
  "payments.manage",
  "settings.read",
  "settings.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const PRESETS: Record<TenantMemberRole, readonly Permission[]> = {
  member: ALL_PERMISSIONS,
  supervisor: ALL_PERMISSIONS,
  advisor: [],
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function permissionsForRole(role: string): Permission[] {
  if (role === "member" || role === "supervisor") return [...PRESETS[role]];
  return [...PRESETS.advisor];
}

export function sanitizePermissions(values: string[]): Permission[] {
  const unique = new Set<Permission>();
  for (const value of values) {
    if (isPermission(value)) unique.add(value);
  }
  return [...unique];
}

function forbidden(message: string): Error {
  const error = new Error(message);
  (error as Error & { statusCode: number }).statusCode = 403;
  return error;
}

export async function resolveEffectivePermissions(auth: AuthContext): Promise<Permission[]> {
  if (auth.role === "admin" || !auth.tenantId) return [];

  const member = await getMember(auth.tenantId, auth.userId);
  if (member?.customRoleId) {
    const custom = await getCustomRole(auth.tenantId, member.customRoleId);
    if (custom) return sanitizePermissions(custom.permissions);
  }

  return permissionsForRole(auth.role);
}

export async function assertPermission(auth: AuthContext, permission: Permission): Promise<void> {
  if (auth.role === "admin") {
    throw forbidden("Platform admin cannot access tenant product APIs");
  }

  const permissions = await resolveEffectivePermissions(auth);
  if (!permissions.includes(permission)) {
    throw forbidden("Access denied");
  }
}

export async function assertSettingsAccess(auth: AuthContext, method: string): Promise<void> {
  const permission = method === "GET" || method === "HEAD" ? "settings.read" : "settings.manage";
  await assertPermission(auth, permission);
}
