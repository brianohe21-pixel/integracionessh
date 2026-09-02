import type { FlowNode, FlowRun } from "../../../types/index.js";
import { getBot } from "../../dynamodb/bot.repository.js";
import { getWhatsAppAccessToken } from "../../whatsapp/client.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeAssignBotNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const botId = node.data.botId?.trim();
  if (!botId) {
    throw new Error("Select a bot in the assign bot node");
  }

  const bot = await getBot(ctx.tenantId, botId);
  if (!bot) throw new Error("Bot not found");

  ctx.botId = botId;
  ctx.bot = bot;
  ctx.phoneNumberId = bot.phoneNumberId;

  try {
    ctx.accessToken = await getWhatsAppAccessToken(ctx.tenantId, ctx.environment);
  } catch {
    ctx.accessToken = "";
  }

  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: { flow_bot_id: botId },
    output: botId,
  };
}
