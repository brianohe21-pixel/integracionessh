import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { applyMailrelaySuppressionByEmail } from "../../lib/dynamodb/contact.repository.js";
import {
  findTenantIdByMailrelayCampaign,
  findTenantIdByMailrelayEmail,
  incrementMailrelayCampaignMetric,
  recordMailrelayEvent,
} from "../../lib/dynamodb/mailrelay.repository.js";
import { badRequest, handleError, ok, unauthorized } from "../../lib/http.js";
import { getMailrelayCredentials } from "../../lib/mailrelay/secrets.js";
import {
  isMailrelaySuppressionEvent,
  metricForMailrelayEvent,
  parseMailrelayWebhook,
  verifyMailrelayWebhookToken,
} from "../../lib/mailrelay/webhook.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

function headerValue(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const target = name.toLowerCase();
  const entry = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

async function resolveWebhookTenantId(
  pathTenantId: string | undefined,
  payload: unknown
): Promise<string | null> {
  if (pathTenantId) return pathTenantId;
  const parsed = parseMailrelayWebhook("pending", payload);
  if (parsed.email) {
    const tenantId = await findTenantIdByMailrelayEmail(parsed.email);
    if (tenantId) return tenantId;
  }
  if (parsed.campaignId) {
    return findTenantIdByMailrelayCampaign(parsed.campaignId);
  }
  return null;
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    if (method !== "POST") return badRequest("Not found");

    const credentials = await getMailrelayCredentials(ENVIRONMENT);
    if (!credentials) return unauthorized();
    if (
      !verifyMailrelayWebhookToken(
        headerValue(event, "X-Mailrelay-Webhook-Token"),
        credentials.webhookToken
      )
    ) {
      return unauthorized();
    }

    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? "", "base64").toString("utf8")
      : event.body ?? "{}";
    const payload = JSON.parse(body) as unknown;
    const tenantId = await resolveWebhookTenantId(event.pathParameters?.tenantId, payload);
    if (!tenantId) return ok({ received: true, routed: false });

    const mailrelayEvent = parseMailrelayWebhook(tenantId, payload);
    const created = await recordMailrelayEvent(mailrelayEvent);
    if (!created) return ok({ received: true, duplicate: true });

    const operations: Promise<unknown>[] = [];
    const metric = metricForMailrelayEvent(mailrelayEvent.type);
    if (metric && mailrelayEvent.campaignId) {
      operations.push(
        incrementMailrelayCampaignMetric(
          tenantId,
          mailrelayEvent.campaignId,
          metric
        )
      );
    }
    if (mailrelayEvent.email && isMailrelaySuppressionEvent(mailrelayEvent.type)) {
      operations.push(applyMailrelaySuppressionByEmail(tenantId, mailrelayEvent.email));
    }
    await Promise.all(operations);
    return ok({ received: true, duplicate: false, routed: true });
  } catch (error) {
    return handleError(error);
  }
}
