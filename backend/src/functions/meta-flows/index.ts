import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertCanCreateMetaFlow } from "../../lib/billing/assert-plan.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  deleteMetaFlow,
  getMetaFlow,
  listFlowResponses,
  listMetaFlows,
  mapMetaStatusToLocal,
  upsertMetaFlow,
} from "../../lib/dynamodb/meta-flow.repository.js";
import { META_FLOW_TEMPLATES } from "../../lib/meta-flow/templates.js";
import { validateMetaFlowJson, formatMetaValidationErrors } from "../../lib/meta-flow/validate.js";
import {
  createMetaFlow,
  deprecateMetaFlow,
  getMetaFlow as getMetaFlowApi,
  getMetaFlowWithValidation,
  listMetaFlows as listMetaFlowsApi,
  publishMetaFlow,
  sendFlowMessage,
  uploadFlowJson,
} from "../../lib/whatsapp/flows.js";
import { getWhatsAppAccessToken } from "../../lib/whatsapp/client.js";
import { ok, created, badRequest, notFound, noContent, handleError } from "../../lib/http.js";
import type { MetaFlow } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  categories: z.array(z.string()).min(1).max(5).default(["OTHER"]),
  jsonDefinition: z.record(z.unknown()).optional(),
  template: z.enum(["lead_capture", "feedback"]).optional(),
});

const UpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  jsonDefinition: z.record(z.unknown()),
});

const TestSendSchema = z.object({
  to: z.string().min(10).max(20),
  flowCta: z.string().min(1).max(60).optional(),
});

function resolveJsonDefinition(body: z.infer<typeof CreateSchema>): Record<string, unknown> {
  if (body.template && META_FLOW_TEMPLATES[body.template]) {
    return META_FLOW_TEMPLATES[body.template];
  }
  if (body.jsonDefinition) {
    return validateMetaFlowJson(body.jsonDefinition);
  }
  return validateMetaFlowJson(META_FLOW_TEMPLATES.lead_capture);
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const botId = event.pathParameters?.botId;
    const flowId = event.pathParameters?.flowId;

    if (!botId) return badRequest("botId required");

    const bot = await getBot(auth.tenantId, botId);
    if (!bot) return notFound("Bot not found");

    const accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
    const wabaId = bot.whatsappBusinessAccountId;

    if (method === "GET" && path.endsWith("/responses")) {
      const responses = await listFlowResponses(auth.tenantId, botId);
      return ok(responses);
    }

    if (method === "GET" && !flowId) {
      const sync = event.queryStringParameters?.sync === "true";
      if (sync) {
        const remote = await listMetaFlowsApi(wabaId, accessToken);
        for (const remoteFlow of remote) {
          const existing = await getMetaFlow(auth.tenantId, botId, remoteFlow.id);
          const status = mapMetaStatusToLocal(remoteFlow.status);
          await upsertMetaFlow({
            metaFlowId: remoteFlow.id,
            tenantId: auth.tenantId,
            botId,
            name: remoteFlow.name,
            status,
            categories: remoteFlow.categories ?? ["OTHER"],
            jsonDefinition: existing?.jsonDefinition ?? {},
            metaStatus: remoteFlow.status,
            createdAt: existing?.createdAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...(status === "PUBLISHED"
              ? { publishedAt: new Date().toISOString() }
              : existing?.publishedAt
                ? { publishedAt: existing.publishedAt }
                : {}),
          });
        }
      }
      const flows = await listMetaFlows(auth.tenantId, botId);
      return ok(flows);
    }

    if (method === "GET" && flowId) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");
      return ok(flow);
    }

    if (method === "POST" && !flowId) {
      const body = CreateSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const tenant = await getTenant(auth.tenantId);
      if (tenant) await assertCanCreateMetaFlow(tenant, botId);

      const jsonDefinition = resolveJsonDefinition(body.data);
      const createdRemote = await createMetaFlow(
        wabaId,
        body.data.name,
        body.data.categories,
        accessToken
      );
      await uploadFlowJson(createdRemote.id, jsonDefinition, accessToken);

      const now = new Date().toISOString();
      const flow: MetaFlow = {
        metaFlowId: createdRemote.id,
        tenantId: auth.tenantId,
        botId,
        name: body.data.name,
        status: "DRAFT",
        categories: body.data.categories,
        jsonDefinition,
        metaStatus: "DRAFT",
        createdAt: now,
        updatedAt: now,
      };
      await upsertMetaFlow(flow);
      return created(flow);
    }

    if (method === "PUT" && flowId) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");

      const body = UpdateSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const jsonDefinition = validateMetaFlowJson(body.data.jsonDefinition);
      if (flow.status === "DRAFT") {
        await uploadFlowJson(flowId, jsonDefinition, accessToken);
      }

      const updated: MetaFlow = {
        ...flow,
        ...(body.data.name ? { name: body.data.name } : {}),
        jsonDefinition,
        updatedAt: new Date().toISOString(),
      };
      await upsertMetaFlow(updated);
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/publish")) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");

      const jsonDefinition = validateMetaFlowJson(flow.jsonDefinition);
      await uploadFlowJson(flowId, jsonDefinition, accessToken);

      const prePublish = await getMetaFlowWithValidation(flowId, accessToken);
      const validationErrors = prePublish.validation_errors;
      if (Array.isArray(validationErrors) && validationErrors.length > 0) {
        return badRequest(
          formatMetaValidationErrors(
            validationErrors as Array<{ message?: string; path?: string; error?: string }>
          )
        );
      }

      await publishMetaFlow(flowId, accessToken);
      const remote = await getMetaFlowApi(flowId, accessToken);
      const status = mapMetaStatusToLocal(String(remote.status ?? "PUBLISHED"));

      const updated: MetaFlow = {
        ...flow,
        status,
        metaStatus: String(remote.status ?? "PUBLISHED"),
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await upsertMetaFlow(updated);
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/deprecate")) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");

      await deprecateMetaFlow(flowId, accessToken);
      const updated: MetaFlow = {
        ...flow,
        status: "DEPRECATED",
        metaStatus: "DEPRECATED",
        updatedAt: new Date().toISOString(),
      };
      await upsertMetaFlow(updated);
      return ok(updated);
    }

    if (method === "POST" && flowId && path.endsWith("/test-send")) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");
      if (flow.status !== "PUBLISHED") {
        return badRequest("Flow must be published before sending");
      }

      const body = TestSendSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!body.success) return badRequest(body.error.message);

      const flowToken = randomUUID();
      await sendFlowMessage({
        phoneNumberId: bot.phoneNumberId,
        to: body.data.to.replace(/\D/g, ""),
        accessToken,
        flowId,
        flowCta: body.data.flowCta ?? "Open",
        flowToken,
      });
      return ok({ sent: true, flowToken });
    }

    if (method === "DELETE" && flowId) {
      const flow = await getMetaFlow(auth.tenantId, botId, flowId);
      if (!flow) return notFound("Flow not found");

      if (flow.status === "PUBLISHED") {
        await deprecateMetaFlow(flowId, accessToken).catch(() => {});
      }
      await deleteMetaFlow(auth.tenantId, botId, flowId);
      return noContent();
    }

    return notFound("Route not found");
  } catch (err) {
    return handleError(err);
  }
}
