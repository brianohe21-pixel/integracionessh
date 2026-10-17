import { getTenant, updateTenant } from "../dynamodb/tenant.repository.js";
import { getPlatformBillingConfig } from "../dynamodb/platform-config.repository.js";
import { currentUsagePeriod } from "../dynamodb/usage.repository.js";
import {
  DEFAULT_AI_MESSAGE_PACKS,
  normalizeAiMessagePacks,
} from "./ai-pack-config.js";
import { normalizeTenantPlan } from "./normalize-plan.js";
import { PlanLimitError, assertSubscriptionAllowsSending } from "./plan-limits.js";
import type { AiMessagePack, PlatformBillingConfig, Tenant } from "../../types/index.js";

export { DEFAULT_AI_MESSAGE_PACKS, normalizeAiMessagePacks };

export interface AiUsageSnapshot {
  period: string;
  planLimit: number;
  planUsed: number;
  bonusGranted: number;
  bonusUsed: number;
  bonusRemaining: number;
  effectiveLimit: number;
  totalUsed: number;
}

export function listActiveAiMessagePacks(
  config: Pick<PlatformBillingConfig, "aiMessagePacks">
): AiMessagePack[] {
  return normalizeAiMessagePacks(config.aiMessagePacks).filter((pack) => pack.active !== false);
}

export function findAiMessagePack(
  config: Pick<PlatformBillingConfig, "aiMessagePacks">,
  packId: string
): AiMessagePack | null {
  const id = packId.trim();
  if (!id) return null;
  return listActiveAiMessagePacks(config).find((pack) => pack.id === id) ?? null;
}

export function getAiBonusMessagesGranted(
  tenant: Pick<Tenant, "aiBonusMessagesPeriod" | "aiBonusMessagesGranted">,
  period = currentUsagePeriod()
): number {
  if (tenant.aiBonusMessagesPeriod !== period) return 0;
  const granted = tenant.aiBonusMessagesGranted;
  if (typeof granted !== "number" || !Number.isFinite(granted) || granted <= 0) return 0;
  return Math.floor(granted);
}

export function buildAiUsageSnapshot(
  tenant: Pick<Tenant, "aiBonusMessagesPeriod" | "aiBonusMessagesGranted">,
  planLimit: number,
  messagesCount: number,
  period = currentUsagePeriod()
): AiUsageSnapshot {
  const safePlanLimit = Math.max(0, Math.floor(planLimit));
  const totalUsed = Math.max(0, Math.floor(messagesCount));
  const bonusGranted = getAiBonusMessagesGranted(tenant, period);
  const planUsed = Math.min(totalUsed, safePlanLimit);
  const bonusUsed = Math.min(bonusGranted, Math.max(0, totalUsed - safePlanLimit));
  const bonusRemaining = Math.max(0, bonusGranted - bonusUsed);
  return {
    period,
    planLimit: safePlanLimit,
    planUsed,
    bonusGranted,
    bonusUsed,
    bonusRemaining,
    effectiveLimit: safePlanLimit + bonusGranted,
    totalUsed,
  };
}

export function assertCanPurchaseAiPack(tenant: Tenant): void {
  const plan = normalizeTenantPlan(tenant.plan);
  if (plan === "free") {
    throw new PlanLimitError(
      "AI_PACK_FREE_NOT_ALLOWED",
      "AI message packs are available on paid plans only"
    );
  }
  assertSubscriptionAllowsSending(tenant);
}

export async function grantAiMessagePack(
  tenantId: string,
  messages: number
): Promise<number> {
  const grant = Math.max(0, Math.floor(messages));
  if (grant <= 0) return 0;

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new PlanLimitError("SUBSCRIPTION_INACTIVE", "Tenant not found");
  }

  const period = currentUsagePeriod();
  const currentBonus = getAiBonusMessagesGranted(tenant, period);
  const nextBonus = currentBonus + grant;

  await updateTenant(tenantId, {
    aiBonusMessagesPeriod: period,
    aiBonusMessagesGranted: nextBonus,
  });

  return nextBonus;
}

export async function resolveAiPackCheckout(
  tenant: Tenant,
  packId: string
): Promise<{ pack: AiMessagePack; amountInCents: number }> {
  assertCanPurchaseAiPack(tenant);
  const config = await getPlatformBillingConfig();
  const pack = findAiMessagePack(config, packId);
  if (!pack) {
    throw new PlanLimitError("AI_PACK_NOT_FOUND", "AI message pack not found");
  }
  return { pack, amountInCents: pack.priceCents };
}
