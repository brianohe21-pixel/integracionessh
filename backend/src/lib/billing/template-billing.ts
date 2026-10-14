import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import { getPlatformBillingConfig } from "../dynamodb/platform-config.repository.js";
import { resolveTenantPricePerMessageCents } from "./resolve-message-price.js";
import { normalizeTenantPlan } from "./normalize-plan.js";
import { PlanLimitError, assertSubscriptionAllowsSending } from "./plan-limits.js";
import type { PlatformBillingConfig, Tenant } from "../../types/index.js";

export interface TemplateBillingSnapshot {
  templatesAcceptedCount: number;
  unitPriceCents: number;
  templateFeeCents: number;
  creditCapCount: number | null;
  creditCapReached: boolean;
  templatesBlocked: boolean;
  blockReason: "past_due" | "credit_cap" | "subscription" | null;
}

export function getTemplateCreditCapCount(
  config: Pick<PlatformBillingConfig, "templateCreditCapCount">
): number | null {
  const raw = config.templateCreditCapCount;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

export function resolveUnitPriceCents(
  tenant: Pick<Tenant, "pricePerMessageCents" | "billingPeriodAppliedPricePerMessageCents">,
  platformPricePerMessageCents: number
): number {
  if (
    typeof tenant.billingPeriodAppliedPricePerMessageCents === "number" &&
    Number.isFinite(tenant.billingPeriodAppliedPricePerMessageCents) &&
    tenant.billingPeriodAppliedPricePerMessageCents >= 0
  ) {
    return Math.floor(tenant.billingPeriodAppliedPricePerMessageCents);
  }
  return resolveTenantPricePerMessageCents(tenant, platformPricePerMessageCents);
}

export function buildTemplateBillingSnapshot(
  tenant: Tenant,
  config: PlatformBillingConfig
): TemplateBillingSnapshot {
  const plan = normalizeTenantPlan(tenant.plan);
  const count = Math.max(0, Math.floor(tenant.billingPeriodTemplatesAcceptedCount ?? 0));
  const unitPriceCents = resolveUnitPriceCents(tenant, config.pricePerMessageCents);
  const creditCapCount = plan === "starter" ? getTemplateCreditCapCount(config) : null;
  const creditCapReached =
    creditCapCount !== null && count >= creditCapCount;

  let blockReason: TemplateBillingSnapshot["blockReason"] = null;
  try {
    assertSubscriptionAllowsSending(tenant);
  } catch {
    blockReason =
      (tenant.subscriptionStatus ?? "none") === "past_due" ? "past_due" : "subscription";
  }
  if (!blockReason && creditCapReached) {
    blockReason = "credit_cap";
  }

  return {
    templatesAcceptedCount: count,
    unitPriceCents,
    templateFeeCents: count * unitPriceCents,
    creditCapCount,
    creditCapReached,
    templatesBlocked: blockReason !== null,
    blockReason,
  };
}

export async function syncStarterPeriodExpiry(tenant: Tenant): Promise<Tenant> {
  if (normalizeTenantPlan(tenant.plan) !== "starter") return tenant;
  if ((tenant.subscriptionStatus ?? "none") !== "active") return tenant;
  if (!tenant.currentPeriodEnd) return tenant;
  if (new Date(tenant.currentPeriodEnd).getTime() > Date.now()) return tenant;

  return updateTenant(tenant.tenantId, { subscriptionStatus: "past_due" });
}

export async function assertCanSendTemplates(tenant: Tenant): Promise<void> {
  const synced = await syncStarterPeriodExpiry(tenant);
  assertSubscriptionAllowsSending(synced);

  if (normalizeTenantPlan(synced.plan) !== "starter") return;

  const config = await getPlatformBillingConfig();
  const snapshot = buildTemplateBillingSnapshot(synced, config);
  if (snapshot.creditCapReached) {
    throw new PlanLimitError(
      "TEMPLATE_CREDIT_CAP",
      "Template credit cap reached for this billing period. Pay the outstanding template fees to continue."
    );
  }
}

export async function assertCanSendTemplatesByTenantId(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new PlanLimitError("SUBSCRIPTION_INACTIVE", "Tenant not found");
  }
  await assertCanSendTemplates(tenant);
}

export async function recordAcceptedTemplateSend(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  if (normalizeTenantPlan(tenant.plan) !== "starter") return;

  const config = await getPlatformBillingConfig();
  const currentCount = Math.max(0, Math.floor(tenant.billingPeriodTemplatesAcceptedCount ?? 0));
  const updates: Partial<Omit<Tenant, "tenantId" | "createdAt">> = {
    billingPeriodTemplatesAcceptedCount: currentCount + 1,
  };

  if (typeof tenant.billingPeriodAppliedPricePerMessageCents !== "number") {
    updates.billingPeriodAppliedPricePerMessageCents = resolveTenantPricePerMessageCents(
      tenant,
      config.pricePerMessageCents
    );
  }

  await updateTenant(tenantId, updates);
}

export async function resetTemplateBillingPeriod(tenantId: string): Promise<void> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return;
  const config = await getPlatformBillingConfig();
  await updateTenant(tenantId, {
    billingPeriodTemplatesAcceptedCount: 0,
    billingPeriodAppliedPricePerMessageCents: resolveTenantPricePerMessageCents(
      tenant,
      config.pricePerMessageCents
    ),
  });
}

export async function resolveStarterCheckoutBreakdown(tenant: Tenant): Promise<{
  planFeeCents: number;
  templatesAcceptedCount: number;
  unitPriceCents: number;
  templateFeeCents: number;
  totalCents: number;
  trm?: number;
}> {
  const { calculateUsdPriceInCopCents } = await import("./trm.js");
  const { PLAN_LIST_PRICE_USD } = await import("./plan-config.js");
  const { amountInCentsForPlan } = await import("./wompi.js");

  let planFeeCents: number;
  let trm: number | undefined;
  try {
    const priced = await calculateUsdPriceInCopCents(PLAN_LIST_PRICE_USD.starter);
    planFeeCents = priced.amountInCents;
    trm = priced.trm;
  } catch {
    planFeeCents = amountInCentsForPlan("starter");
  }

  const config = await getPlatformBillingConfig();
  const snapshot = buildTemplateBillingSnapshot(tenant, config);

  return {
    planFeeCents,
    templatesAcceptedCount: snapshot.templatesAcceptedCount,
    unitPriceCents: snapshot.unitPriceCents,
    templateFeeCents: snapshot.templateFeeCents,
    totalCents: planFeeCents + snapshot.templateFeeCents,
    ...(trm !== undefined ? { trm } : {}),
  };
}
