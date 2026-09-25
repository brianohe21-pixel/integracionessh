import { runServiceStatusCheck } from "../../lib/service-status/run-check.js";

export async function handler(): Promise<{ ok: true; updatedAt: string }> {
  const snapshot = await runServiceStatusCheck({
    telephonyWsUrl: process.env.TELEPHONY_GATEWAY_WS_URL ?? null,
  });
  return { ok: true, updatedAt: snapshot.updatedAt };
}
