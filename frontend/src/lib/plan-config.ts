import type { TenantPlan } from "@/types";

export type AllowedModel = "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo";

const ALLOWED_MODELS: Record<TenantPlan, AllowedModel[]> = {
  free: ["gpt-4o-mini"],
  pro: ["gpt-4o-mini"],
  enterprise: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
};

export function getAllowedModelsForPlan(plan: TenantPlan | string | undefined): AllowedModel[] {
  if (plan === "pro" || plan === "enterprise" || plan === "free") {
    return ALLOWED_MODELS[plan];
  }
  return ALLOWED_MODELS.free;
}

export function formatCopPrice(amountCents: number): string {
  const pesos = Math.round(amountCents / 100);
  return `$${pesos.toLocaleString("es-CO")} COP`;
}
