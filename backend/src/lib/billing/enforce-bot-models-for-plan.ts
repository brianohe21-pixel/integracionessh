import { listBots, updateBot } from "../dynamodb/bot.repository.js";
import {
  DEFAULT_MODEL_ID,
  isModelAllowedForPlan,
  isValidModelId,
} from "../ai/models.js";
import type { TenantPlan } from "../../types/index.js";

export async function enforceBotModelsForPlan(
  tenantId: string,
  plan: TenantPlan
): Promise<void> {
  const bots = await listBots(tenantId);
  await Promise.all(
    bots.map(async (bot) => {
      const updates: { model?: string; telephonyModel?: string; voicebotModel?: string } = {};

      if (bot.model && isValidModelId(bot.model) && !isModelAllowedForPlan(plan, bot.model)) {
        updates.model = DEFAULT_MODEL_ID;
      }

      if (
        bot.telephonyModel &&
        isValidModelId(bot.telephonyModel) &&
        !isModelAllowedForPlan(plan, bot.telephonyModel)
      ) {
        updates.telephonyModel = DEFAULT_MODEL_ID;
      }

      if (
        bot.voicebotModel &&
        isValidModelId(bot.voicebotModel) &&
        !isModelAllowedForPlan(plan, bot.voicebotModel)
      ) {
        updates.voicebotModel = DEFAULT_MODEL_ID;
      }

      if (Object.keys(updates).length === 0) return;
      await updateBot(tenantId, bot.botId, updates);
    })
  );
}
