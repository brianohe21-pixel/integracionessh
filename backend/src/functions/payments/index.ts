import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertCanEnablePayments } from "../../lib/billing/assert-plan.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  createPaymentRequest,
  disablePayments,
  enablePayments,
  getConfigOrDefault,
  getPaymentRequestById,
  isTenantWompiConfigured,
  listPaymentRequests,
  savePaymentsConfig,
} from "../../lib/payments/payments.service.js";
import {
  deleteTenantWompiSecrets,
  getTenantWompiSecrets,
  maskWompiSecrets,
  saveTenantWompiSecrets,
} from "../../lib/payments/wompi-secrets.js";
import { fulfillTenantPayment, declineTenantPayment } from "../../lib/payments/fulfill.js";
import { verifyWompiEvent, type WompiWebhookEvent } from "../../lib/billing/wompi.js";
import {
  ok,
  badRequest,
  created,
  handleError,
  unauthorized,
} from "../../lib/http.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ConfigSchema = z.object({
  defaultAmountInCents: z.number().int().min(1000).optional(),
  paymentMessageTemplate: z.string().max(500).optional(),
  successRedirectUrl: z.string().url().optional(),
});

const CredentialsSchema = z.object({
  publicKey: z.string().min(1).max(200),
  privateKey: z.string().min(1).max(200),
  integritySecret: z.string().min(1).max(200),
  eventsSecret: z.string().min(1).max(200),
});

const CreatePaymentSchema = z.object({
  contactPhone: z.string().min(8).max(20),
  contactName: z.string().max(120).optional(),
  amountInCents: z.number().int().min(1000),
  description: z.string().min(1).max(200),
  customerEmail: z.string().email().optional(),
  sendWhatsApp: z.boolean().optional(),
});

function getRawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return "";
  return event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
}

async function assertBotBelongsToTenant(tenantId: string, botId: string): Promise<void> {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw new Error("Bot not found");
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const tenantIdParam = event.pathParameters?.tenantId;
    const botId = event.pathParameters?.botId;
    const paymentId = event.pathParameters?.paymentId;

    if (method === "POST" && rawPath.match(/\/payments\/wompi\/webhook\/[^/]+$/)) {
      return handleWompiWebhook(event as APIGatewayProxyEventV2, tenantIdParam);
    }

    const auth = extractAuthContext(event as APIGatewayProxyEventV2WithJWTAuthorizer);
    assertMemberRole(auth);

    if (method === "GET" && rawPath === "/payments/wompi/credentials") {
      const secrets = await getTenantWompiSecrets(auth.tenantId, ENVIRONMENT);
      return ok({
        ...maskWompiSecrets(secrets),
        tenantId: auth.tenantId,
      });
    }

    if (method === "PUT" && rawPath === "/payments/wompi/credentials") {
      const body = CredentialsSchema.parse(JSON.parse(event.body ?? "{}"));
      await saveTenantWompiSecrets(auth.tenantId, ENVIRONMENT, body);
      return ok({ saved: true });
    }

    if (method === "DELETE" && rawPath === "/payments/wompi/credentials") {
      await deleteTenantWompiSecrets(auth.tenantId, ENVIRONMENT);
      return ok({ deleted: true });
    }

    if (!botId) {
      return badRequest("botId is required");
    }

    await assertBotBelongsToTenant(auth.tenantId, botId);

    if (method === "GET" && rawPath === `/payments/${botId}/config`) {
      const config = await getConfigOrDefault(auth.tenantId, botId);
      const wompiConfigured = await isTenantWompiConfigured(auth.tenantId, ENVIRONMENT);
      return ok({ config, wompiConfigured });
    }

    if (method === "PUT" && rawPath === `/payments/${botId}/config`) {
      const body = ConfigSchema.parse(JSON.parse(event.body ?? "{}"));
      const patch: Parameters<typeof savePaymentsConfig>[2] = {};
      if (body.defaultAmountInCents !== undefined) {
        patch.defaultAmountInCents = body.defaultAmountInCents;
      }
      if (body.paymentMessageTemplate !== undefined) {
        patch.paymentMessageTemplate = body.paymentMessageTemplate;
      }
      if (body.successRedirectUrl !== undefined) {
        patch.successRedirectUrl = body.successRedirectUrl;
      }
      const config = await savePaymentsConfig(auth.tenantId, botId, patch);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/payments/${botId}/enable`) {
      const tenant = await getTenant(auth.tenantId);
      if (!tenant) throw new Error("Tenant not found");
      await assertCanEnablePayments(tenant, botId);
      const config = await enablePayments(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "POST" && rawPath === `/payments/${botId}/disable`) {
      const config = await disablePayments(auth.tenantId, botId);
      return ok({ config });
    }

    if (method === "GET" && rawPath === `/payments/${botId}/requests`) {
      const status = event.queryStringParameters?.status as
        | "pending"
        | "paid"
        | "declined"
        | "expired"
        | undefined;
      const requests = await listPaymentRequests({
        tenantId: auth.tenantId,
        botId,
        ...(status ? { status } : {}),
      });
      return ok({ requests });
    }

    if (method === "POST" && rawPath === `/payments/${botId}/requests`) {
      const body = CreatePaymentSchema.parse(JSON.parse(event.body ?? "{}"));
      const request = await createPaymentRequest({
        tenantId: auth.tenantId,
        botId,
        amountInCents: body.amountInCents,
        description: body.description,
        contactPhone: body.contactPhone,
        ...(body.contactName ? { contactName: body.contactName } : {}),
        ...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
        source: "manual",
        environment: ENVIRONMENT,
        sendWhatsApp: body.sendWhatsApp ?? true,
      });
      return created({ request });
    }

    if (method === "GET" && paymentId && rawPath === `/payments/${botId}/requests/${paymentId}`) {
      const request = await getPaymentRequestById(auth.tenantId, botId, paymentId);
      if (!request) return badRequest("Payment request not found");
      return ok({ request });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

async function handleWompiWebhook(
  event: APIGatewayProxyEventV2,
  tenantId?: string
): Promise<APIGatewayProxyResultV2> {
  if (!tenantId) return badRequest("tenantId is required");

  const secrets = await getTenantWompiSecrets(tenantId, ENVIRONMENT);
  if (!secrets) return unauthorized("Wompi not configured");

  const rawBody = getRawBody(event);
  let payload: WompiWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as WompiWebhookEvent;
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!verifyWompiEvent({ eventsSecret: secrets.eventsSecret }, payload)) {
    return unauthorized("Invalid signature");
  }

  if (payload.event === "transaction.updated") {
    const transaction = payload.data.transaction as Record<string, unknown> | undefined;
    if (transaction) {
      const reference = String(transaction.reference ?? "");
      const status = String(transaction.status ?? "");
      const transactionId = String(transaction.id ?? "");

      if (status === "APPROVED") {
        await fulfillTenantPayment({
          tenantId,
          reference,
          transactionId,
          environment: ENVIRONMENT,
        });
      } else if (status === "DECLINED" || status === "ERROR" || status === "VOIDED") {
        await declineTenantPayment({
          tenantId,
          reference,
          transactionId,
          environment: ENVIRONMENT,
        });
      }
    }
  }

  return ok({ received: true });
}
