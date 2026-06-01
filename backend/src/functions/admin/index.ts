import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertAdminRole } from "../../lib/auth/cognito.js";
import { listCognitoUsers, updateCognitoUser } from "../../lib/cognito/admin-users.js";
import { listAllPayments } from "../../lib/dynamodb/payment.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const CognitoPatchSchema = z.object({
  enabled: z.boolean().optional(),
  tenantId: z.string().min(1).max(128).optional(),
  role: z.enum(["admin", "member"]).optional(),
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

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
