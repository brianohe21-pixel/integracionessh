import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { createTicket, listTicketsByUser } from "../../lib/dynamodb/ticket.repository.js";
import { ok, created, badRequest, handleError } from "../../lib/http.js";

const CreateTicketSchema = z.object({
  category: z.enum(["general", "technical", "billing", "whatsapp"]),
  subject: z.string().min(5).max(120),
  message: z.string().min(20).max(4000),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;

    if (method === "GET") {
      const tickets = await listTicketsByUser(auth.tenantId, auth.userId);
      return ok(tickets);
    }

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateTicketSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const ticket = await createTicket({
        ...parsed.data,
        tenantId: auth.tenantId,
        createdBy: auth.userId,
        email: auth.email,
      });

      return created(ticket);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
