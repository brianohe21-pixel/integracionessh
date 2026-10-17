import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  resolveRequestAuth,
  assertAdvisorOrMember,
} from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { handleError } from "../../lib/http.js";
import { handleTagsRoutes } from "../../lib/tags/routes.js";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    await assertAssignedServices(auth.tenantId, "contacts");
    assertAdvisorOrMember(auth);

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const normalized = rawPath.replace(/\/+$/, "");
    const idx = normalized.indexOf("/tags/");
    const suffix =
      idx >= 0
        ? normalized.slice(idx + "/tags/".length)
        : normalized.endsWith("/tags")
          ? ""
          : normalized.replace(/^\/tags\/?/, "");
    const segments = suffix.split("/").filter(Boolean);

    return handleTagsRoutes({
      auth,
      method,
      segments,
      body: event.body,
    });
  } catch (error) {
    return handleError(error);
  }
}
