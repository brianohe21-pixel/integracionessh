import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import {
  getTenantIntegration,
  listIntegrationDeliveries,
  maskIntegrationSecret,
  upsertTenantIntegration,
} from "../../lib/dynamodb/integration.repository.js";
import { deliverIntegrationEvent } from "../../lib/integrations/deliver.js";
import { buildTestPayload } from "../../lib/integrations/payloads.js";
import { assertSafeUrl } from "../../lib/webhook/client.js";
import { ok, badRequest, handleError } from "../../lib/http.js";
import type { IntegrationEvent, TenantIntegration } from "../../types/index.js";

const UpdateWebhookSchema = z.object({
  webhookUrl: z.string().url().max(2048),
  webhookSecret: z.string().max(256).optional(),
  subscribedEvents: z
    .array(z.enum(["message.received", "conversation.handoff", "message.sent"]))
    .min(1),
  enabled: z.boolean(),
});

const DEFAULT_INTEGRATION: TenantIntegration = {
  integrationId: "default",
  tenantId: "",
  webhookUrl: "",
  subscribedEvents: ["message.received"],
  enabled: false,
  createdAt: "",
  updatedAt: "",
};

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);

    const method = event.requestContext.http.method;
    const path = event.rawPath ?? "";

    if (method === "GET" && path.endsWith("/integrations/webhook")) {
      const integration = await getTenantIntegration(auth.tenantId);
      if (!integration) {
        return ok({ ...DEFAULT_INTEGRATION, tenantId: auth.tenantId });
      }
      return ok(maskIntegrationSecret(integration));
    }

    if (method === "PUT" && path.endsWith("/integrations/webhook")) {
      const body = UpdateWebhookSchema.parse(JSON.parse(event.body ?? "{}"));
      await assertSafeUrl(body.webhookUrl);

      const integration = await upsertTenantIntegration(auth.tenantId, {
        webhookUrl: body.webhookUrl,
        subscribedEvents: body.subscribedEvents as IntegrationEvent[],
        enabled: body.enabled,
        ...(body.webhookSecret !== undefined ? { webhookSecret: body.webhookSecret } : {}),
      });

      return ok(maskIntegrationSecret(integration));
    }

    if (method === "POST" && path.endsWith("/integrations/webhook/test")) {
      const integration = await getTenantIntegration(auth.tenantId);
      if (!integration?.enabled || !integration.webhookUrl) {
        return badRequest("Integration webhook is not configured or disabled");
      }

      const payload = buildTestPayload(auth.tenantId);
      await deliverIntegrationEvent(integration, payload);
      return ok({ success: true, payload });
    }

    if (method === "GET" && path.endsWith("/integrations/deliveries")) {
      const limit = Math.min(
        parseInt(event.queryStringParameters?.limit ?? "50", 10) || 50,
        100
      );
      const deliveries = await listIntegrationDeliveries(auth.tenantId, limit);
      return ok({ deliveries });
    }

    return badRequest("Not found");
  } catch (error) {
    return handleError(error);
  }
}
