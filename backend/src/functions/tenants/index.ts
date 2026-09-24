import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getTenant,
  ensureTenant,
  createTenant,
  clearTenantPricePerMessage,
  clearTenantPlanLimitsOverride,
  updateTenant,
  deleteTenant,
  listTenants,
  getTenantIdByDomain,
  normalizeDomain,
} from "../../lib/dynamodb/tenant.repository.js";
import {
  applyAdminTenantPlan,
  buildResellerConfigFromDefaults,
} from "../../lib/billing/activate-plan.js";
import {
  resolveRequestAuth,
  resolveRequestAuthWithoutPortalCheck,
  assertMemberRole,
} from "../../lib/auth/cognito.js";
import { isAuthAllowedOnPortal, getActivePortalTenantId } from "../../lib/auth/host-portal.js";
import type {
  AuthContext,
  ResellerConfig,
  Tenant,
  TenantBranding,
  InboxSlaSettings,
  MetricsReportSchedule,
  WebsiteAnalyticsSettings,
  TaskReminderWhatsAppSettings,
} from "../../types/index.js";
import { recordLegalAcceptance, getLegalAcceptance } from "../../lib/dynamodb/legal.repository.js";
import {
  saveOpenAIApiKey,
  deleteOpenAIApiKey,
  hasOpenAIApiKey,
} from "../../lib/openai/secrets.js";
import { assertCanCustomizeBrandingAsync } from "../../lib/billing/assert-plan.js";
import { getEffectivePlanLimits } from "../../lib/billing/plan-limits.js";
import { getResolvedTenantBranding } from "../../lib/branding/service.js";
import { getResolvedBrandingWithInheritance } from "../../lib/branding/inherit.js";
import {
  buildLogoS3Key,
  extensionForContentType,
  isValidPrimaryColor,
  normalizeLogoContentType,
} from "../../lib/branding/resolve.js";
import {
  deleteObject,
  putObjectBuffer,
} from "../../lib/s3/client.js";
import {
  ok,
  created,
  noContent,
  badRequest,
  forbidden,
  notFound,
  handleError,
  parseJsonBody,
} from "../../lib/http.js";
import { resolveInboxSlaSettings } from "../../lib/advisor/inbox-sla.js";
import { resolveMetricsReportSchedule } from "../../lib/reports/resolve-schedule.js";
import {
  isValidGaMeasurementId,
  normalizeGaMeasurementId,
  resolveWebsiteAnalyticsSettings,
} from "../../lib/website-analytics/settings.js";
import { syncReportSchedule } from "../../lib/reports/report-schedule.js";
import { sendScheduledReport } from "../../lib/reports/send-scheduled-report.js";
import { getTenantWhatsAppRiskByBot } from "../../lib/whatsapp/tenant-risk.js";
import { getLaw2300StatusForTenant } from "../../lib/compliance/law2300-tenant.js";
import { addCustomDomainToCognitoClient } from "../../lib/cognito/custom-domain-callbacks.js";
import { handleProviderCredentialRoutes } from "./provider-credentials.routes.js";
import { handleMetaAppRoutes } from "./meta-app.routes.js";
import { handleMemberRoutes } from "./members.routes.js";
import { handleProfileRoutes } from "./profile.routes.js";
import { handleTeamRoutes } from "./teams.routes.js";
import { handleEmailSettingsRoutes } from "./email-settings.routes.js";
import { handleGoogleBusinessOAuthCallbackRoute, handleGoogleCalendarOAuthCallbackRoute, handleIntegrationRoutes } from "./integrations.routes.js";
import { getPublicAuthMethodsByHost } from "../../lib/integrations/microsoft-sso.service.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email(),
  plan: z.enum(["free", "starter", "pro", "scale", "reseller"]).default("free"),
});

const PlanLimitValueSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

