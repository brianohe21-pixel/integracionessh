import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { getTenantUsageMetrics } from "../../lib/dynamodb/metrics.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;

    if (method === "GET") {
      const metrics = await getTenantUsageMetrics(auth.tenantId);
      return ok(metrics);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
