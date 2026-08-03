import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertAdminRole } from "../../lib/auth/cognito.js";
import { listCognitoUsers, updateCognitoUser } from "../../lib/cognito/admin-users.js";
import { listAllPayments } from "../../lib/dynamodb/payment.repository.js";
import {
  getResellerPlanDefaults,
  putResellerPlanDefaults,
} from "../../lib/dynamodb/platform-config.repository.js";
import { getTenant, updateTenant, normalizeDomain } from "../../lib/dynamodb/tenant.repository.js";
import { buildResellerConfigFromDefaults } from "../../lib/billing/activate-plan.js";
import { addCustomDomainToCognitoClient } from "../../lib/cognito/custom-domain-callbacks.js";
import {
  ensureResellerDomainInAmplify,
  getResellerDomainDnsInfo,
} from "../../lib/amplify/custom-domain.js";
import { ok, badRequest, notFound, handleError, parseJsonBody } from "../../lib/http.js";
import type { ResellerConfig, ResellerPlanDefaults } from "../../types/index.js";

const CognitoPatchSchema = z.object({
  enabled: z.boolean().optional(),
  tenantId: z.string().min(1).max(128).optional(),
  role: z.enum(["admin", "member"]).optional(),
});

const ResellerDefaultsSchema = z.object({
  maxSubaccounts: z.number().int().min(1).max(10_000),
  defaultSubaccountPlan: z.enum(["free", "pro", "enterprise"]),
  allowSubaccountBranding: z.boolean(),
  limitsOverride: z.record(z.union([z.number(), z.boolean()])).optional(),
});

const ActivateDomainSchema = z.object({
  tenantId: z.string().min(1),
  status: z.enum(["pending_dns", "active", "error"]).optional().default("active"),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertAdminRole(auth);

    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";
    const username = event.pathParameters?.username;

    if (method === "GET" && path.endsWith("/admin/cognito/users")) {
      const limit = Math.min(
        Math.max(Number(event.queryStringParameters?.limit ?? "25"), 1),
        60
      );
      const paginationToken = event.queryStringParameters?.paginationToken;
      const role = event.queryStringParameters?.role;
      const result = await listCognitoUsers(
        limit,
        paginationToken,
        role === "admin" || role === "member" ? role : undefined
      );
      return ok(result);
    }

    if (method === "PATCH" && path.includes("/admin/cognito/users/") && username) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CognitoPatchSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      if (
        parsed.data.enabled === undefined &&
        parsed.data.tenantId === undefined &&
        parsed.data.role === undefined
      ) {
        return badRequest("No updates provided");
      }

      const updates: { enabled?: boolean; tenantId?: string; role?: string } = {};
      if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
      if (parsed.data.tenantId !== undefined) updates.tenantId = parsed.data.tenantId;
      if (parsed.data.role !== undefined) updates.role = parsed.data.role;

      await updateCognitoUser(decodeURIComponent(username), updates);
      return ok({ updated: true });
    }

    if (method === "GET" && path.endsWith("/admin/payments")) {
      const payments = await listAllPayments();
      return ok(payments);
    }

    if (method === "GET" && path.endsWith("/admin/reseller-plan-defaults")) {
      const defaults = await getResellerPlanDefaults();
      return ok(defaults);
    }

    if (method === "PUT" && path.endsWith("/admin/reseller-plan-defaults")) {
      const body = parseJsonBody(event);
      const parsed = ResellerDefaultsSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }
      const defaults: ResellerPlanDefaults = {
        maxSubaccounts: parsed.data.maxSubaccounts,
        defaultSubaccountPlan: parsed.data.defaultSubaccountPlan,
        allowSubaccountBranding: parsed.data.allowSubaccountBranding,
      };
      if (parsed.data.limitsOverride) {
        defaults.limitsOverride = parsed.data.limitsOverride as NonNullable<
          ResellerPlanDefaults["limitsOverride"]
        >;
      }
      return ok(await putResellerPlanDefaults(defaults));
    }

    if (method === "POST" && path.endsWith("/admin/reseller-domain/activate")) {
      const body = parseJsonBody(event);
      const parsed = ActivateDomainSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues[0]?.message ?? "Invalid input");
      }

      const tenant = await getTenant(parsed.data.tenantId);
      if (!tenant) return notFound("Tenant not found");
      if (tenant.plan !== "reseller") {
        return badRequest("Tenant is not a reseller");
      }

      const domain = tenant.resellerConfig?.customDomain;
      if (!domain) return badRequest("Reseller has no custom domain configured");

      const normalized = normalizeDomain(domain);
      const resellerConfig: ResellerConfig = {
        ...(await buildResellerConfigFromDefaults(tenant.resellerConfig)),
        customDomain: normalized,
        customDomainStatus: parsed.data.status,
      };

      if (parsed.data.status === "active") {
        let dns = await getResellerDomainDnsInfo(normalized);
        if (!dns) {
          try {
            dns = await ensureResellerDomainInAmplify(normalized);
          } catch (error) {
            console.error("Failed to provision Amplify domain on activate", error);
            resellerConfig.customDomainStatus = "error";
            await updateTenant(tenant.tenantId, { resellerConfig });
            return badRequest("Failed to provision domain in Amplify");
          }
        }

        if (!dns.ready) {
          resellerConfig.customDomainStatus = "pending_dns";
          await updateTenant(tenant.tenantId, { resellerConfig });
          return badRequest(
            `Amplify domain is not ready yet (status=${dns.domainStatus}, verified=${dns.subdomainVerified}). Add the DNS records and retry.`
          );
        }

        try {
          await addCustomDomainToCognitoClient(resellerConfig.customDomain!);
        } catch (error) {
          console.error("Failed to update Cognito callbacks", error);
          resellerConfig.customDomainStatus = "error";
          await updateTenant(tenant.tenantId, { resellerConfig });
          return badRequest("Failed to update Cognito callback URLs");
        }
      }

      const updated = await updateTenant(tenant.tenantId, { resellerConfig });
      return ok({
        tenantId: updated.tenantId,
        customDomain: updated.resellerConfig?.customDomain,
        customDomainStatus: updated.resellerConfig?.customDomainStatus,
      });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
