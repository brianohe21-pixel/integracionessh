import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  extractAuthContext,
  assertResellerTenant,
  assertResellerOwnsSubaccount,
} from "../../lib/auth/cognito.js";
import {
  createTenant,
  updateTenant,
  listSubaccounts,
  countSubaccounts,
  normalizeDomain,
  getTenantIdByDomain,
} from "../../lib/dynamodb/tenant.repository.js";
import { inviteMemberUser } from "../../lib/cognito/invite-member.js";
import { sendSubaccountInviteEmail } from "../../lib/email/subaccount-invite.js";
import { getEffectivePlanLimits, PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  SUBACCOUNT_SERVICES,
  assertBagAllocation,
  buildResellerBag,
  normalizeEnabledServices,
  normalizeServiceLimits,
  trimServiceLimitsForEnabled,
} from "../../lib/billing/subaccount-services.js";
import {
  ensureResellerDomainInAmplify,
  getResellerDomainDnsInfo,
  isReservedPlatformDomain,
  removeResellerDomainFromAmplify,
  type ResellerDomainDnsInfo,
} from "../../lib/amplify/custom-domain.js";
import {
  addCustomDomainToCognitoClient,
  removeCustomDomainFromCognitoClient,
} from "../../lib/cognito/custom-domain-callbacks.js";
import {
  ok,
  created,
  badRequest,
  notFound,
  handleError,
  parseJsonBody,
} from "../../lib/http.js";
import type {
  CustomDomainStatus,
  ResellerConfig,
  ResellerLimitsOverride,
  SubaccountServiceId,
  Tenant,
} from "../../types/index.js";

const SubaccountServiceSchema = z.enum(
  SUBACCOUNT_SERVICES as unknown as [SubaccountServiceId, ...SubaccountServiceId[]]
);

const ServiceLimitsSchema = z.record(z.number().int().min(0)).optional();

const CreateSubaccountSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email(),
  ownerName: z.string().min(1).max(128).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  inviteOwner: z.boolean().optional().default(true),
  enabledServices: z.array(SubaccountServiceSchema).optional(),
  serviceLimits: ServiceLimitsSchema,
});

const UpdateSubaccountSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
  enabledServices: z.array(SubaccountServiceSchema).optional(),
  serviceLimits: ServiceLimitsSchema,
});

const RegisterDomainSchema = z.object({
  customDomain: z
    .string()
    .min(3)
    .max(253)
    .regex(
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
      "Invalid domain"
    ),
});

function homeTenantId(auth: { tenantId: string; homeTenantId?: string }): string {
  return auth.homeTenantId ?? auth.tenantId;
}

function resolveSubaccountServices(
  enabledServices: SubaccountServiceId[] | undefined,
  serviceLimits: Record<string, number> | undefined,
  fallbackEnabled?: SubaccountServiceId[],
  fallbackLimits?: ResellerLimitsOverride
): { enabledServices: SubaccountServiceId[]; serviceLimits: ResellerLimitsOverride } {
  const enabled = normalizeEnabledServices(enabledServices ?? fallbackEnabled);
  const limits = trimServiceLimitsForEnabled(
    enabled,
    normalizeServiceLimits(serviceLimits ?? fallbackLimits)
  );
  return { enabledServices: enabled, serviceLimits: limits };
}

