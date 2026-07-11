import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import {
  assertCanCreateVisualFlow,
  assertCanEnableVisualFlow,
} from "../../lib/billing/assert-plan.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  createFlowDefinition,
  deleteFlowDefinition,
  getFlowDefinition,
  listFlowDefinitions,
  makeFlowId,
  updateFlowDefinition,
} from "../../lib/dynamodb/flow.repository.js";
import { resumeFlowRunById } from "../../lib/flow/interpreter.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";
import type { FlowDefinition, FlowEdge, FlowNode } from "../../types/index.js";

const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    "trigger",
    "message",
    "template",
    "condition",
    "buttons",
    "meta_flow",
    "handoff",
    "delay",
    "set_variable",
    "http_request",
    "book_appointment",
    "request_payment",
    "end",
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()).default({}),
});

const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().optional(),
});

const FlowSchema = z.object({
  name: z.string().min(1).max(120),
  botId: z.string().uuid(),
  enabled: z.boolean().default(false),
  nodes: z.array(FlowNodeSchema).min(1),
  edges: z.array(FlowEdgeSchema),
  entryNodeId: z.string().optional(),
});

function resolveEntryNodeId(nodes: FlowNode[]): string {
  const trigger = nodes.find((n) => n.type === "trigger");
  return trigger?.id ?? nodes[0]?.id ?? "";
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | Record<string, unknown>
): Promise<APIGatewayProxyResultV2> {
  const schedulerAction = (event as Record<string, unknown>).action;
  if (schedulerAction === "resume-flow-run") {
    const { runId, tenantId } = event as { runId: string; tenantId: string };
    await resumeFlowRunById(tenantId, runId);
    return ok({ resumed: true });
  }

  try {
    const apiEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
    const auth = extractAuthContext(apiEvent);
    assertMemberRole(auth);
    const method = apiEvent.requestContext.http.method;
    const flowId = apiEvent.pathParameters?.flowId;
    const path = apiEvent.rawPath;

    if (method === "GET" && !flowId) {
      const botId = apiEvent.queryStringParameters?.botId;
      const flows = await listFlowDefinitions(auth.tenantId, botId);
      return ok(flows);
    }

    if (method === "GET" && flowId) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      return ok(flow);
    }

    if (method === "POST" && !flowId) {
      const body = FlowSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const bot = await getBot(auth.tenantId, body.data.botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        await assertCanCreateVisualFlow(tenant, body.data.botId, body.data.nodes.length);
        if (body.data.enabled) {
          await assertCanEnableVisualFlow(tenant);
        }
      }

      const nodes = body.data.nodes as FlowNode[];
      const edges = body.data.edges as FlowEdge[];
      const now = new Date().toISOString();
      const flow: FlowDefinition = {
        flowId: makeFlowId(),
        tenantId: auth.tenantId,
        botId: body.data.botId,
        name: body.data.name,
        enabled: body.data.enabled,
        version: 1,
        nodes,
        edges,
        entryNodeId: body.data.entryNodeId ?? resolveEntryNodeId(nodes),
        createdAt: now,
        updatedAt: now,
      };
      await createFlowDefinition(flow);
      return created(flow);
    }

    if (method === "PUT" && flowId) {
      const existing = await getFlowDefinition(auth.tenantId, flowId);
      if (!existing) return notFound("Flow not found");

      const body = FlowSchema.partial().safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const tenant = await getTenant(auth.tenantId);
      if (tenant && body.data.nodes) {
        await assertCanCreateVisualFlow(tenant, existing.botId, body.data.nodes.length);
      }

      const nodes = (body.data.nodes ?? existing.nodes) as FlowNode[];
      const updated = await updateFlowDefinition(auth.tenantId, flowId, {
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.enabled !== undefined ? { enabled: body.data.enabled } : {}),
        ...(body.data.nodes ? { nodes, version: existing.version + 1 } : {}),
        ...(body.data.edges ? { edges: body.data.edges as FlowEdge[] } : {}),
        entryNodeId:
          body.data.entryNodeId ??
          (body.data.nodes ? resolveEntryNodeId(nodes) : existing.entryNodeId),
        ...(body.data.enabled ? { publishedAt: new Date().toISOString() } : {}),
      });
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/enable")) {
      const tenant = await getTenant(auth.tenantId);
      if (tenant) await assertCanEnableVisualFlow(tenant);
      const updated = await updateFlowDefinition(auth.tenantId, flowId, {
        enabled: true,
        publishedAt: new Date().toISOString(),
      });
      if (!updated) return notFound("Flow not found");
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/disable")) {
      const updated = await updateFlowDefinition(auth.tenantId, flowId, { enabled: false });
      if (!updated) return notFound("Flow not found");
      return ok(updated);
    }

    if (method === "DELETE" && flowId) {
      await deleteFlowDefinition(auth.tenantId, flowId);
      return noContent();
    }

    return notFound("Route not found");
  } catch (err) {
    return handleError(err);
  }
}
