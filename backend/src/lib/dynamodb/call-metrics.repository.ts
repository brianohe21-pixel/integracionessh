import { listBots } from "./bot.repository.js";
import { listAllCallsForTenant } from "./call.repository.js";
import { buildCallingMetrics, resolveMetricsDateRange } from "./call-metrics.js";
import type { CallingMetrics } from "../../types/index.js";

export async function getCallingMetrics(
  tenantId: string,
  options: { from?: string; to?: string; days?: number; botId?: string } = {}
): Promise<CallingMetrics> {
  const range = resolveMetricsDateRange(options);
  const [calls, bots] = await Promise.all([
    listAllCallsForTenant(tenantId),
    listBots(tenantId),
  ]);

  const botId = options.botId?.trim();
  const scopedCalls = botId ? calls.filter((call) => call.botId === botId) : calls;
  const scopedBots = botId ? bots.filter((bot) => bot.botId === botId) : bots;
  const botNames = new Map(scopedBots.map((bot) => [bot.botId, bot.name]));
  return buildCallingMetrics(scopedCalls, range, botNames);
}
