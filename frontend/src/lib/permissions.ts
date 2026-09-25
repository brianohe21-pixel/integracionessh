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

export const PERMISSION_MODULES = [
  "bots",
  "campaigns",
  "contacts",
  "payments",
  "settings",
  "audit",
] as const;

export function permissionModule(permission: string): string {
  return permission.split(".")[0] ?? permission;
}

export function permissionAction(permission: string): string {
  return permission.split(".")[1] ?? permission;
}

const NAV_PERMISSION: Record<string, Permission> = {
  "/bots": "bots.read",
  "/campaigns": "campaigns.read",
  "/contacts": "contacts.read",
  "/settings": "settings.read",
  "/alerts": "settings.read",
};

export function permissionForNavHref(href: string): Permission | null {
  const path = href.split("?")[0] ?? href;
  if (NAV_PERMISSION[path]) return NAV_PERMISSION[path];
  if (path.startsWith("/bots/")) return "bots.read";
  if (path.startsWith("/campaigns/")) return "campaigns.read";
  if (path.startsWith("/apps/payments")) return "payments.read";
  return null;
}