const PlanLimitsOverrideSchema = z
  .object({
    maxActiveBots: PlanLimitValueSchema.optional(),
    maxMessagesPerMonth: PlanLimitValueSchema.optional(),
    maxBulkRecipientsPerJob: PlanLimitValueSchema.optional(),
    maxActiveCampaigns: PlanLimitValueSchema.optional(),
    maxContacts: PlanLimitValueSchema.optional(),
    maxAutomationsPerBot: PlanLimitValueSchema.optional(),
    maxScheduledAutomations: PlanLimitValueSchema.optional(),
    maxDocumentsPerBot: PlanLimitValueSchema.optional(),
    maxKnowledgeStorageMb: PlanLimitValueSchema.optional(),
    maxMetaFlowsPerBot: PlanLimitValueSchema.optional(),
    maxVisualFlowsPerBot: PlanLimitValueSchema.optional(),
    maxFlowNodes: PlanLimitValueSchema.optional(),
    maxActiveFlowRuns: PlanLimitValueSchema.optional(),
    maxChannelsPerBot: PlanLimitValueSchema.optional(),
    maxWhatsAppChannelsPerBot: PlanLimitValueSchema.optional(),
    maxActiveWebChatSessions: PlanLimitValueSchema.optional(),
    maxConcurrentLiveKitCalls: PlanLimitValueSchema.optional(),
    maxVoicebotMinutesPerMonth: PlanLimitValueSchema.optional(),
    maxCalendarAppsPerTenant: PlanLimitValueSchema.optional(),
    maxPaymentsAppsPerTenant: PlanLimitValueSchema.optional(),
    maxCatalogAppsPerTenant: PlanLimitValueSchema.optional(),
    maxHostedFormsPerTenant: PlanLimitValueSchema.optional(),
    maxProductsPerBot: PlanLimitValueSchema.optional(),
    maxOrdersPerMonth: PlanLimitValueSchema.optional(),
    apiRateLimitPerMinute: PlanLimitValueSchema.optional(),
    apiRateLimitPerDay: PlanLimitValueSchema.optional(),
  })
  .strict();

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  plan: z.enum(["free", "starter", "pro", "scale", "reseller"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  law2300Exempt: z.boolean().optional(),
  pricePerMessageCents: z.number().int().min(0).max(1_000_000_000).optional(),
  planLimitsOverride: PlanLimitsOverrideSchema.nullable().optional(),
  resellerConfig: z
    .object({
      maxSubaccounts: z.number().int().min(1).max(10_000).optional(),
      defaultSubaccountPlan: z.enum(["free", "starter", "pro"]).optional(),
      customDomain: z.string().min(3).max(253).optional(),
      customDomainStatus: z
        .enum(["none", "pending_dns", "active", "error"])
        .optional(),
      allowSubaccountBranding: z.boolean().optional(),
      limitsOverride: z.record(z.union([z.number(), z.boolean()])).optional(),
    })
    .optional(),
});

const UpdateBrandingSchema = z.object({
  brandName: z.string().min(1).max(128).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be a hex color like #4f46e5")
    .optional(),
});

const LogoUploadSchema = z.object({
  contentType: z.string().min(1),
  data: z.string().min(1).max(2_500_000),
});

const UpdateOnboardingSchema = z
  .object({
    skip: z.boolean().optional(),
    testConfirmed: z.boolean().optional(),
    complete: z.boolean().optional(),
    dismissBanner: z.boolean().optional(),
  })
  .refine((data) => data.skip || data.testConfirmed || data.complete || data.dismissBanner, {
    message: "At least one action is required",
  });

const UpdateInboxSlaSchema = z.object({
  enabled: z.boolean(),
  firstResponseMinutes: z.coerce.number().int().min(1).max(1440),
});

