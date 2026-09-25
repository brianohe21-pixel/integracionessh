import {
  SUBACCOUNT_SERVICES,
  type ResellerLimitsOverride,
  type SubaccountServiceId,
  type Tenant,
} from "@/types";

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
  sales: [],
  advisors: [],
  automations: ["maxAutomationsPerBot", "maxScheduledAutomations"],
  flows: ["maxVisualFlowsPerBot", "maxFlowNodes", "maxActiveFlowRuns", "maxHostedFormsPerTenant"],
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
  integrations: [],
};

export const BAG_LIMIT_KEYS = Array.from(
  new Set(SUBACCOUNT_SERVICES.flatMap((service) => [...SERVICE_LIMIT_KEYS[service]]))
) as BagLimitKey[];

export const SERVICE_CATEGORIES: Array<{
  id: string;
  labelKey: string;
  services: SubaccountServiceId[];
}> = [
  {
    id: "operations",
    labelKey: "nav.categoryOperations",
    services: [
      "bots",
      "voiceAgents",
      "contactCenter",
      "conversations",
      "supervisor",
      "contacts",
      "leads",
      "sales",
      "advisors",
    ],
  },
  {
    id: "automation",
    labelKey: "nav.categoryAutomation",
    services: ["automations", "flows"],
  },
  {
    id: "outreach",
    labelKey: "nav.categoryOutreach",
    services: ["templates", "bulkSend", "campaigns", "emailMarketing"],
  },
  {
    id: "insights",
    labelKey: "nav.categoryInsights",
    services: ["metrics"],
  },
  {
    id: "integrations",
    labelKey: "nav.categoryIntegrations",
    services: ["apps", "developer", "integrations"],
  },
];

const SERVICE_PATHS: Array<{ prefix: string; service: SubaccountServiceId }> = [
  { prefix: "/voice-agents", service: "voiceAgents" },
  { prefix: "/contact-center", service: "contactCenter" },
  { prefix: "/conversations", service: "conversations" },
  { prefix: "/supervisor", service: "supervisor" },
  { prefix: "/contacts", service: "contacts" },
  { prefix: "/leads", service: "leads" },
  { prefix: "/ads", service: "leads" },
  { prefix: "/sales", service: "sales" },
  { prefix: "/tasks", service: "sales" },
  { prefix: "/advisors", service: "advisors" },
  { prefix: "/flows", service: "flows" },
  { prefix: "/forms", service: "flows" },
  { prefix: "/templates", service: "templates" },
  { prefix: "/bulk-send", service: "bulkSend" },
  { prefix: "/campaigns", service: "campaigns" },
  { prefix: "/email-marketing", service: "emailMarketing" },
  { prefix: "/sms", service: "campaigns" },
  { prefix: "/metrics", service: "metrics" },
  { prefix: "/apps", service: "apps" },
  { prefix: "/developer", service: "developer" },
  { prefix: "/integrations", service: "integrations" },
  { prefix: "/reviews", service: "integrations" },
  { prefix: "/bots", service: "bots" },
];

const ALWAYS_ALLOWED_PREFIXES = [
  "/dashboard",
  "/settings",
  "/alerts",
  "/support",
  "/onboarding",
  "/subaccounts",
  "/inbox",
  "/admin",
];

export function isBillingPath(pathname: string): boolean {
  return pathname === "/billing" || pathname.startsWith("/billing/");
}

export function isBillingVisible(
  tenant: Tenant | undefined | null,
  activeTenantContext?: string | null
): boolean {
  if (!tenant) return true;
  if (isSubaccountTenant(tenant)) return false;
  if (activeTenantContext && activeTenantContext !== tenant.tenantId) return false;
  return true;
}

export const SERVICE_NAV_KEYS: Record<SubaccountServiceId, string> = {
  bots: "nav.bots",
  voiceAgents: "nav.voiceAgents",
  contactCenter: "nav.contactCenter",
  conversations: "nav.conversations",
  supervisor: "nav.supervisor",
  contacts: "nav.contacts",
  leads: "nav.leads",
  sales: "nav.sales",
  advisors: "nav.advisors",
  automations: "nav.automations",
  flows: "nav.flows",
  templates: "nav.templates",
  bulkSend: "nav.bulkSend",
  campaigns: "nav.campaigns",
  emailMarketing: "nav.emailMarketing",
  metrics: "nav.metrics",
  apps: "nav.apps",
  developer: "nav.developer",
  integrations: "nav.integrations",
};

export type ResellerBag = {
  total: Record<string, number>;
  allocated: Record<string, number>;
  remaining: Record<string, number | null>;
};

export const UNLIMITED_LIMIT_VALUE = Number.MAX_SAFE_INTEGER;

export function isUnlimitedLimit(value: number | null | undefined): boolean {
  return typeof value === "number" && value >= UNLIMITED_LIMIT_VALUE / 2;
}

export type ServiceLimitMode = "default" | "unlimited" | "custom";

export function getServiceLimitMode(
  limits: ResellerLimitsOverride,
  key: BagLimitKey
): ServiceLimitMode {
  const value = limits[key];
  if (value === undefined) return "default";
  if (isUnlimitedLimit(value)) return "unlimited";
  return "custom";
}

export function isSubaccountTenant(tenant: Tenant | undefined | null): boolean {
  if (!tenant) return false;
  return tenant.tenantKind === "subaccount" || Boolean(tenant.parentTenantId);
}

export function isSubaccountServiceEnabled(
  tenant: Tenant | undefined | null,
  service: SubaccountServiceId
): boolean {
  if (!isSubaccountTenant(tenant)) return true;
  if (!tenant?.enabledServices) return true;
  return tenant.enabledServices.includes(service);
}

export function serviceForPath(pathname: string): SubaccountServiceId | null {
  if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }
  const match = SERVICE_PATHS.find(
    (item) => pathname === item.prefix || pathname.startsWith(`${item.prefix}/`)
  );
  return match?.service ?? null;
}

export function serviceForNavHref(href: string): SubaccountServiceId | null {
  const path = href.split("?")[0] ?? href;
  return serviceForPath(path);
}

export function defaultEnabledServices(): SubaccountServiceId[] {
  return [...SUBACCOUNT_SERVICES];
}

export function emptyServiceLimits(): ResellerLimitsOverride {
  return {};
}
