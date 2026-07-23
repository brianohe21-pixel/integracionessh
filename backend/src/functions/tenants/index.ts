import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getTenant,
  ensureTenant,
  createTenant,
  updateTenant,
  deleteTenant,
  listTenants,
} from "../../lib/dynamodb/tenant.repository.js";
import { applyAdminTenantPlan } from "../../lib/billing/activate-plan.js";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { recordLegalAcceptance, getLegalAcceptance } from "../../lib/dynamodb/legal.repository.js";
import {
  saveOpenAIApiKey,
  deleteOpenAIApiKey,
  hasOpenAIApiKey,
} from "../../lib/openai/secrets.js";
import { assertCanCustomizeBranding } from "../../lib/billing/assert-plan.js";
import { getPlanLimits } from "../../lib/billing/plan-limits.js";
import { getResolvedTenantBranding } from "../../lib/branding/service.js";
import {
  buildLogoS3Key,
  extensionForContentType,
  isValidPrimaryColor,
} from "../../lib/branding/resolve.js";
import {
  deleteObject,
  getPresignedUploadUrl,
} from "../../lib/s3/client.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { Tenant, TenantBranding, InboxSlaSettings } from "../../types/index.js";
import { resolveInboxSlaSettings } from "../../lib/advisor/inbox-sla.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const CreateTenantSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email(),
  plan: z.enum(["free", "pro", "enterprise"]).default("free"),
});

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

const UpdateBrandingSchema = z.object({
  brandName: z.string().min(1).max(128).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "primaryColor must be a hex color like #4f46e5")
    .optional(),
});

const LogoUploadSchema = z.object({
  contentType: z.enum([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/svg+xml",
  ]),
});

const UpdateOnboardingSchema = z
  .object({
    skip: z.boolean().optional(),
    testConfirmed: z.boolean().optional(),
    complete: z.boolean().optional(),
  })
  .refine((data) => data.skip || data.testConfirmed || data.complete, {
    message: "At least one action is required",
  });

const UpdateInboxSlaSchema = z.object({
  enabled: z.boolean(),
  firstResponseMinutes: z.number().int().min(1).max(1440),
});

async function handleInboxSlaRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: ReturnType<typeof extractAuthContext>
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.endsWith("/tenants/me/inbox-sla")) return null;

  await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET") {
    const tenant = await getTenant(auth.tenantId);
    return ok(resolveInboxSlaSettings(tenant?.inboxSla));
  }

  if (method === "PUT") {
    const body = JSON.parse(event.body ?? "{}");
    const parsed = UpdateInboxSlaSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const inboxSla: InboxSlaSettings = parsed.data;
    const updated = await updateTenant(auth.tenantId, { inboxSla });
    return ok(resolveInboxSlaSettings(updated.inboxSla));
  }

  return badRequest("Route not found");
}

async function handleBrandingRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  method: string,
  auth: ReturnType<typeof extractAuthContext>
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/branding")) return null;

  const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);

  if (method === "GET" && rawPath.endsWith("/tenants/me/branding")) {
    const branding = await getResolvedTenantBranding(tenant);
    const limits = getPlanLimits(tenant.plan);
    return ok({
      ...branding,
      canCustomize: limits.canCustomizeBranding,
    });
  }

  if (method === "PUT" && rawPath.endsWith("/tenants/me/branding")) {
    await assertCanCustomizeBranding(tenant);
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
    return ok(await getResolvedTenantBranding(updated));
  }

  if (method === "POST" && rawPath.endsWith("/tenants/me/branding/logo")) {
    await assertCanCustomizeBranding(tenant);
    const body = JSON.parse(event.body ?? "{}");
    const parsed = LogoUploadSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.errors[0]?.message ?? "Invalid input");
    }

    const ext = extensionForContentType(parsed.data.contentType);
    const logoS3Key = buildLogoS3Key(auth.tenantId, ext);
    const uploadUrl = await getPresignedUploadUrl(logoS3Key, parsed.data.contentType);

    if (tenant.branding?.logoS3Key && tenant.branding.logoS3Key !== logoS3Key) {
      await deleteObject(tenant.branding.logoS3Key);
    }

    const updated = await updateTenant(auth.tenantId, {
      branding: { ...(tenant.branding ?? {}), logoS3Key },
    });

    return ok({
      uploadUrl,
      logoS3Key,
      branding: await getResolvedTenantBranding(updated),
    });
  }

  if (method === "DELETE" && rawPath.endsWith("/tenants/me/branding/logo")) {
    await assertCanCustomizeBranding(tenant);
    if (tenant.branding?.logoS3Key) {
      await deleteObject(tenant.branding.logoS3Key);
    }
    const branding: TenantBranding = { ...(tenant.branding ?? {}) };
    delete branding.logoS3Key;
    const updated = await updateTenant(auth.tenantId, { branding });
    return ok(await getResolvedTenantBranding(updated));
  }

  return badRequest("Route not found");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const tenantId = event.pathParameters?.tenantId;

    if (method === "GET" && !tenantId) {
      if (auth.role !== "admin") {
        const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
        return ok([tenant]);
      }
      const tenants = await listTenants();
      return ok(tenants);
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

    const inboxSlaResponse = await handleInboxSlaRoutes(event, method, auth);
    if (inboxSlaResponse) return inboxSlaResponse;

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
        return ok(tenant);
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
        ...parsed.data,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

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
