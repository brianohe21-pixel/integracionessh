import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { z } from "zod";
import Stripe from "stripe";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant, updateTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  createPaymentIntent,
  getPaymentByReference,
  listPaymentsByTenant,
  updatePaymentIntent,
} from "../../lib/dynamodb/payment.repository.js";
import { activateTenantPlan } from "../../lib/billing/activate-plan.js";
import {
  resolveEffectivePlanLimits,
  resolvePlanLimits,
} from "../../lib/billing/plan-limits.js";
import { getPlatformBillingConfig } from "../../lib/dynamodb/platform-config.repository.js";
import {
  getMonthlyUsage,
  listMonthlyUsageInRange,
  sumMonthlyUsage,
} from "../../lib/dynamodb/usage.repository.js";
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
  buildWompiCheckoutParams,
  buildPaymentReference,
  buildAiPackPaymentReference,
  parsePaymentReference,
  verifyWompiEvent,
  fetchWompiTransaction,
  getPlatformWompiCredentials,
  FRONTEND_URL as WOMPI_FRONTEND_URL,
  type WompiWebhookEvent,
} from "../../lib/billing/wompi.js";
import {
  buildAiUsageSnapshot,
  findAiMessagePack,
  listActiveAiMessagePacks,
  resolveAiPackCheckout,
  grantAiMessagePack,
} from "../../lib/billing/ai-pack-billing.js";
import {
  ok,
  badRequest,
  handleError,
  unauthorized,
} from "../../lib/http.js";
import {
  PLAN_LIST_PRICE_USD,
  type PaidTenantPlan,
} from "../../lib/billing/plan-config.js";
import { assertCheckoutAllowed } from "../../lib/billing/checkout-policy.js";
import { normalizeTenantPlan } from "../../lib/billing/normalize-plan.js";
import { calculateUsdPriceInCopCents } from "../../lib/billing/trm.js";
import {
  buildTemplateBillingSnapshot,
  resolveStarterCheckoutBreakdown,
  syncStarterPeriodExpiry,
} from "../../lib/billing/template-billing.js";

import type { SubscriptionStatus } from "../../types/index.js";

