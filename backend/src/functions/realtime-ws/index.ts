import type { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { assertTenantMemberEnabled, resolveAssumedTenant } from "../../lib/auth/cognito.js";
import { verifyCognitoToken } from "../../lib/auth/verify-jwt.js";
import { getAdvisorByCognitoUserId } from "../../lib/dynamodb/advisor.repository.js";
import {
  deleteRealtimeConnectionById,
  saveRealtimeConnection,
} from "../../lib/realtime/connections.repository.js";

type ConnectEvent = Parameters<APIGatewayProxyWebsocketHandlerV2>[0] & {
  queryStringParameters?: Record<string, string | undefined>;
};

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId;

  if (routeKey === "$connect") {
    const token = (event as ConnectEvent).queryStringParameters?.token?.trim();
    if (!token) {
      return { statusCode: 401, body: "Missing token" };
    }

    try {
      const homeAuth = await verifyCognitoToken(token);
      if (homeAuth.role === "admin") {
        return { statusCode: 403, body: "Admin cannot connect to tenant realtime" };
      }
      if (!homeAuth.tenantId) {
        return { statusCode: 401, body: "Missing tenant" };
      }
      if (homeAuth.role !== "member" && homeAuth.role !== "advisor") {
        return { statusCode: 403, body: "Access denied" };
      }

      const requestedTenantId =
        (event as ConnectEvent).queryStringParameters?.tenantId?.trim() ?? "";
      const auth = await resolveAssumedTenant(homeAuth, requestedTenantId);
      await assertTenantMemberEnabled(auth);

      let advisorId: string | undefined;
      if (auth.role === "advisor") {
        const advisor = await getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
        if (!advisor) {
          return { statusCode: 403, body: "Advisor profile not found" };
        }
        advisorId = advisor.advisorId;
      }

      await saveRealtimeConnection({
        tenantId: auth.tenantId,
        connectionId,
        userId: auth.userId,
        role: auth.role,
        ...(advisorId ? { advisorId } : {}),
      });

      return { statusCode: 200, body: "Connected" };
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 403) {
        return { statusCode: 403, body: (error as Error).message || "Access denied" };
      }
      return { statusCode: 401, body: "Unauthorized" };
    }
  }

  if (routeKey === "$disconnect") {
    await deleteRealtimeConnectionById(connectionId).catch(() => undefined);
    return { statusCode: 200, body: "Disconnected" };
  }

  if (routeKey === "$default") {
    if (event.body === "ping") {
      return { statusCode: 200, body: "pong" };
    }
  }

  return { statusCode: 200, body: "OK" };
};
