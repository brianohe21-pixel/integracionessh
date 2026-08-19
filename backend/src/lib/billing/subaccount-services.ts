import {
  SUBACCOUNT_SERVICES,
  type ResellerLimitsOverride,
  type SubaccountServiceId,
  type Tenant,
} from "../../types/index.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import type { PlanLimits } from "./plan-limits.js";

export { SUBACCOUNT_SERVICES, type SubaccountServiceId };

export type BagLimitKey = Exclude<keyof ResellerLimitsOverride, "canCustomizeBranding">;

export const SERVICE_LIMIT_KEYS: Record<SubaccountServiceId, readonly BagLimitKey[]> = {
  bots: [
    "maxActiveBots",
    "maxChannelsPerBot",
    "maxDocumentsPerBot",
    "maxKnowledgeStorageMb",
    "maxMetaFlowsPerBot",
    "maxActiveWebChatSessions",
  ],
  voiceAgents: ["maxVoicebotMinutesPerMonth", "maxConcurrentLiveKitCalls"],
  contactCenter: [],
  conversations: [],
  supervisor: [],
  contacts: ["maxContacts"],
  leads: [],
  advisors: [],
  automations: ["maxAutomationsPerBot", "maxScheduledAutomations"],
  flows: ["maxVisualFlowsPerBot", "maxFlowNodes", "maxActiveFlowRuns"],
  templates: [],
  bulkSend: ["maxBulkRecipientsPerJob"],
  campaigns: ["maxActiveCampaigns", "maxMessagesPerMonth"],
  emailMarketing: [],
  metrics: [],
  apps: [
    "maxCalendarAppsPerTenant",
    "maxPaymentsAppsPerTenant",
    "maxCatalogAppsPerTenant",
    "maxProductsPerBot",
    "maxOrdersPerMonth",
  ],
  developer: ["apiRateLimitPerMinute", "apiRateLimitPerDay"],
};

export const BAG_LIMIT_KEYS = Array.from(
  new Set(SUBACCOUNT_SERVICES.flatMap((service) => [...SERVICE_LIMIT_KEYS[service]]))
) as BagLimitKey[];

const SERVICE_SET = new Set<string>(SUBACCOUNT_SERVICES);
const BAG_KEY_SET = new Set<string>(BAG_LIMIT_KEYS);

export class ServiceNotAssignedError extends Error {
  statusCode = 403;
  code = "SERVICE_NOT_ASSIGNED";

  constructor(message = "Service is not assigned to this subaccount") {
    super(message);
  }
}

export class BagLimitExceededError extends Error {
  statusCode = 400;
  code = "BAG_LIMIT_EXCEEDED";

  constructor(message = "Allocated limits exceed the reseller bag") {
    super(message);
  }
}

function isUnlimited(value: number): boolean {
  return value >= Number.MAX_SAFE_INTEGER / 2;
}

function isSubaccount(tenant: Tenant): boolean {
  return tenant.tenantKind === "subaccount" || Boolean(tenant.parentTenantId);
}

export function normalizeEnabledServices(
  ids: readonly string[] | undefined
): SubaccountServiceId[] {
  if (!ids) return [...SUBACCOUNT_SERVICES];
  const unique = new Set<SubaccountServiceId>();
  for (const id of ids) {
    if (SERVICE_SET.has(id)) unique.add(id as SubaccountServiceId);
  }
  return SUBACCOUNT_SERVICES.filter((id) => unique.has(id));
}

export function normalizeServiceLimits(
  input: ResellerLimitsOverride | Record<string, unknown> | undefined
): ResellerLimitsOverride {
  if (!input) return {};
  const out: ResellerLimitsOverride = {};
  for (const key of BAG_LIMIT_KEYS) {
    const value = input[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = Math.max(0, Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER));
  }
  return out;
}

export function trimServiceLimitsForEnabled(
  enabled: readonly SubaccountServiceId[],
  limits: ResellerLimitsOverride
): ResellerLimitsOverride {
  const allowed = new Set(enabled.flatMap((id) => SERVICE_LIMIT_KEYS[id]));
  const out: ResellerLimitsOverride = {};
  for (const key of BAG_LIMIT_KEYS) {
    if (!allowed.has(key)) continue;
    const value = limits[key];
    if (typeof value === "number") out[key] = value;
  }
  return out;
}

export function isSubaccountServiceEnabled(
  tenant: Tenant,
  service: SubaccountServiceId
): boolean {
  if (!isSubaccount(tenant)) return true;
  if (!tenant.enabledServices) return true;
  return tenant.enabledServices.includes(service);
}

export function assertSubaccountService(
  tenant: Tenant,
  service: SubaccountServiceId
): void {
  if (!isSubaccountServiceEnabled(tenant, service)) {
    throw new ServiceNotAssignedError();
  }
}

export function assertAnySubaccountService(
  tenant: Tenant,
  services: readonly SubaccountServiceId[]
): void {
  if (services.some((service) => isSubaccountServiceEnabled(tenant, service))) return;
  throw new ServiceNotAssignedError();
}

export async function assertAssignedServices(
  tenantId: string,
  services: SubaccountServiceId | readonly SubaccountServiceId[]
): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const list = Array.isArray(services) ? services : [services];
  assertAnySubaccountService(tenant, list);
}

export function sumAllocatedLimits(children: Tenant[]): Record<BagLimitKey, number> {
  const allocated = Object.fromEntries(BAG_LIMIT_KEYS.map((key) => [key, 0])) as Record<
    BagLimitKey,
    number
  >;
  for (const child of children) {
    const limits = child.serviceLimits ?? {};
    for (const key of BAG_LIMIT_KEYS) {
      const value = limits[key];
      if (typeof value === "number") allocated[key] += value;
    }
  }
  return allocated;
}

export function assertBagAllocation(
  resellerLimits: PlanLimits,
  siblings: Tenant[],
  nextLimits: ResellerLimitsOverride
): void {
  const allocated = sumAllocatedLimits(siblings);
  for (const key of BAG_LIMIT_KEYS) {
    const total = resellerLimits[key];
    if (typeof total !== "number" || isUnlimited(total)) continue;
    const nextVal = nextLimits[key] ?? 0;
    const others = allocated[key] ?? 0;
    if (others + nextVal > total) {
      throw new BagLimitExceededError(
        `Allocated ${key} exceeds the reseller bag (${others + nextVal} > ${total})`
      );
    }
  }
}

export function buildResellerBag(resellerLimits: PlanLimits, children: Tenant[]) {
  const allocated = sumAllocatedLimits(children);
  const remaining: Record<string, number | null> = {};
  const total: Record<string, number> = {};
  for (const key of BAG_LIMIT_KEYS) {
    const value = resellerLimits[key];
    total[key] = value;
    remaining[key] = isUnlimited(value) ? null : Math.max(0, value - allocated[key]);
  }
  return { total, allocated, remaining };
}

export function isBagLimitKey(value: string): value is BagLimitKey {
  return BAG_KEY_SET.has(value);
}
