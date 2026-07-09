import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import {
  deleteLead,
  getLeadById,
  listLeads,
  updateLead,
} from "../../lib/dynamodb/lead.repository.js";
import {
  convertLeadToContact,
  markLeadAsLost,
} from "../../lib/leads/convert.js";
import {
  extractAuthContext,
  assertMemberRole,
  assertTenantManagerRole,
} from "../../lib/auth/cognito.js";
import {
  ok,
  badRequest,
  notFound,
  noContent,
  handleError,
} from "../../lib/http.js";
import type { LeadStatus, MarketingConsent } from "../../types/index.js";

const LeadStatusSchema = z.enum(["new", "contacted", "qualified", "converted", "lost"]);

const UpdateLeadSchema = z.object({
  status: LeadStatusSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  assignedAdvisorId: z.string().uuid().optional().nullable(),
  name: z.string().max(128).optional(),
  email: z.string().email().max(256).optional(),
});

const ConvertLeadSchema = z.object({
  marketingConsent: z.enum(["unknown", "opt_in", "opt_out"]).optional(),
});

function parseSubPath(rawPath: string, leadId: string): string | null {
  const suffix = rawPath.split(`/leads/${leadId}`)[1] ?? "";
  if (!suffix || suffix === "") return null;
  return suffix.replace(/^\//, "").split("/")[0] ?? null;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const leadId = event.pathParameters?.leadId;
    const params = event.queryStringParameters ?? {};

    if (method === "GET" && !leadId) {
      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit (1-100)");
      }

      const status = params.status as LeadStatus | undefined;
      if (status && !LeadStatusSchema.safeParse(status).success) {
        return badRequest("Invalid status filter");
      }

      const listOpts: Parameters<typeof listLeads>[1] = { limit };
      if (params.cursor) listOpts.cursor = params.cursor;
      if (status) listOpts.status = status;
      if (params.botId) listOpts.botId = params.botId;
      if (params.metaFlowId) listOpts.metaFlowId = params.metaFlowId;
      if (params.q) listOpts.q = params.q;

      const result = await listLeads(auth.tenantId, listOpts);
      return ok(result);
    }

    if (method === "GET" && leadId) {
      const lead = await getLeadById(auth.tenantId, leadId);
      if (!lead) return notFound("Lead not found");
      return ok(lead);
    }

    if (method === "PATCH" && leadId) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateLeadSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const existing = await getLeadById(auth.tenantId, leadId);
      if (!existing) return notFound("Lead not found");
      if (existing.status === "converted" || existing.status === "lost") {
        return badRequest("Cannot update a closed lead");
      }

      const patch: Parameters<typeof updateLead>[2] = {};
      if (parsed.data.status !== undefined) patch.status = parsed.data.status;
      if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
      if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
      if (parsed.data.name !== undefined) patch.name = parsed.data.name;
      if (parsed.data.email !== undefined) patch.email = parsed.data.email;
      if (parsed.data.assignedAdvisorId !== undefined) {
        patch.assignedAdvisorId = parsed.data.assignedAdvisorId;
      }

      const updated = await updateLead(auth.tenantId, leadId, patch);
      if (!updated) return notFound("Lead not found");
      return ok(updated);
    }

    if (method === "POST" && leadId) {
      const sub = parseSubPath(rawPath, leadId);
      const existing = await getLeadById(auth.tenantId, leadId);
      if (!existing) return notFound("Lead not found");

      if (sub === "convert") {
        if (existing.status === "converted") return badRequest("Lead already converted");
        if (existing.status === "lost") return badRequest("Lead is marked as lost");

        const body = JSON.parse(event.body ?? "{}");
        const parsed = ConvertLeadSchema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const result = await convertLeadToContact({
          tenantId: auth.tenantId,
          leadId,
          ...(parsed.data.marketingConsent
            ? { marketingConsent: parsed.data.marketingConsent as MarketingConsent }
            : {}),
        });
        if (!result) return notFound("Lead not found");
        return ok(result);
      }

      if (sub === "lose") {
        if (existing.status === "converted") return badRequest("Lead already converted");
        const updated = await markLeadAsLost(auth.tenantId, leadId);
        if (!updated) return notFound("Lead not found");
        return ok(updated);
      }

      return badRequest("Route not found");
    }

    if (method === "DELETE" && leadId) {
      assertTenantManagerRole(auth);
      const deleted = await deleteLead(auth.tenantId, leadId);
      if (!deleted) return notFound("Lead not found");
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
