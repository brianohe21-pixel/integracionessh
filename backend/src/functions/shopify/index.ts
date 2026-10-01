import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { z } from "zod";
import { assertMemberRole, resolveRequestAuth } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { writeAuditEvent } from "../../lib/audit/write-audit-event.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  claimShopifyWebhookEvent,
  findTenantIdByShopDomain,
} from "../../lib/dynamodb/shopify.repository.js";
import { verifyWebhookHmac } from "../../lib/shopify/client.js";
import {
  disconnectShopify,
  getShopifyConnectionView,
  handleShopifyOAuthCallback,
  listShopifyDeliveryHistory,
  startShopifyOAuth,
  updateShopifySettings,
} from "../../lib/shopify/service.js";
import {
  badRequest,
  handleError,
  ok,
  parseJsonBody,
  redirect,
  unauthorized,
} from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const QUEUE_URL = process.env.SHOPIFY_EVENTS_QUEUE_URL ?? "";
const sqs = new SQSClient({});

const StartOAuthSchema = z.object({
  shop: z.string().min(3).max(255),
});

const TemplateSchema = z.object({
  templateName: z.string().min(1).max(128),
  templateLanguage: z.string().min(2).max(16),
  variableKeys: z.array(z.string().min(1).max(64)).max(20),
});

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  botId: z.string().min(1).max(128).optional(),
  abandonDelayMinutes: z.number().int().min(5).max(1440).optional(),
  defaultCountry: z.string().min(2).max(2).optional(),
  templates: z
    .object({
      abandoned_checkout: TemplateSchema.optional(),
      order_paid: TemplateSchema.optional(),
      order_cancelled: TemplateSchema.optional(),
      fulfillment_shipped: TemplateSchema.optional(),
    })
    .optional(),
});

function headerValue(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

function rawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

async function handlePublicRoutes(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2 | null> {
  const method = event.requestContext.http.method;
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";

  if (method === "GET" && rawPath.includes("/public/integrations/shopify/oauth/callback")) {
    const query = event.queryStringParameters ?? {};
    const redirectUrl = await handleShopifyOAuthCallback(query, ENVIRONMENT);
    return redirect(redirectUrl);
  }

  if (method === "POST" && rawPath.includes("/public/integrations/shopify/webhook")) {
    const body = rawBody(event);
    const hmac = headerValue(event, "X-Shopify-Hmac-Sha256");
    if (!verifyWebhookHmac(body, hmac)) {
      return unauthorized("Invalid Shopify webhook signature");
    }

    const topic = headerValue(event, "X-Shopify-Topic") ?? "";
    const shopDomain = (headerValue(event, "X-Shopify-Shop-Domain") ?? "").toLowerCase();
    const webhookId = headerValue(event, "X-Shopify-Webhook-Id") ?? "";
    if (!topic || !shopDomain || !webhookId) {
      return ok({ received: true, ignored: true });
    }

    const tenantId = await findTenantIdByShopDomain(shopDomain);
    if (!tenantId) {
      return ok({ received: true, routed: false });
    }

    const claimed = await claimShopifyWebhookEvent(tenantId, webhookId, topic);
    if (!claimed) {
      return ok({ received: true, duplicate: true });
    }

    if (!QUEUE_URL) {
      console.error("SHOPIFY_EVENTS_QUEUE_URL is not configured");
      return ok({ received: true, queued: false });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return ok({ received: true, invalid_json: true });
    }

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify({
          type: "webhook",
          tenantId,
          shopDomain,
          topic,
          webhookId,
          payload,
        }),
        MessageGroupId: tenantId,
        MessageDeduplicationId: webhookId,
      })
    );

    return ok({ received: true, queued: true });
  }

  return null;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const publicResponse = await handlePublicRoutes(event);
    if (publicResponse) return publicResponse;

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
    if (!rawPath.includes("/shopify")) {
      return badRequest("Route not found");
    }

    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "integrations");
    await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && rawPath.endsWith("/shopify/connection")) {
      const view = await getShopifyConnectionView(auth.tenantId, ENVIRONMENT);
      return ok(view);
    }

    if (method === "POST" && rawPath.endsWith("/shopify/oauth/start")) {
      const body = parseJsonBody(event);
      const parsed = StartOAuthSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const result = await startShopifyOAuth(auth.tenantId, parsed.data.shop);
      return ok(result);
    }

    if (method === "PATCH" && rawPath.endsWith("/shopify/connection")) {
      const body = parseJsonBody(event);
      const parsed = PatchSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(parsed.error.issues.map((i) => i.message).join("; "));
      }
      const templates = parsed.data.templates
        ? (Object.fromEntries(
            Object.entries(parsed.data.templates).filter(([, value]) => value !== undefined)
          ) as Partial<
            Record<
              "abandoned_checkout" | "order_paid" | "order_cancelled" | "fulfillment_shipped",
              { templateName: string; templateLanguage: string; variableKeys: string[] }
            >
          >)
        : undefined;
      const view = await updateShopifySettings(auth.tenantId, ENVIRONMENT, {
        ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}),
        ...(parsed.data.botId !== undefined ? { botId: parsed.data.botId } : {}),
        ...(parsed.data.abandonDelayMinutes !== undefined
          ? { abandonDelayMinutes: parsed.data.abandonDelayMinutes }
          : {}),
        ...(parsed.data.defaultCountry !== undefined
          ? { defaultCountry: parsed.data.defaultCountry }
          : {}),
        ...(templates ? { templates } : {}),
      });
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "update",
        entityType: "shopify",
        entityId: auth.tenantId,
        summary: "Updated Shopify notification settings",
      });
      return ok(view);
    }

    if (method === "DELETE" && rawPath.endsWith("/shopify/connection")) {
      const view = await disconnectShopify(auth.tenantId, ENVIRONMENT);
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "delete",
        entityType: "shopify",
        entityId: auth.tenantId,
        summary: "Disconnected Shopify",
      });
      return ok(view);
    }

    if (method === "GET" && rawPath.endsWith("/shopify/deliveries")) {
      const deliveries = await listShopifyDeliveryHistory(auth.tenantId);
      return ok({ deliveries });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
