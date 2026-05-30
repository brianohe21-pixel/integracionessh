import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import {
  createTicket,
  listTicketsByUser,
  listAllTickets,
  updateTicketAdmin,
} from "../../lib/dynamodb/ticket.repository.js";
import { ok, created, badRequest, notFound, forbidden, handleError } from "../../lib/http.js";

const CreateTicketSchema = z.object({
  category: z.enum(["general", "technical", "billing", "whatsapp"]),
  subject: z.string().min(5).max(120),
  message: z.string().min(20).max(4000),
});

const AdminPatchSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["open", "closed"]).optional(),
  adminReply: z.string().max(4000).optional(),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";
    const ticketId = event.pathParameters?.ticketId;

    if (path.includes("/admin/support/tickets")) {
      if (auth.role !== "admin") {
        return forbidden("Admin access required");
      }

      if (method === "GET") {
        const tickets = await listAllTickets();
        return ok(tickets);
      }

      if (method === "PATCH" && ticketId) {
        const body = JSON.parse(event.body ?? "{}");
        const parsed = AdminPatchSchema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const patch: { status?: "open" | "closed"; adminReply?: string } = {};
        if (parsed.data.status) patch.status = parsed.data.status;
        if (parsed.data.adminReply !== undefined) patch.adminReply = parsed.data.adminReply;
        const updated = await updateTicketAdmin(parsed.data.tenantId, ticketId, patch);
        if (!updated) return notFound("Ticket not found");
        return ok(updated);
      }

      return badRequest("Route not found");
    }

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