const UpdateReportScheduleSchema = z
  .object({
    enabled: z.boolean(),
    frequency: z.enum(["daily", "weekly"]),
    recipients: z.array(z.string().email()).max(10),
    hour: z.coerce.number().int().min(0).max(23),
    dayOfWeek: z.coerce.number().int().min(1).max(7).optional(),
    timezone: z.string().min(1).max(64),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.recipients.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one recipient is required when enabled",
        path: ["recipients"],
      });
    }
    if (data.frequency === "weekly" && data.dayOfWeek === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dayOfWeek is required for weekly schedules",
        path: ["dayOfWeek"],
      });
    }
  });

const UpdateWebsiteAnalyticsSchema = z
  .object({
    enabled: z.boolean(),
    googleAnalyticsMeasurementId: z.string().trim().max(32).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.enabled) return;
    const measurementId = data.googleAnalyticsMeasurementId?.trim();
    if (!measurementId || !isValidGaMeasurementId(measurementId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid Google Analytics measurement ID (expected format G-XXXXXXXXXX)",
        path: ["googleAnalyticsMeasurementId"],
      });
    }
  });

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

async function handleInboxSlaRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  const isInboxSlaRoute = rawPath.includes("/tenants/me/inbox-sla");
  if (!isInboxSlaRoute) return null;

  const method = (event.requestContext.http.method ?? "").toUpperCase();

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET") {
    const tenant = await getTenant(auth.tenantId);
    return ok(resolveInboxSlaSettings(tenant?.inboxSla));
  }

  if (method === "PUT") {
    const body = parseJsonBody(event);
    const parsed = UpdateInboxSlaSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    const inboxSla: InboxSlaSettings = parsed.data;
    const updated = await updateTenant(auth.tenantId, { inboxSla });
    return ok(resolveInboxSlaSettings(updated.inboxSla));
  }

  return badRequest("Route not found");
}

const TaskReminderWhatsAppSettingsSchema = z.object({
  botId: z.string().max(80).optional(),
  templateName: z.string().max(120).optional(),
  templateLanguage: z.string().min(2).max(10).optional(),
});

function resolveTaskReminderWhatsAppSettings(settings?: {
  botId?: string;
  templateName?: string;
  templateLanguage?: string;
} | null): Required<TaskReminderWhatsAppSettings> {
  return {
    botId: settings?.botId?.trim() ?? "",
    templateName: settings?.templateName?.trim() ?? "",
    templateLanguage: settings?.templateLanguage?.trim() || "es",
  };
}

async function handleTaskReminderWhatsAppRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/task-reminder-whatsapp")) return null;

  const method = (event.requestContext.http.method ?? "").toUpperCase();

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET") {
    const tenant = await getTenant(auth.tenantId);
    return ok(resolveTaskReminderWhatsAppSettings(tenant?.taskReminderWhatsApp));
  }

  if (method === "PUT") {
    const body = parseJsonBody(event);
    const parsed = TaskReminderWhatsAppSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    const templateName = parsed.data.templateName?.trim() ?? "";
    const templateLanguage = parsed.data.templateLanguage?.trim() || "es";
    const botId = parsed.data.botId?.trim() ?? "";
    const taskReminderWhatsApp: TaskReminderWhatsAppSettings = templateName
      ? {
          templateName,
          templateLanguage,
          ...(botId ? { botId } : {}),
        }
      : {};

    const updated = await updateTenant(auth.tenantId, { taskReminderWhatsApp });
    return ok(resolveTaskReminderWhatsAppSettings(updated.taskReminderWhatsApp));
  }

  return badRequest("Route not found");
}