const CheckoutSchema = z
  .object({
    plan: z.enum(["starter", "pro"]).optional(),
    aiPackId: z.string().min(1).optional(),
    provider: z.enum(["wompi", "stripe"]).optional(),
  })
  .refine((data) => Boolean(data.plan) !== Boolean(data.aiPackId), {
    message: "Provide either plan or aiPackId",
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

async function resolveCheckoutAmountInCents(
  plan: PaidTenantPlan
): Promise<{ amountInCents: number; trm?: number }> {
  if (plan === "starter") {
    try {
      return await calculateUsdPriceInCopCents(PLAN_LIST_PRICE_USD.starter);
    } catch (error) {
      console.warn("Starter TRM pricing unavailable, using fixed Wompi amount", error);
      return { amountInCents: amountInCentsForPlan(plan) };
    }
  }
  return { amountInCents: amountInCentsForPlan(plan) };
}

async function handleWompiCheckout(
  tenant: Awaited<ReturnType<typeof ensureTenant>>,
  email: string,
  plan: PaidTenantPlan
) {
  assertCheckoutAllowed(tenant, plan);
  const tenantId = tenant.tenantId;
  const reference = buildPaymentReference(tenantId, plan);

  let amountInCents: number;
  let planFeeCents: number | undefined;
  let templateFeeCents: number | undefined;
  let templatesAcceptedCount: number | undefined;
  let unitPriceCents: number | undefined;

  if (plan === "starter") {
    const breakdown = await resolveStarterCheckoutBreakdown(tenant);
    amountInCents = breakdown.totalCents;
    planFeeCents = breakdown.planFeeCents;
    templateFeeCents = breakdown.templateFeeCents;
    templatesAcceptedCount = breakdown.templatesAcceptedCount;
    unitPriceCents = breakdown.unitPriceCents;
  } else {
    ({ amountInCents } = await resolveCheckoutAmountInCents(plan));
  }

  await createPaymentIntent({
    reference,
    tenantId,
    plan,
    kind: "plan",
    amountInCents,
    ...(planFeeCents !== undefined ? { planFeeCents } : {}),
    ...(templateFeeCents !== undefined ? { templateFeeCents } : {}),
    ...(templatesAcceptedCount !== undefined ? { templatesAcceptedCount } : {}),
    ...(unitPriceCents !== undefined ? { unitPriceCents } : {}),
  });

  const redirectUrl = `${WOMPI_FRONTEND_URL}/billing/success?reference=${encodeURIComponent(reference)}`;
  const creds = getPlatformWompiCredentials();
  if (!creds) throw new Error("Wompi is not configured");
  const checkoutParams = buildWompiCheckoutParams(creds, {
    reference,
    amountInCents,
    redirectUrl,
    customerEmail: email,
  });
  const url = buildCheckoutUrl(creds, {
    reference,
    amountInCents,
    redirectUrl,
    customerEmail: email,
  });

  return ok({
    url,
    reference,
    provider: "wompi",
    kind: "plan",
    wompi: checkoutParams,
    ...(plan === "starter"
      ? {
          breakdown: {
            planFeeCents,
            templateFeeCents,
            templatesAcceptedCount,
            unitPriceCents,
            totalCents: amountInCents,
          },
        }
      : {}),
  });
}

async function handleWompiAiPackCheckout(
  tenant: Awaited<ReturnType<typeof ensureTenant>>,
  email: string,
  packId: string
) {
  const { pack, amountInCents } = await resolveAiPackCheckout(tenant, packId);
  const tenantId = tenant.tenantId;
  const reference = buildAiPackPaymentReference(tenantId, pack.id);
  const plan = normalizeTenantPlan(tenant.plan);

  await createPaymentIntent({
    reference,
    tenantId,
    plan,
    kind: "ai_pack",
    aiPackId: pack.id,
    aiMessagesGranted: pack.messages,
    amountInCents,
  });

  const redirectUrl = `${WOMPI_FRONTEND_URL}/billing/success?reference=${encodeURIComponent(reference)}`;
  const creds = getPlatformWompiCredentials();
  if (!creds) throw new Error("Wompi is not configured");
  const checkoutParams = buildWompiCheckoutParams(creds, {
    reference,
    amountInCents,
    redirectUrl,
    customerEmail: email,
  });
  const url = buildCheckoutUrl(creds, {
    reference,
    amountInCents,
    redirectUrl,
    customerEmail: email,
  });

  return ok({
    url,
    reference,
    provider: "wompi",
    kind: "ai_pack",
    aiPack: {
      id: pack.id,
      messages: pack.messages,
      priceCents: pack.priceCents,
    },
    wompi: checkoutParams,
  });
}

async function handleStripeCheckout(
  tenant: Awaited<ReturnType<typeof ensureTenant>>,
  plan: PaidTenantPlan
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
): Promise<{ ok: boolean; kind?: "plan" | "ai_pack" }> {
  const parsed = parsePaymentReference(reference);
  if (!parsed || parsed.tenantId !== tenantId) return { ok: false };

  const payment = await getPaymentByReference(tenantId, reference);
  if (!payment) return { ok: false };
  const kind = payment.kind ?? (parsed.kind === "ai_pack" ? "ai_pack" : "plan");
  if (payment.status === "approved") return { ok: true, kind };

  if (transactionId) {
    const creds = getPlatformWompiCredentials();
    if (!creds) return { ok: false };
    const tx = await fetchWompiTransaction(creds, transactionId);
    if (!tx || tx.reference !== reference) return { ok: false };
    if (tx.status !== "APPROVED") {
      await updatePaymentIntent(tenantId, reference, {
        status: tx.status === "DECLINED" || tx.status === "ERROR" ? "declined" : "pending",
        wompiTransactionId: transactionId,
      });
      return { ok: false };
    }
  }

  await updatePaymentIntent(tenantId, reference, {
    status: "approved",
    ...(transactionId ? { wompiTransactionId: transactionId } : {}),
  });

  if (kind === "ai_pack" || parsed.kind === "ai_pack") {
    let grant =
      typeof payment.aiMessagesGranted === "number" &&
      Number.isFinite(payment.aiMessagesGranted)
        ? Math.floor(payment.aiMessagesGranted)
        : 0;
    if (grant <= 0) {
      const packId =
        payment.aiPackId ?? (parsed.kind === "ai_pack" ? parsed.packId : "");
      if (packId) {
        const config = await getPlatformBillingConfig();
        grant = findAiMessagePack(config, packId)?.messages ?? 0;
      }
    }
    if (grant > 0) {
      await grantAiMessagePack(tenantId, grant);
    }
    return { ok: true, kind: "ai_pack" };
  }

  if (parsed.kind !== "plan") return { ok: false };
  await activateTenantPlan(tenantId, parsed.plan);
  return { ok: true, kind: "plan" };
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

    const auth = await resolveRequestAuth(
      event as APIGatewayProxyEventV2WithJWTAuthorizer
    );
    assertMemberRole(auth);
    const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && path.endsWith("/billing/status")) {
      const syncedTenant = await syncStarterPeriodExpiry(tenant);
      const usage = await getMonthlyUsage(syncedTenant.tenantId);
      const plan = syncedTenant.plan ?? "free";
      const limits = await resolveEffectivePlanLimits(syncedTenant);
      const billingConfig = await getPlatformBillingConfig();
      const templateBilling = buildTemplateBillingSnapshot(syncedTenant, billingConfig);
      const periodEnd = syncedTenant.currentPeriodEnd
        ? new Date(syncedTenant.currentPeriodEnd)
        : null;
      const now = Date.now();
      const msUntilExpiry = periodEnd ? periodEnd.getTime() - now : null;
      const isExpired = periodEnd ? periodEnd.getTime() <= now : false;
      const canRenew =
        plan !== "free" &&
        (isExpired ||
          templateBilling.creditCapReached ||
          (syncedTenant.subscriptionStatus ?? "none") === "past_due" ||
          msUntilExpiry === null ||
          msUntilExpiry <= 7 * 24 * 60 * 60 * 1000);

      let checkoutBreakdown:
        | Awaited<ReturnType<typeof resolveStarterCheckoutBreakdown>>
        | null = null;
      if (plan === "starter") {
        checkoutBreakdown = await resolveStarterCheckoutBreakdown(syncedTenant);
      }

      const aiUsage = buildAiUsageSnapshot(
        syncedTenant,
        limits.maxMessagesPerMonth,
        usage.messagesCount,
        usage.period
      );
      const aiPacks =
        plan === "free" ? [] : listActiveAiMessagePacks(billingConfig);

      return ok({
        plan,
        limits,
        usage,
        aiUsage,
        aiPacks,
        canPurchaseAiPacks: plan !== "free",
        subscriptionStatus: syncedTenant.subscriptionStatus ?? "none",
        currentPeriodEnd: syncedTenant.currentPeriodEnd ?? null,
        paymentProvider:
          syncedTenant.paymentProvider ?? (isWompiConfigured() ? "wompi" : "stripe"),
        canRenew,
        isExpired,
        templateBilling: {
          templatesAcceptedCount: templateBilling.templatesAcceptedCount,
          unitPriceCents: templateBilling.unitPriceCents,
          templateFeeCents: templateBilling.templateFeeCents,
          creditCapCount: templateBilling.creditCapCount,
          creditCapReached: templateBilling.creditCapReached,
          templatesBlocked: templateBilling.templatesBlocked,
          blockReason: templateBilling.blockReason,
        },
        checkoutBreakdown,
      });
    }

    if (method === "GET" && path.endsWith("/billing/usage")) {
      const qs = event.queryStringParameters ?? {};
      const from = qs.from?.trim();
      const to = qs.to?.trim();
      const plan = tenant.plan ?? "free";
      const limits = await resolveEffectivePlanLimits(tenant);
      const paymentProvider =
        tenant.paymentProvider ?? (isWompiConfigured() ? "wompi" : "stripe");

      if (from && to) {
        const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
        if (!DATE_ONLY.test(from) || !DATE_ONLY.test(to)) {
          return badRequest("from and to must be YYYY-MM-DD");
        }
        if (from > to) {
          return badRequest("from must be before or equal to to");
        }
        const periods = await listMonthlyUsageInRange(tenant.tenantId, from, to);
        const usage = sumMonthlyUsage(tenant.tenantId, periods);
        const aiUsage = buildAiUsageSnapshot(
          tenant,
          limits.maxMessagesPerMonth,
          usage.messagesCount,
          usage.period
        );
        return ok({
          from,
          to,
          usage,
          periods,
          limits,
          aiUsage,
          plan,
          subscription: tenant.subscriptionStatus ?? "none",
          paymentProvider,
        });
      }

      const usage = await getMonthlyUsage(tenant.tenantId);
      const aiUsage = buildAiUsageSnapshot(
        tenant,
        limits.maxMessagesPerMonth,
        usage.messagesCount,
        usage.period
      );
      return ok({
        usage,
        limits,
        aiUsage,
        plan,
        subscription: tenant.subscriptionStatus ?? "none",
        paymentProvider,
      });
    }

    if (method === "GET" && path.endsWith("/billing/payments")) {
      const payments = await listPaymentsByTenant(auth.tenantId);
      return ok(payments);
    }

    if (method === "GET" && path.endsWith("/billing/transaction")) {
      const reference =
        event.queryStringParameters?.reference?.trim() ?? "";
      if (!reference) return badRequest("reference is required");

      const payment = await getPaymentByReference(auth.tenantId, reference);
      if (!payment) return badRequest("Transaction not found");

      return ok({
        reference: payment.reference,
        plan: payment.plan,
        kind: payment.kind ?? "plan",
        aiPackId: payment.aiPackId ?? null,
        aiMessagesGranted: payment.aiMessagesGranted ?? null,
        status: payment.status,
        amountInCents: payment.amountInCents,
        wompiTransactionId: payment.wompiTransactionId ?? null,
      });
    }

    if (method === "GET" && path.endsWith("/billing/providers")) {
      const wompi = isWompiConfigured();
      const stripe = isStripeConfigured();
      const defaultProvider = wompi ? "wompi" : stripe ? "stripe" : null;
      const [starterPrice, billingConfig] = await Promise.all([
        resolveCheckoutAmountInCents("starter"),
        getPlatformBillingConfig(),
      ]);
      const starterLimits = await resolvePlanLimits("starter");
      const plans: Record<string, Record<string, unknown>> = {
        starter: {
          amountCents: starterPrice.amountInCents,
          listPriceUsd: PLAN_LIST_PRICE_USD.starter,
          currency: "COP",
          periodDays: 30,
          maxMessagesPerMonth: starterLimits.maxMessagesPerMonth,
          pricePerTemplateCents: billingConfig.pricePerMessageCents,
          templateCreditCapCount: billingConfig.templateCreditCapCount ?? 0,
          ...(starterPrice.trm !== undefined ? { trm: starterPrice.trm } : {}),
        },
        pro: {
          salesOnly: true,
          currency: "COP",
          periodDays: 30,
          maxMessagesPerMonth: billingConfig.maxMessagesPerMonthByPlan.pro,
        },
      };
      return ok({
        wompi,
        stripe,
        default: defaultProvider,
        plans,
        aiPacks: listActiveAiMessagePacks(billingConfig),
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

      const result = await fulfillWompiPayment(
        auth.tenantId,
        reference,
        parsed.data.id
      );
      if (!result.ok) return badRequest("Payment not approved");
      return ok({ activated: true, kind: result.kind ?? "plan" });
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

      if (parsed.data.aiPackId) {
        if (provider !== "wompi") {
          return badRequest("AI message packs are only available with Wompi");
        }
        return handleWompiAiPackCheckout(tenant, auth.email, parsed.data.aiPackId);
      }

      if (!parsed.data.plan) {
        return badRequest("plan is required");
      }

      assertCheckoutAllowed(tenant, parsed.data.plan);

      if (provider === "wompi") {
        return handleWompiCheckout(tenant, auth.email, parsed.data.plan);
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

  const creds = getPlatformWompiCredentials();
  if (!creds || !verifyWompiEvent(creds, payload)) {
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
          plan: normalizeTenantPlan(session.metadata.plan),
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
