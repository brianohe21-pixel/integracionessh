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
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { recordLegalAcceptance, getLegalAcceptance } from "../../lib/dynamodb/legal.repository.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { Tenant } from "../../types/index.js";

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

    if (method === "POST" && event.rawPath?.endsWith("/accept-terms")) {
      const acceptance = await recordLegalAcceptance(auth.tenantId, auth.userId);
      return ok(acceptance);
    }

    if (method === "GET" && event.rawPath?.endsWith("/legal")) {
      const acceptance = await getLegalAcceptance(auth.tenantId, auth.userId);
      return ok(acceptance ?? { accepted: false });
    }

    if (method === "GET" && tenantId) {
      const resolvedId = tenantId === "me" ? auth.tenantId : tenantId;
      if (resolvedId === auth.tenantId) {
        const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
        return ok(tenant);
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