async function handleReportScheduleRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  const isReportScheduleRoute = rawPath.includes("/tenants/me/report-schedule");
  if (!isReportScheduleRoute) return null;

  const method = (event.requestContext.http.method ?? "").toUpperCase();

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET") {
    const tenant = await getTenant(auth.tenantId);
    return ok(resolveMetricsReportSchedule(tenant?.metricsReportSchedule));
  }

  if (method === "PUT") {
    const body = parseJsonBody(event);
    const parsed = UpdateReportScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    const tenant = await getTenant(auth.tenantId);
    const metricsReportSchedule: MetricsReportSchedule = {
      enabled: parsed.data.enabled,
      frequency: parsed.data.frequency,
      hour: parsed.data.hour,
      timezone: parsed.data.timezone,
      recipients: [...new Set(parsed.data.recipients.map((email) => email.trim().toLowerCase()))],
      ...(parsed.data.frequency === "weekly" && parsed.data.dayOfWeek !== undefined
        ? { dayOfWeek: parsed.data.dayOfWeek }
        : {}),
      ...(tenant?.metricsReportSchedule?.lastSentAt
        ? { lastSentAt: tenant.metricsReportSchedule.lastSentAt }
        : {}),
    };

    const updated = await updateTenant(auth.tenantId, { metricsReportSchedule });
    await syncReportSchedule(auth.tenantId, metricsReportSchedule);
    return ok(resolveMetricsReportSchedule(updated.metricsReportSchedule));
  }

  if (method === "POST" && rawPath.endsWith("/send-now")) {
    const tenant = await getTenant(auth.tenantId);
    const schedule = resolveMetricsReportSchedule(tenant?.metricsReportSchedule);
    if (schedule.recipients.length === 0) {
      return badRequest("At least one recipient is required");
    }
    await sendScheduledReport(auth.tenantId, { force: true });
    const refreshed = await getTenant(auth.tenantId);
    return ok(resolveMetricsReportSchedule(refreshed?.metricsReportSchedule));
  }

  return badRequest("Route not found");
}

async function handleWebsiteAnalyticsRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  const isWebsiteAnalyticsRoute = rawPath.includes("/tenants/me/website-analytics");
  if (!isWebsiteAnalyticsRoute) return null;

  const method = (event.requestContext.http.method ?? "").toUpperCase();

  assertMemberRole(auth);
  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET") {
    const tenant = await getTenant(auth.tenantId);
    return ok(resolveWebsiteAnalyticsSettings(tenant?.websiteAnalytics));
  }

  if (method === "PUT") {
    const body = parseJsonBody(event);
    const parsed = UpdateWebsiteAnalyticsSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(formatZodError(parsed.error));
    }

    const websiteAnalytics: WebsiteAnalyticsSettings = parsed.data.enabled
      ? {
          enabled: true,
          googleAnalyticsMeasurementId: normalizeGaMeasurementId(
            parsed.data.googleAnalyticsMeasurementId ?? ""
          ),
        }
      : { enabled: false };

    const updated = await updateTenant(auth.tenantId, { websiteAnalytics });
    return ok(resolveWebsiteAnalyticsSettings(updated.websiteAnalytics));
  }

  return badRequest("Route not found");
}