function fallbackCnameTarget(): string {
  return (process.env.FRONTEND_URL ?? "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function defaultResellerConfig(existing?: ResellerConfig): ResellerConfig {
  return {
    maxSubaccounts: existing?.maxSubaccounts ?? 25,
    defaultSubaccountPlan: existing?.defaultSubaccountPlan ?? "pro",
    allowSubaccountBranding: existing?.allowSubaccountBranding ?? false,
    ...(existing?.customDomain ? { customDomain: existing.customDomain } : {}),
    customDomainStatus: existing?.customDomainStatus ?? "none",
    ...(existing?.limitsOverride ? { limitsOverride: existing.limitsOverride } : {}),
  };
}

function domainResponse(
  customDomain: string | null,
  customDomainStatus: string,
  dns?: ResellerDomainDnsInfo | null
) {
  return {
    customDomain,
    customDomainStatus,
    cnameTarget: dns?.cnameTarget || fallbackCnameTarget(),
    amplifyStatus: dns?.domainStatus ?? null,
    amplifyStatusReason: dns?.statusReason ?? null,
    subdomainVerified: dns?.subdomainVerified ?? false,
    dnsRecords: dns?.dnsRecords ?? [],
  };
}

async function maybeAutoActivateDomain(
  tenantId: string,
  reseller: Tenant,
  domain: string,
  dns: ResellerDomainDnsInfo
): Promise<{ status: CustomDomainStatus; dns: ResellerDomainDnsInfo }> {
  if (!dns.ready || reseller.resellerConfig?.customDomainStatus === "active") {
    return {
      status: reseller.resellerConfig?.customDomainStatus ?? "pending_dns",
      dns,
    };
  }

  try {
    await addCustomDomainToCognitoClient(domain);
    const resellerConfig: ResellerConfig = {
      ...defaultResellerConfig(reseller.resellerConfig),
      customDomain: domain,
      customDomainStatus: "active",
    };
    await updateTenant(tenantId, { resellerConfig });
    return { status: "active", dns };
  } catch (error) {
    console.error("Auto-activate custom domain failed", error);
    const resellerConfig: ResellerConfig = {
      ...defaultResellerConfig(reseller.resellerConfig),
      customDomain: domain,
      customDomainStatus: "error",
    };
    await updateTenant(tenantId, { resellerConfig });
    return { status: "error", dns };
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const reseller = await assertResellerTenant(auth);
    const parentId = homeTenantId(auth);
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";
    const subaccountId = event.pathParameters?.subaccountId;

    if (method === "GET" && path.endsWith("/reseller/subaccounts")) {
      const items = await listSubaccounts(parentId);
      const bag = buildResellerBag(getEffectivePlanLimits(reseller), items);
      return ok({
        items,
        maxSubaccounts: reseller.resellerConfig?.maxSubaccounts ?? 25,
        count: items.length,
        bag,
      });
    }

    if (method === "POST" && path.endsWith("/reseller/subaccounts")) {
      const body = parseJsonBody(event);
      const parsed = CreateSubaccountSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      const count = await countSubaccounts(parentId);
      const max = reseller.resellerConfig?.maxSubaccounts ?? 25;
      if (count >= max) {
        throw new PlanLimitError(
          "PLAN_LIMIT_SUBACCOUNTS",
          `Maximum subaccounts reached (${max})`
        );
      }

      const now = new Date().toISOString();
      const childPlan =
        parsed.data.plan ??
        reseller.resellerConfig?.defaultSubaccountPlan ??
        "pro";
      const childId = randomUUID();
      const siblings = await listSubaccounts(parentId);
      const services = resolveSubaccountServices(
        parsed.data.enabledServices,
        parsed.data.serviceLimits
      );
      assertBagAllocation(
        getEffectivePlanLimits(reseller),
        siblings,
        services.serviceLimits
      );
      const child: Tenant = {
        tenantId: childId,
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        plan: childPlan,
        tenantKind: "subaccount",
        parentTenantId: parentId,
        status: "active",
        subscriptionStatus: "active",
        enabledServices: services.enabledServices,
        serviceLimits: services.serviceLimits,
        createdAt: now,
        updatedAt: now,
      };

      await createTenant(child);

      let invite:
        | { username: string; temporaryPassword: string; emailSent: boolean }
        | undefined;

      if (parsed.data.inviteOwner !== false) {
        const invited = await inviteMemberUser({
          email: parsed.data.email.toLowerCase(),
          name: parsed.data.ownerName ?? parsed.data.name,
          tenantId: childId,
        });
        const emailResult = await sendSubaccountInviteEmail({
          to: parsed.data.email.toLowerCase(),
          ownerName: parsed.data.ownerName ?? parsed.data.name,
          subaccountName: parsed.data.name,
          resellerName: reseller.name,
          temporaryPassword: invited.temporaryPassword,
          ...(reseller.resellerConfig?.customDomain &&
          reseller.resellerConfig.customDomainStatus === "active"
            ? { customDomain: reseller.resellerConfig.customDomain }
            : {}),
        });
        invite = {
          username: invited.username,
          temporaryPassword: invited.temporaryPassword,
          emailSent: emailResult.sent,
        };
      }

      return created({ tenant: child, invite });
    }

    if (
      method === "GET" &&
      subaccountId &&
      path.includes("/reseller/subaccounts/") &&
      !path.endsWith("/assume")
    ) {
      const child = await assertResellerOwnsSubaccount(parentId, subaccountId);
      return ok(child);
    }

    if (method === "PUT" && subaccountId && !path.endsWith("/assume")) {
      const child = await assertResellerOwnsSubaccount(parentId, subaccountId);
      const body = parseJsonBody(event);
      const parsed = UpdateSubaccountSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      const updates: Partial<Omit<Tenant, "tenantId" | "createdAt">> = {};
      if (parsed.data.name !== undefined) updates.name = parsed.data.name;
      if (parsed.data.status !== undefined) updates.status = parsed.data.status;
      if (parsed.data.plan !== undefined) updates.plan = parsed.data.plan;
      if (parsed.data.enabledServices !== undefined || parsed.data.serviceLimits !== undefined) {
        const services = resolveSubaccountServices(
          parsed.data.enabledServices,
          parsed.data.serviceLimits,
          child.enabledServices,
          child.serviceLimits
        );
        const siblings = (await listSubaccounts(parentId)).filter(
          (item) => item.tenantId !== child.tenantId
        );
        assertBagAllocation(
          getEffectivePlanLimits(reseller),
          siblings,
          services.serviceLimits
        );
        updates.enabledServices = services.enabledServices;
        updates.serviceLimits = services.serviceLimits;
      }

      const updated = await updateTenant(child.tenantId, updates);
      return ok(updated);
    }

    if (method === "POST" && subaccountId && path.endsWith("/assume")) {
      const child = await assertResellerOwnsSubaccount(parentId, subaccountId);
      if (child.status === "suspended") {
        return badRequest("Subaccount is suspended");
      }
      return ok({
        tenantId: child.tenantId,
        tenant: child,
        header: { "X-Tenant-Context": child.tenantId },
      });
    }

    if (method === "GET" && path.endsWith("/reseller/domain")) {
      const domain = reseller.resellerConfig?.customDomain ?? null;
      if (!domain) {
        return ok(domainResponse(null, "none"));
      }

      let dns: ResellerDomainDnsInfo | null = null;
      try {
        dns = await getResellerDomainDnsInfo(domain);
        if (!dns) {
          dns = await ensureResellerDomainInAmplify(domain);
        }
      } catch (error) {
        console.error("Failed to read/provision Amplify domain association", error);
      }

      let status = reseller.resellerConfig?.customDomainStatus ?? "pending_dns";
      if (dns) {
        const activated = await maybeAutoActivateDomain(parentId, reseller, domain, dns);
        status = activated.status;
        dns = activated.dns;
      }

      return ok(domainResponse(domain, status, dns));
    }

    if (method === "PUT" && path.endsWith("/reseller/domain")) {
      const body = parseJsonBody(event);
      const parsed = RegisterDomainSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      const domain = normalizeDomain(parsed.data.customDomain);
      if (isReservedPlatformDomain(domain)) {
        return badRequest("This domain is reserved by the platform");
      }
      const mappedTenantId = await getTenantIdByDomain(domain);
      if (mappedTenantId && mappedTenantId !== parentId) {
        return badRequest("Domain is already registered to another tenant");
      }

      const previousDomain = reseller.resellerConfig?.customDomain
        ? normalizeDomain(reseller.resellerConfig.customDomain)
        : null;
      if (previousDomain && previousDomain !== domain) {
        try {
          await removeResellerDomainFromAmplify(previousDomain);
        } catch (error) {
          console.error("Failed to remove previous Amplify domain", error);
        }
        try {
          await removeCustomDomainFromCognitoClient(previousDomain);
        } catch (error) {
          console.error("Failed to remove previous Cognito callbacks", error);
        }
      }

      let dns: ResellerDomainDnsInfo;
      try {
        dns = await ensureResellerDomainInAmplify(domain);
      } catch (error) {
        console.error("Failed to create Amplify domain association", error);
        const message =
          error instanceof Error ? error.message : "Failed to provision domain in Amplify";
        return badRequest(message);
      }

      const resellerConfig: ResellerConfig = {
        ...defaultResellerConfig(reseller.resellerConfig),
        customDomain: domain,
        customDomainStatus: dns.ready ? "active" : "pending_dns",
      };

      if (dns.ready) {
        try {
          await addCustomDomainToCognitoClient(domain);
        } catch (error) {
          console.error("Failed to update Cognito callbacks on register", error);
          resellerConfig.customDomainStatus = "error";
        }
      }

      const updated = await updateTenant(parentId, { resellerConfig });
      return ok(
        domainResponse(
          updated.resellerConfig?.customDomain ?? domain,
          updated.resellerConfig?.customDomainStatus ?? "pending_dns",
          dns
        )
      );
    }

    if (method === "DELETE" && path.endsWith("/reseller/domain")) {
      const domain = reseller.resellerConfig?.customDomain
        ? normalizeDomain(reseller.resellerConfig.customDomain)
        : null;
      if (!domain) {
        return ok(domainResponse(null, "none"));
      }

      try {
        await removeResellerDomainFromAmplify(domain);
      } catch (error) {
        console.error("Failed to remove Amplify domain", error);
      }
      try {
        await removeCustomDomainFromCognitoClient(domain);
      } catch (error) {
        console.error("Failed to remove Cognito callbacks", error);
      }

      const base = defaultResellerConfig(reseller.resellerConfig);
      const resellerConfig: ResellerConfig = {
        maxSubaccounts: base.maxSubaccounts,
        defaultSubaccountPlan: base.defaultSubaccountPlan,
        allowSubaccountBranding: base.allowSubaccountBranding,
        customDomainStatus: "none",
        ...(base.limitsOverride ? { limitsOverride: base.limitsOverride } : {}),
      };
      await updateTenant(parentId, { resellerConfig });
      return ok(domainResponse(null, "none"));
    }

    return notFound("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
