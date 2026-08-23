import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { getBotLocale, resolveLocalizedText } from "../../i18n/index.js";

export async function executeMessageNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const { botId, bot } = requireBotContext(ctx);
  const locale = getBotLocale(ctx.conversation!, bot);
  const text = resolveLocalizedText(node.data.messageText, locale);
  if (text) {
    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId,
        bot,
        conversation: ctx.conversation!,
        accessToken: ctx.accessToken,
        environment: ctx.environment,
        replyToExternalId: ctx.replyToMessageId,
      }),
      text
    );
  }
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    output: text,
  };
}
