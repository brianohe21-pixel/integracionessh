import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
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
  getFlowRun,
  listFlowDefinitions,
  listFlowRunsByFlow,
  makeFlowId,
  updateFlowDefinition,
} from "../../lib/dynamodb/flow.repository.js";
import {
  deleteFlowHookConfig,
  getFlowHookConfig,
  putFlowHookConfig,
} from "../../lib/dynamodb/flow-hook.repository.js";
import { listFlowEventSubmissions } from "../../lib/dynamodb/flow-event.repository.js";
import { resumeFlowRunById } from "../../lib/flow/interpreter.js";
import { resumeEventFlowRun } from "../../lib/flow/event-runner.js";
import {
  buildFlowHookUrl,
  generateFlowHookKey,
  generateFlowHookSecret,
  hashFlowHookSecret,
} from "../../lib/flow/hook-credentials.js";
import { validateFlowDefinition, validateFlowDefinitionWithSecrets } from "../../lib/flow/validate.js";
import {
  deleteFlowSecret,
  getFlowSecret,
  listFlowSecretNames,
  saveFlowSecret,
} from "../../lib/flow/flow-secrets.repository.js";
import { buildTaxi355SatelitalVoiceFlow } from "../../lib/flow/voice-flow-template.js";
import { isVoiceAiFlow } from "../../lib/flow/voice-flow-compiler.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";
import type { FlowDefinition, FlowEdge, FlowHookConfig, FlowNode, FlowKind } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

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
    "send_catalog",
    "send_products",
    "await_order",
    "save_contact",
    "create_lead",
    "send_notification",
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
  flowKind: z.enum(["messaging", "voice_ai"]).optional(),
  enabled: z.boolean().default(false),
  nodes: z.array(FlowNodeSchema).min(1),
  edges: z.array(FlowEdgeSchema),
  entryNodeId: z.string().optional(),
});

const FlowSecretSchema = z.object({
  name: z.string().min(1).max(120),
  value: z.string().min(1).max(4096),
});

const TaxiTemplateSchema = z.object({
  botId: z.string().uuid(),
});

function resolveEntryNodeId(nodes: FlowNode[]): string {
  const trigger = nodes.find((n) => n.type === "trigger");
  return trigger?.id ?? nodes[0]?.id ?? "";
}

