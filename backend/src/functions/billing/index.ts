import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import Stripe from "stripe";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant, updateTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  createPaymentIntent,
  getPaymentByReference,
  updatePaymentIntent,
} from "../../lib/dynamodb/payment.repository.js";
import { activateTenantPlan } from "../../lib/billing/activate-plan.js";
import { getPlanLimits } from "../../lib/billing/plan-limits.js";
import { getMonthlyUsage } from "../../lib/dynamodb/usage.repository.js";
import {
  getStripe,
  getStripeWebhookSecret,
  priceIdForPlan,
  planFromPriceId,
  FRONTEND_URL as STRIPE_FRONTEND_URL,
} from "../../lib/billing/stripe.js";
import {
  isWompiConfigured,
  amountInCentsForPlan,
  buildCheckoutUrl,
  buildPaymentReference,
  parsePaymentReference,
  verifyWompiEvent,
  fetchWompiTransaction,
  FRONTEND_URL as WOMPI_FRONTEND_URL,
  type WompiWebhookEvent,
} from "../../lib/billing/wompi.js";
import {
  ok,
  badRequest,
  handleError,
  unauthorized,
} from "../../lib/http.js";
import type { SubscriptionStatus, TenantPlan } from "../../types/index.js";

const CheckoutSchema = z.object({
  plan: z.enum(["pro", "enterprise"]),
  provider: z.enum(["wompi", "stripe"]).optional(),
});

const WompiConfirmSchema = z.object({
  id: z.string().min(1),
  reference: z.string().min(1).optional(),
});

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function resolveBillingProvider(
  requested?: "wompi" | "stripe"
): "wompi" | "stripe" | null {
  const wompi = isWompiConfigured();
  const stripe = isStripeConfigured();

  if (requested === "wompi") return wompi ? "wompi" : null;
  if (requested === "stripe") return stripe ? "stripe" : null;
  if (wompi) return "wompi";
  if (stripe) return "stripe";
  return null;
}

function getRawBody(event: APIGatewayProxyEventV2): string {
  if (!event.body) return "";
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return event.body;
}

function subscriptionStatusFromStripe(
  status: Stripe.Subscription.Status
): SubscriptionStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "none";
  }
}

async function syncSubscriptionToTenant(
  tenantId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const priceId = subscription.items.data[0]?.price?.id ?? "";
  const plan = planFromPriceId(priceId) ?? "pro";
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : undefined;

  const patch: Parameters<typeof updateTenant>[1] = {
    plan,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscriptionStatus: subscriptionStatusFromStripe(subscription.status),
    paymentProvider: "stripe",
  };
  if (periodEnd) patch.currentPeriodEnd = periodEnd;
  await updateTenant(tenantId, patch);
}

async function handleWompiCheckout(
  tenantId: string,
  email: string,
  plan: "pro" | "enterprise"
) {
  const amountInCents = amountInCentsForPlan(plan);
  const reference = buildPaymentReference(tenantId, plan);

  await createPaymentIntent({
    reference,
    tenantId,
    plan,
    amountInCents,
  });

  const redirectUrl = `${WOMPI_FRONTEND_URL}/settings?billing=success&reference=${encodeURIComponent(reference)}`;
  const url = buildCheckoutUrl({
    reference,
    amountInCents,
    redirectUrl,
    customerEmail: email,
  });

  return ok({ url, reference, provider: "wompi" });
}

async function handleStripeCheckout(
  tenant: Awaited<ReturnType<typeof ensureTenant>>,
  plan: "pro" | "enterprise"
) {
  const stripe = getStripe();
  let customerId = tenant.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: tenant.email,
      name: tenant.name,
      metadata: { tenantId: tenant.tenantId },
    });
    customerId = customer.id;
    await updateTenant(tenant.tenantId, { stripeCustomerId: customerId });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    success_url: `${STRIPE_FRONTEND_URL}/settings?billing=success`,
    cancel_url: `${STRIPE_FRONTEND_URL}/settings?billing=cancel`,
    metadata: { tenantId: tenant.tenantId, plan },
    subscription_data: {
      metadata: { tenantId: tenant.tenantId, plan },
    },
  });

  return ok({ url: session.url, provider: "stripe" });
}

