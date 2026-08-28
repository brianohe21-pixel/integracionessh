import type {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { assertMemberRole, resolveRequestAuth } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  deleteTenantGoogleReviewReply,
  getTenantGoogleLocations,
  listTenantGoogleReviews,
  replyToTenantGoogleReview,
} from "../../lib/google-business/service.js";
import { badRequest, handleError, noContent, ok } from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ReplySchema = z.object({
  locationId: z.string().min(1).max(256),
  comment: z.string().min(1).max(4096),
});

function reviewIdFromPath(rawPath: string): string | null {
  const match = rawPath.match(/\/google-business\/reviews\/([^/]+)\/reply$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";

    if (!rawPath.includes("/google-business")) {
      return badRequest("Route not found");
    }

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "integrations");

    if (method === "GET" && rawPath.endsWith("/google-business/locations")) {
      const locations = await getTenantGoogleLocations(auth.tenantId);
      return ok({ locations });
    }

    if (method === "GET" && rawPath.endsWith("/google-business/reviews")) {
      const locationId = event.queryStringParameters?.locationId?.trim() ?? "";
      if (!locationId) return badRequest("locationId query parameter is required");
      const pageToken = event.queryStringParameters?.pageToken?.trim();
      const orderBy = event.queryStringParameters?.orderBy?.trim();
      const pageSizeRaw = event.queryStringParameters?.pageSize;
      const pageSize = pageSizeRaw ? Number(pageSizeRaw) : undefined;
      const reviews = await listTenantGoogleReviews(auth.tenantId, ENVIRONMENT, locationId, {
        ...(pageToken ? { pageToken } : {}),
        ...(orderBy ? { orderBy } : {}),
        ...(pageSize && Number.isFinite(pageSize) ? { pageSize } : {}),
      });
      return ok(reviews);
    }

    if (method === "PUT" && rawPath.includes("/google-business/reviews/") && rawPath.endsWith("/reply")) {
      const reviewId = reviewIdFromPath(rawPath);
      if (!reviewId) return badRequest("reviewId is required");
      const body = event.body ? JSON.parse(event.body) : {};
      const parsed = ReplySchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((issue) => issue.message).join("; "));
      }
      const reply = await replyToTenantGoogleReview(
        auth.tenantId,
        ENVIRONMENT,
        parsed.data.locationId,
        reviewId,
        parsed.data.comment
      );
      return ok(reply);
    }

    if (
      method === "DELETE" &&
      rawPath.includes("/google-business/reviews/") &&
      rawPath.endsWith("/reply")
    ) {
      const reviewId = reviewIdFromPath(rawPath);
      const locationId = event.queryStringParameters?.locationId?.trim() ?? "";
      if (!reviewId) return badRequest("reviewId is required");
      if (!locationId) return badRequest("locationId query parameter is required");
      await deleteTenantGoogleReviewReply(auth.tenantId, ENVIRONMENT, locationId, reviewId);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