async function ensureFlowHook(
  tenantId: string,
  flow: FlowDefinition
): Promise<{ config: FlowHookConfig; secret?: string }> {
  const existing = await getFlowHookConfig(tenantId, flow.flowId);
  if (existing) {
    return { config: existing };
  }

  const secret = generateFlowHookSecret();
  const now = new Date().toISOString();
  const config: FlowHookConfig = {
    hookKey: generateFlowHookKey(),
    tenantId,
    flowId: flow.flowId,
    botId: flow.botId,
    secretHash: hashFlowHookSecret(secret),
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  await putFlowHookConfig(config);
  return { config, secret };
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | Record<string, unknown>
): Promise<APIGatewayProxyResultV2> {
  const schedulerAction = (event as Record<string, unknown>).action;
  if (schedulerAction === "resume-flow-run") {
    const { runId, tenantId } = event as { runId: string; tenantId: string };
    const run = await getFlowRun(tenantId, runId);
    if (run?.source === "event") {
      await resumeEventFlowRun(tenantId, runId);
    } else {
      await resumeFlowRunById(tenantId, runId);
    }
    return ok({ resumed: true });
  }

  try {
    const apiEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
    const auth = await resolveRequestAuth(apiEvent);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "flows");
    const method = apiEvent.requestContext.http.method;
    const flowId = apiEvent.pathParameters?.flowId;
    const runId = apiEvent.pathParameters?.runId;
    const path = apiEvent.rawPath;

    if (method === "GET" && runId && path.includes("/flow-runs/")) {
      const run = await getFlowRun(auth.tenantId, runId);
      if (!run) return notFound("Flow run not found");
      return ok(run);
    }

    if (method === "GET" && !flowId) {
      const botId = apiEvent.queryStringParameters?.botId;
      const flows = await listFlowDefinitions(auth.tenantId, botId);
      return ok(flows);
    }

    if (method === "GET" && flowId && path.endsWith("/runs")) {
      const runs = await listFlowRunsByFlow(auth.tenantId, flowId);
      return ok(runs);
    }

    if (method === "GET" && flowId && path.endsWith("/events")) {
      const events = await listFlowEventSubmissions(auth.tenantId, flowId);
      return ok(events);
    }

    if (method === "GET" && flowId && path.endsWith("/hook")) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      const hook = await getFlowHookConfig(auth.tenantId, flowId);
      if (!hook) return ok({ configured: false });
      return ok({
        configured: true,
        hookKey: hook.hookKey,
        webhookUrl: buildFlowHookUrl(hook.hookKey),
        enabled: hook.enabled,
        createdAt: hook.createdAt,
        updatedAt: hook.updatedAt,
      });
    }

    if (method === "POST" && flowId && path.endsWith("/hook/rotate")) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      await deleteFlowHookConfig(auth.tenantId, flowId);
      const { config, secret } = await ensureFlowHook(auth.tenantId, flow);
      return ok({
        hookKey: config.hookKey,
        secret,
        webhookUrl: buildFlowHookUrl(config.hookKey),
      });
    }

    if (method === "POST" && !flowId && path.endsWith("/templates/taxi-355-satelital")) {
      const body = TaxiTemplateSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const bot = await getBot(auth.tenantId, body.data.botId);
      if (!bot) return notFound("Bot not found");

      const existingFlows = await listFlowDefinitions(auth.tenantId, body.data.botId);
      const existingVoice = existingFlows.find(
        (item) => isVoiceAiFlow(item) && item.name.includes("355 Satelital")
      );
      if (existingVoice) {
        return ok(existingVoice);
      }

      const now = new Date().toISOString();
      const flow = buildTaxi355SatelitalVoiceFlow({
        flowId: makeFlowId(),
        tenantId: auth.tenantId,
        botId: body.data.botId,
        companyId: "",
        now,
      });
      await createFlowDefinition(flow);
      return created(flow);
    }

    if (method === "GET" && flowId && path.endsWith("/secrets")) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      const names = await listFlowSecretNames(auth.tenantId, ENVIRONMENT, flowId);
      return ok({
        secrets: names.map((name) => ({ name, configured: true })),
      });
    }

    if (method === "PUT" && flowId && path.endsWith("/secrets")) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      const body = FlowSecretSchema.safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);
      await saveFlowSecret(
        auth.tenantId,
        ENVIRONMENT,
        flowId,
        body.data.name,
        body.data.value
      );
      return ok({ name: body.data.name, configured: true });
    }

    if (method === "DELETE" && flowId && apiEvent.pathParameters?.secretName) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      const secretName = apiEvent.pathParameters.secretName;
      const existing = await getFlowSecret(auth.tenantId, ENVIRONMENT, flowId, secretName);
      if (!existing) return notFound("Secret not found");
      await deleteFlowSecret(auth.tenantId, ENVIRONMENT, flowId, secretName);
      return noContent();
    }

    if (method === "POST" && flowId && path.endsWith("/validate")) {
      const flow = await getFlowDefinition(auth.tenantId, flowId);
      if (!flow) return notFound("Flow not found");
      const body = FlowSchema.partial().safeParse(JSON.parse(apiEvent.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);
      const candidate: FlowDefinition = {
        ...flow,
        ...(body.data.nodes ? { nodes: body.data.nodes as FlowNode[] } : {}),
        ...(body.data.edges ? { edges: body.data.edges as FlowEdge[] } : {}),
        entryNodeId:
          body.data.entryNodeId ??
          (body.data.nodes
            ? resolveEntryNodeId(body.data.nodes as FlowNode[])
            : flow.entryNodeId),
      };
      const issues = isVoiceAiFlow(candidate)
        ? await validateFlowDefinitionWithSecrets(candidate, ENVIRONMENT)
        : validateFlowDefinition(candidate);
      return ok({ issues });
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
        ...(body.data.flowKind ? { flowKind: body.data.flowKind as FlowKind } : {}),
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
      const candidate: FlowDefinition = {
        ...existing,
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.flowKind !== undefined ? { flowKind: body.data.flowKind as FlowKind } : {}),
        ...(body.data.enabled !== undefined ? { enabled: body.data.enabled } : {}),
        ...(body.data.nodes ? { nodes, version: existing.version + 1 } : {}),
        ...(body.data.edges ? { edges: body.data.edges as FlowEdge[] } : {}),
        entryNodeId:
          body.data.entryNodeId ??
          (body.data.nodes ? resolveEntryNodeId(nodes) : existing.entryNodeId),
        ...(body.data.enabled ? { publishedAt: new Date().toISOString() } : {}),
      };

      const issues = isVoiceAiFlow(candidate)
        ? await validateFlowDefinitionWithSecrets(candidate, ENVIRONMENT)
        : validateFlowDefinition(candidate);
      const isFormFlow = nodes.some(
        (node) => node.type === "trigger" && node.data.triggerType === "web_form_submitted"
      );
      const isVoiceFlow = isVoiceAiFlow(candidate);
      if ((isFormFlow || isVoiceFlow) && issues.length > 0) {
        return badRequest(issues.map((issue) => issue.message).join("; "));
      }

      const updated = await updateFlowDefinition(auth.tenantId, flowId, candidate);
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/enable")) {
      const tenant = await getTenant(auth.tenantId);
      if (tenant) await assertCanEnableVisualFlow(tenant);
      const existing = await getFlowDefinition(auth.tenantId, flowId);
      if (!existing) return notFound("Flow not found");

      const issues = isVoiceAiFlow(existing)
        ? await validateFlowDefinitionWithSecrets(existing, ENVIRONMENT)
        : validateFlowDefinition(existing);
      const isFormFlow = existing.nodes.some(
        (node) => node.type === "trigger" && node.data.triggerType === "web_form_submitted"
      );
      const isVoiceFlow = isVoiceAiFlow(existing);
      if ((isFormFlow || isVoiceFlow) && issues.length > 0) {
        return badRequest(issues.map((issue) => issue.message).join("; "));
      }

      if (isVoiceFlow) {
        const siblingFlows = await listFlowDefinitions(auth.tenantId, existing.botId);
        const otherEnabled = siblingFlows.find(
          (item) => item.flowId !== existing.flowId && item.enabled && isVoiceAiFlow(item)
        );
        if (otherEnabled) {
          return badRequest("Only one voice flow can be enabled per bot");
        }
      }

      const updated = await updateFlowDefinition(auth.tenantId, flowId, {
        enabled: true,
        publishedAt: new Date().toISOString(),
      });
      if (!updated) return notFound("Flow not found");

      let hookResponse: Record<string, unknown> = {};
      if (isFormFlow) {
        const { config, secret } = await ensureFlowHook(auth.tenantId, updated);
        hookResponse = {
          hook: {
            hookKey: config.hookKey,
            webhookUrl: buildFlowHookUrl(config.hookKey),
            ...(secret ? { secret } : {}),
          },
        };
      }

      return ok({ ...updated, ...hookResponse });
    }

    if (method === "POST" && flowId && path.endsWith("/disable")) {
      const updated = await updateFlowDefinition(auth.tenantId, flowId, { enabled: false });
      if (!updated) return notFound("Flow not found");
      return ok(updated);
    }

    if (method === "DELETE" && flowId) {
      await deleteFlowHookConfig(auth.tenantId, flowId);
      await deleteFlowDefinition(auth.tenantId, flowId);
      return noContent();
    }

    return notFound("Route not found");
  } catch (err) {
    return handleError(err);
  }
}