async function fulfillWompiPayment(
  tenantId: string,
  reference: string,
  transactionId?: string
): Promise<boolean> {
  const parsed = parsePaymentReference(reference);
  if (!parsed || parsed.tenantId !== tenantId) return false;

  const payment = await getPaymentByReference(tenantId, reference);
  if (!payment) return false;
  if (payment.status === "approved") return true;

  if (transactionId) {
    const tx = await fetchWompiTransaction(transactionId);
    if (!tx || tx.reference !== reference) return false;
    if (tx.status !== "APPROVED") {
      await updatePaymentIntent(tenantId, reference, {
        status: tx.status === "DECLINED" || tx.status === "ERROR" ? "declined" : "pending",
        wompiTransactionId: transactionId,
      });
      return false;
    }
  }

  await updatePaymentIntent(tenantId, reference, {
    status: "approved",
    ...(transactionId ? { wompiTransactionId: transactionId } : {}),
  });
  await activateTenantPlan(tenantId, parsed.plan);
  return true;
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath ?? event.requestContext.http.path;

    if (method === "POST" && path.endsWith("/billing/wompi/webhook")) {
      return handleWompiWebhook(event as APIGatewayProxyEventV2);
    }

    if (method === "POST" && path.endsWith("/billing/webhook")) {
      return handleStripeWebhook(event as APIGatewayProxyEventV2);
    }

    const auth = extractAuthContext(
      event as APIGatewayProxyEventV2WithJWTAuthorizer
    );
    assertMemberRole(auth);
    const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && path.endsWith("/billing/usage")) {
      const usage = await getMonthlyUsage(tenant.tenantId);
      const plan = tenant.plan ?? "free";
      const limits = getPlanLimits(plan);
      return ok({
        usage,
        limits,
        plan,
        subscription: tenant.subscriptionStatus ?? "none",
        paymentProvider: tenant.paymentProvider ?? (isWompiConfigured() ? "wompi" : "stripe"),
      });
    }

    if (method === "GET" && path.endsWith("/billing/providers")) {
      const wompi = isWompiConfigured();
      const stripe = isStripeConfigured();
      const defaultProvider = wompi ? "wompi" : stripe ? "stripe" : null;
      return ok({
        wompi,
        stripe,
        default: defaultProvider,
        plans: {
          pro: {
            amountCents: amountInCentsForPlan("pro"),
            currency: "COP",
            periodDays: 30,
          },
          enterprise: {
            amountCents: amountInCentsForPlan("enterprise"),
            currency: "COP",
            periodDays: 30,
          },
        },
      });
    }

    if (method === "POST" && path.endsWith("/billing/wompi/confirm")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = WompiConfirmSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const reference =
        parsed.data.reference ??
        event.queryStringParameters?.reference ??
        "";
      if (!reference) return badRequest("reference is required");

      const success = await fulfillWompiPayment(
        auth.tenantId,
        reference,
        parsed.data.id
      );
      if (!success) return badRequest("Payment not approved");
      return ok({ activated: true });
    }

    if (method === "POST" && path.endsWith("/billing/checkout")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CheckoutSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const provider = resolveBillingProvider(parsed.data.provider);
      if (!provider) {
        return badRequest(
          "No payment provider configured. Deploy billing env vars (Wompi or Stripe) via Terraform."
        );
      }

      if (provider === "wompi") {
        return handleWompiCheckout(auth.tenantId, auth.email, parsed.data.plan);
      }

      return handleStripeCheckout(tenant, parsed.data.plan);
    }

    if (method === "POST" && path.endsWith("/billing/portal")) {
      if (!tenant.stripeCustomerId) {
        return badRequest("No Stripe billing account found");
      }
      const stripe = getStripe();
      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: `${STRIPE_FRONTEND_URL}/settings`,
      });
      return ok({ url: session.url });
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}

async function handleWompiWebhook(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const rawBody = getRawBody(event);
  let payload: WompiWebhookEvent;

  try {
    payload = JSON.parse(rawBody) as WompiWebhookEvent;
  } catch {
    return badRequest("Invalid JSON");
  }

  if (!verifyWompiEvent(payload)) {
    console.error("Wompi webhook signature invalid");
    return unauthorized("Invalid signature");
  }

  if (payload.event === "transaction.updated") {
    const transaction = payload.data.transaction as Record<string, unknown> | undefined;
    if (transaction) {
      const reference = String(transaction.reference ?? "");
      const status = String(transaction.status ?? "");
      const transactionId = String(transaction.id ?? "");
      const meta = parsePaymentReference(reference);

      if (meta && status === "APPROVED") {
        const payment = await getPaymentByReference(meta.tenantId, reference);
        if (payment && payment.status !== "approved") {
          await fulfillWompiPayment(meta.tenantId, reference, transactionId);
        }
      } else if (meta && (status === "DECLINED" || status === "ERROR" || status === "VOIDED")) {
        await updatePaymentIntent(meta.tenantId, reference, {
          status: "declined",
          wompiTransactionId: transactionId,
        });
      }
    }
  }

  return ok({ received: true });
}

async function handleStripeWebhook(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const rawBody = getRawBody(event);
  const signature = event.headers["stripe-signature"];
  if (!signature) return unauthorized("Missing stripe-signature");

  const stripe = getStripe();
  let stripeEvent: Stripe.Event;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getStripeWebhookSecret()
    );
  } catch (err) {
    console.error("Stripe webhook signature failed:", err);
    return badRequest("Invalid signature");
  }

  switch (stripeEvent.type) {
    case "checkout.session.completed": {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId) break;
      if (session.subscription && typeof session.subscription === "string") {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await syncSubscriptionToTenant(tenantId, sub);
      } else if (session.metadata?.plan) {
        await updateTenant(tenantId, {
          plan: session.metadata.plan as TenantPlan,
          subscriptionStatus: "active",
          paymentProvider: "stripe",
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = stripeEvent.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      if (stripeEvent.type === "customer.subscription.deleted") {
        await updateTenant(tenantId, {
          plan: "free",
          subscriptionStatus: "canceled",
        });
      } else {
        await syncSubscriptionToTenant(tenantId, sub);
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) break;
      const tenantId = customer.metadata?.tenantId;
      if (tenantId) {
        await updateTenant(tenantId, { subscriptionStatus: "past_due" });
      }
      break;
    }
    default:
      break;
  }

  return ok({ received: true });
}
