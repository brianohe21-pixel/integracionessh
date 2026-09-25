import { evaluateOpsAlertsForAllTenants } from "../../lib/ops-alerts/evaluate.js";

export async function handler(): Promise<{ ok: true }> {
  await evaluateOpsAlertsForAllTenants();
  return { ok: true };
}