async function handleBrandingRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/branding")) return null;

  const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET" && rawPath.endsWith("/tenants/me/branding")) {
    const branding = await getResolvedBrandingWithInheritance(tenant);
    const limits = getEffectivePlanLimits(tenant);
    return ok({
      ...branding,
      canCustomize: limits.canCustomizeBranding,
    });
  }

  if (method === "PUT" && rawPath.endsWith("/tenants/me/branding")) {
    await assertCanCustomizeBrandingAsync(tenant);
    const body = JSON.parse(event.body ?? "{}");
    const parsed = UpdateBrandingSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const branding: TenantBranding = { ...(tenant.branding ?? {}) };
    if (parsed.data.brandName !== undefined) {
      branding.brandName = parsed.data.brandName;
    }
    if (parsed.data.primaryColor !== undefined) {
      if (!isValidPrimaryColor(parsed.data.primaryColor)) {
        return badRequest("Invalid primaryColor");
      }
      branding.primaryColor = parsed.data.primaryColor.toLowerCase();
    }

    const updated = await updateTenant(auth.tenantId, { branding });
    const resolved = await getResolvedTenantBranding(updated);
    return ok({
      ...resolved,
      canCustomize: getEffectivePlanLimits(updated).canCustomizeBranding,
    });
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/branding/logo")) {
    await assertCanCustomizeBrandingAsync(tenant);
    const body = JSON.parse(event.body ?? "{}");
    const parsed = LogoUploadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    let bytes: Buffer;
    try {
      bytes = Buffer.from(parsed.data.data, "base64");
    } catch {
      return badRequest("Invalid logo data");
    }
    if (bytes.byteLength === 0) return badRequest("Empty logo file");
    if (bytes.byteLength > 1_500_000) return badRequest("Logo must be 1.5MB or smaller");

    const contentType = normalizeLogoContentType(parsed.data.contentType);
    if (!contentType) {
      return badRequest("Unsupported logo format. Use PNG, JPEG, WebP, or SVG.");
    }

    const ext = extensionForContentType(contentType);
    const logoS3Key = buildLogoS3Key(auth.tenantId, ext);

    if (tenant.branding?.logoS3Key && tenant.branding.logoS3Key !== logoS3Key) {
      await deleteObject(tenant.branding.logoS3Key);
    }

    await putObjectBuffer(logoS3Key, bytes, contentType);

    const updated = await updateTenant(auth.tenantId, {
      branding: { ...(tenant.branding ?? {}), logoS3Key },
    });
    const resolved = await getResolvedTenantBranding(updated);
    return ok({
      ...resolved,
      canCustomize: getEffectivePlanLimits(updated).canCustomizeBranding,
    });
  }

  if (method === "DELETE" && rawPath.endsWith("/tenants/me/branding/logo")) {
    await assertCanCustomizeBrandingAsync(tenant);
    if (tenant.branding?.logoS3Key) {
      await deleteObject(tenant.branding.logoS3Key);
    }
    const branding: TenantBranding = { ...(tenant.branding ?? {}) };
    delete branding.logoS3Key;
    const updated = await updateTenant(auth.tenantId, { branding });
    const resolved = await getResolvedTenantBranding(updated);
    return ok({
      ...resolved,
      canCustomize: getEffectivePlanLimits(updated).canCustomizeBranding,
    });
  }

  if (method === "DELETE" && rawPath.endsWith("/tenants/me/branding")) {
    await assertCanCustomizeBrandingAsync(tenant);
    if (tenant.branding?.logoS3Key) {
      await deleteObject(tenant.branding.logoS3Key);
    }
    const updated = await updateTenant(auth.tenantId, { branding: {} });
    const resolved = await getResolvedBrandingWithInheritance(updated);
    return ok({
      ...resolved,
      canCustomize: getEffectivePlanLimits(updated).canCustomizeBranding,
    });
  }

  return badRequest("Route not found");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";

    if (method === "GET" && rawPath.includes("/public/branding-by-host")) {
      const host = normalizeDomain(
        event.queryStringParameters?.host ??
          event.headers?.host ??
          event.headers?.Host ??
          ""
      );
      if (!host) return badRequest("host query parameter is required");

      const tenantId = await getTenantIdByDomain(host);
      if (!tenantId) {
        return ok({ found: false });
      }
      const tenant = await getTenant(tenantId);
      if (
        !tenant ||
        tenant.status === "suspended" ||
        tenant.resellerConfig?.customDomainStatus !== "active"
      ) {
        return ok({ found: false });
      }
      const branding = await getResolvedTenantBranding(tenant);
      return ok({
        found: true,
        tenantId: tenant.tenantId,
        brandName: branding.brandName,
        primaryColor: branding.primaryColor,
        ...(branding.logoUrl ? { logoUrl: branding.logoUrl } : {}),
      });
    }

    if (method === "GET" && rawPath.includes("/public/auth-methods")) {
      const host = normalizeDomain(event.queryStringParameters?.host ?? "");
      if (!host) return badRequest("host query parameter is required");
      const methods = await getPublicAuthMethodsByHost(host);
      return ok(methods);
    }

    const googleOAuthCallbackResponse = await handleGoogleBusinessOAuthCallbackRoute(
      event,
      ENVIRONMENT
    );
    if (googleOAuthCallbackResponse) return googleOAuthCallbackResponse;

    const googleCalendarOAuthCallbackResponse = await handleGoogleCalendarOAuthCallbackRoute(
      event,
      ENVIRONMENT
    );
    if (googleCalendarOAuthCallbackResponse) return googleCalendarOAuthCallbackResponse;

    if (method === "GET" && rawPath.endsWith("/auth/portal-access")) {
      const host = normalizeDomain(event.queryStringParameters?.host ?? "");
      if (!host) return badRequest("host query parameter is required");

      const portalTenantId = await getActivePortalTenantId(host);
      if (!portalTenantId) {
        return ok({ allowed: true, restricted: false });
      }

      const auth = await resolveRequestAuthWithoutPortalCheck(event);
      const allowed = await isAuthAllowedOnPortal(auth, portalTenantId);
      if (!allowed) {
        return forbidden("This account cannot access this portal");
      }
      return ok({ allowed: true, restricted: true, portalTenantId });
    }

    const auth = await resolveRequestAuth(event);
    const tenantId = event.pathParameters?.tenantId;

    if (method === "GET" && rawPath === "/tenants") {
      if (auth.role !== "admin") {
        const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
        return ok([tenant]);
      }
      const tenants = await listTenants();
      return ok(tenants);
    }

    if (method === "GET" && rawPath.endsWith("/tenants/me/whatsapp-risk")) {
      const risk = await getTenantWhatsAppRiskByBot(auth.tenantId, ENVIRONMENT);
      return ok(risk);
    }

    if (method === "GET" && rawPath.endsWith("/tenants/me/law2300")) {
      const status = await getLaw2300StatusForTenant(auth.tenantId);
      return ok(status);
    }

    if (method === "PATCH" && event.rawPath?.endsWith("/onboarding")) {
      await ensureTenant(auth.tenantId, auth.email, auth.name);
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateOnboardingSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
      }

      const now = new Date().toISOString();
      const updates: Partial<Omit<Tenant, "tenantId" | "createdAt">> = {};

      if (parsed.data.skip) {
        updates.onboardingSkippedAt = now;
      }
      if (parsed.data.testConfirmed) {
        updates.onboardingTestConfirmedAt = now;
      }
      if (parsed.data.complete) {
        updates.onboardingCompletedAt = now;
      }
      if (parsed.data.dismissBanner) {
        updates.onboardingBannerDismissedAt = now;
      }

      const updated = await updateTenant(auth.tenantId, updates);
      return ok(updated);
    }

    if (method === "POST" && event.rawPath?.endsWith("/accept-terms")) {
      const acceptance = await recordLegalAcceptance(auth.tenantId, auth.userId);
      return ok(acceptance);
    }

    if (method === "GET" && event.rawPath?.endsWith("/legal")) {
      const acceptance = await getLegalAcceptance(auth.tenantId, auth.userId);
      return ok(acceptance ?? { accepted: false });
    }

    const brandingResponse = await handleBrandingRoutes(event, method, auth);
    if (brandingResponse) return brandingResponse;

    const inboxSlaResponse = await handleInboxSlaRoutes(event, auth);
    if (inboxSlaResponse) return inboxSlaResponse;

    const taskReminderWhatsAppResponse = await handleTaskReminderWhatsAppRoutes(event, auth);
    if (taskReminderWhatsAppResponse) return taskReminderWhatsAppResponse;

    const reportScheduleResponse = await handleReportScheduleRoutes(event, auth);
    if (reportScheduleResponse) return reportScheduleResponse;

    const websiteAnalyticsResponse = await handleWebsiteAnalyticsRoutes(event, auth);
    if (websiteAnalyticsResponse) return websiteAnalyticsResponse;

    const providerCredentialsResponse = await handleProviderCredentialRoutes(
      event,
      method,
      auth,
      ENVIRONMENT
    );
    if (providerCredentialsResponse) return providerCredentialsResponse;

    const metaAppResponse = await handleMetaAppRoutes(event, method, auth, ENVIRONMENT);
    if (metaAppResponse) return metaAppResponse;

    const profileRoutesResponse = await handleProfileRoutes(event, method, auth);
    if (profileRoutesResponse) return profileRoutesResponse;

    const memberRoutesResponse = await handleMemberRoutes(event, method, auth);
    if (memberRoutesResponse) return memberRoutesResponse;

    const teamRoutesResponse = await handleTeamRoutes(event, method, auth);
    if (teamRoutesResponse) return teamRoutesResponse;

    const emailSettingsResponse = await handleEmailSettingsRoutes(event, method, auth);
    if (emailSettingsResponse) return emailSettingsResponse;

    const integrationRoutesResponse = await handleIntegrationRoutes(
      event,
      method,
      auth,
      ENVIRONMENT
    );
    if (integrationRoutesResponse) return integrationRoutesResponse;

    if (event.rawPath?.endsWith("/openai-key")) {
      if (method === "GET") {
        const exists = await hasOpenAIApiKey(auth.tenantId, ENVIRONMENT);
        return ok({ configured: exists });
      }

      if (method === "PUT") {
        const body = JSON.parse(event.body ?? "{}") as { apiKey?: string };
        const apiKey = (body.apiKey ?? "").trim();
        if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
          return badRequest("Invalid OpenAI API key format");
        }
        await saveOpenAIApiKey(auth.tenantId, ENVIRONMENT, apiKey);
        return ok({ configured: true });
      }

      if (method === "DELETE") {
        await deleteOpenAIApiKey(auth.tenantId, ENVIRONMENT);
        return noContent();
      }
    }

    if (method === "GET" && tenantId) {
      const resolvedId = tenantId === "me" ? auth.tenantId : tenantId;
      if (resolvedId === auth.tenantId) {
        const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
        const resolvedBranding = await getResolvedBrandingWithInheritance(tenant);
        const limits = getEffectivePlanLimits(tenant);
        return ok({
          ...tenant,
          resolvedBranding: {
            ...resolvedBranding,
            canCustomize: limits.canCustomizeBranding,
          },
        });
      }
      if (auth.role !== "admin") {
        return handleError(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
      }
      const tenant = await getTenant(resolvedId);
      if (!tenant) return notFound("Tenant not found");
      return ok(tenant);
    }

    if (method === "POST") {
      if (auth.role !== "admin") return handleError(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateTenantSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const newTenant: Tenant = {
        tenantId: randomUUID(),
        name: parsed.data.name,
        email: parsed.data.email,
        plan: parsed.data.plan,
        status: "active",
        tenantKind: parsed.data.plan === "reseller" ? "reseller" : "standard",
        createdAt: now,
        updatedAt: now,
      };

      if (parsed.data.plan === "reseller") {
        newTenant.resellerConfig = await buildResellerConfigFromDefaults();
        newTenant.subscriptionStatus = "active";
      }

      await createTenant(newTenant);
      return created(newTenant);
    }

    if (method === "PUT" && tenantId) {
      const resolvedId = tenantId === "me" ? auth.tenantId : tenantId;
      if (resolvedId !== auth.tenantId && auth.role !== "admin") {
        return handleError(Object.assign(new Error("Forbidden"), { statusCode: 403 }));
      }

      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateTenantSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const updates = { ...parsed.data };
      if (auth.role !== "admin") {
        delete updates.plan;
        delete updates.status;
        delete updates.resellerConfig;
        delete updates.law2300Exempt;
        delete updates.pricePerMessageCents;
        delete updates.planLimitsOverride;
      }

      const rawBody = JSON.parse(event.body ?? "{}") as {
        pricePerMessageCents?: number | null;
        planLimitsOverride?: unknown;
      };
      if (auth.role === "admin" && rawBody.pricePerMessageCents === null) {
        const cleared = await clearTenantPricePerMessage(resolvedId);
        return ok(cleared);
      }

      if (auth.role === "admin" && rawBody.planLimitsOverride === null) {
        delete updates.planLimitsOverride;
        const cleared = await clearTenantPlanLimitsOverride(resolvedId);
        if (
          updates.plan === undefined &&
          updates.status === undefined &&
          updates.law2300Exempt === undefined &&
          updates.pricePerMessageCents === undefined &&
          updates.resellerConfig === undefined &&
          updates.name === undefined
        ) {
          return ok(cleared);
        }
      }

      if (auth.role === "admin" && updates.planLimitsOverride !== undefined && updates.planLimitsOverride !== null) {
        const cleaned = Object.fromEntries(
          Object.entries(updates.planLimitsOverride).filter(([, value]) => value !== undefined)
        );
        if (Object.keys(cleaned).length === 0) {
          delete updates.planLimitsOverride;
          const cleared = await clearTenantPlanLimitsOverride(resolvedId);
          if (
            updates.plan === undefined &&
            updates.status === undefined &&
            updates.law2300Exempt === undefined &&
            updates.pricePerMessageCents === undefined &&
            updates.resellerConfig === undefined &&
            updates.name === undefined
          ) {
            return ok(cleared);
          }
        } else {
          updates.planLimitsOverride = cleaned;
        }
      }

      if (auth.role === "admin" && updates.resellerConfig !== undefined) {
        const existing = await getTenant(resolvedId);
        if (!existing) return notFound("Tenant not found");
        const base = await buildResellerConfigFromDefaults(existing.resellerConfig);
        const patch = updates.resellerConfig;
        const merged: ResellerConfig = {
          maxSubaccounts: patch.maxSubaccounts ?? base.maxSubaccounts,
          defaultSubaccountPlan:
            patch.defaultSubaccountPlan ?? base.defaultSubaccountPlan,
          allowSubaccountBranding:
            patch.allowSubaccountBranding ?? base.allowSubaccountBranding,
          customDomainStatus: patch.customDomainStatus ?? base.customDomainStatus ?? "none",
        };
        if (patch.customDomain !== undefined) {
          merged.customDomain = normalizeDomain(patch.customDomain);
        } else if (base.customDomain) {
          merged.customDomain = base.customDomain;
        }
        const limitsOverride = {
          ...(base.limitsOverride ?? {}),
          ...(patch.limitsOverride ?? {}),
        };
        if (Object.keys(limitsOverride).length > 0) {
          merged.limitsOverride = limitsOverride;
        }
        if (
          patch.customDomainStatus === "active" &&
          merged.customDomain &&
          existing.resellerConfig?.customDomainStatus !== "active"
        ) {
          try {
            await addCustomDomainToCognitoClient(merged.customDomain);
          } catch (error) {
            console.error("Failed to update Cognito callbacks for domain", error);
            merged.customDomainStatus = "error";
          }
        }
        (updates as { resellerConfig?: ResellerConfig }).resellerConfig = merged;
      }

      if (auth.role === "admin" && updates.plan !== undefined) {
        const { plan, ...rest } = updates;
        await applyAdminTenantPlan(resolvedId, plan);
        if (Object.keys(rest).length === 0) {
          const tenant = await getTenant(resolvedId);
          if (!tenant) return notFound("Tenant not found");
          return ok(tenant);
        }
        delete updates.plan;
      }

      const updated = await updateTenant(
        resolvedId,
        updates as Partial<Omit<Tenant, "tenantId" | "createdAt">>
      );
      return ok(updated);
    }

    if (method === "DELETE" && tenantId) {
      if (auth.role !== "admin") return handleError(Object.assign(new Error("Forbidden"), { statusCode: 403 }));

      await deleteTenant(tenantId);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
