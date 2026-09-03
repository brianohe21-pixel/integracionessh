import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  evaluateLaw2300At,
  getNextLaw2300WindowStart,
  isLaw2300EnforcedForTenant,
  LAW_2300_WINDOWS,
  type Law2300Evaluation,
} from "./law2300.js";

export async function evaluateLaw2300ForTenant(
  tenantId: string,
  now: Date = new Date()
): Promise<Law2300Evaluation> {
  const tenant = await getTenant(tenantId);
  return evaluateLaw2300At(now, tenant ?? undefined);
}

export async function getLaw2300StatusForTenant(tenantId: string) {
  const tenant = await getTenant(tenantId);
  const now = new Date();
  const evaluation = evaluateLaw2300At(now, tenant ?? undefined);

  return {
    enforced: isLaw2300EnforcedForTenant(tenant ?? undefined),
    allowedNow: evaluation.allowed,
    reason: evaluation.reason,
    nextWindowAt: evaluation.nextWindowAt?.toISOString() ?? null,
    timezone: LAW_2300_WINDOWS.timezone,
    windows: LAW_2300_WINDOWS.days,
  };
}

export { getNextLaw2300WindowStart };
