import type { FlowNode, FlowRun } from "../../../types/index.js";
import { isAiAssistantEnabled } from "../../ai-assistant/config.js";
import { getBot } from "../../dynamodb/bot.repository.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext, requireBotId } from "../types.js";

export async function executeAssignBotNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const { bot: contextBot } = requireBotContext(ctx);
  const selectedBotId = node.data.botId?.trim() || requireBotId(ctx);
  const bot =
    selectedBotId === contextBot.botId
      ? contextBot
      : await getBot(ctx.tenantId, selectedBotId);

  if (!bot) {
    throw new Error("Selected agent not found");
  }

  if (!isAiAssistantEnabled(bot)) {
    throw new Error("AI Assistant is not enabled for this bot");
  }

  return {
    nextNodeId: null,
    halt: false,
    wait: false,
    variables: {
      handed_off_to_ai: "true",
      ai_bot_id: bot.botId,
    },
    output: "ai_assistant",
  };
}
