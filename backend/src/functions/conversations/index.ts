import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import {
  listConversations,
  getConversationMessages,
} from "../../lib/dynamodb/conversation.repository.js";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const conversationId = event.pathParameters?.conversationId;
    const params = event.queryStringParameters ?? {};

    if (method === "GET" && !conversationId) {
      const botId = params.botId;
      const limit = params.limit ? parseInt(params.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const conversations = await listConversations(auth.tenantId, botId, limit);
      return ok(conversations);
    }

    if (method === "GET" && conversationId) {
      const limit = params.limit ? parseInt(params.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const messages = await getConversationMessages(auth.tenantId, conversationId, limit);
      return ok(messages);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
