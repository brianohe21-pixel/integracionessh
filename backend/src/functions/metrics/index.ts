import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getTenantUsageMetrics } from "../../lib/dynamodb/metrics.repository.js";
import { getMarketingMetrics } from "../../lib/dynamodb/marketing-metrics.repository.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;

    if (method === "GET" && rawPath.endsWith("/metrics/marketing")) {
      const marketing = await getMarketingMetrics(auth.tenantId);
      return ok(marketing);
    }

    if (method === "GET") {
      const metrics = await getTenantUsageMetrics(auth.tenantId);
      return ok(metrics);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
