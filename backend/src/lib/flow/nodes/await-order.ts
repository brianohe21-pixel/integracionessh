import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext, requireConversation } from "../types.js";
import { requireEnabledCatalog } from "../../catalog/catalog.service.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";

export async function executeAwaitOrderNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const conversation = requireConversation(ctx);
  const { botId, bot } = requireBotContext(ctx);
  if (!ctx.accessToken) throw new Error("Access token is required");
  const locale = getBotLocale(conversation, bot);
  try {
    await requireEnabledCatalog(ctx.tenantId, botId);
  } catch {
    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId,
        bot,
        conversation,
        accessToken: ctx.accessToken,
        environment: ctx.environment,
      }),
      getSystemMessage("catalogInactive", locale)
    );
    return { nextNodeId: null, halt: true, wait: false };
  }

  const prompt =
    resolveLocalizedText(node.data.messageText, locale) ||
    getSystemMessage("awaitOrderPrompt", locale);

  await sendChannelText(
    buildOutboundContext({
      tenantId: ctx.tenantId,
      botId,
      bot,
      conversation,
      accessToken: ctx.accessToken,
      environment: ctx.environment,
      replyToExternalId: ctx.replyToMessageId,
    }),
    prompt
  );

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    externalWait: true,
    output: "awaiting_order",
  };
}
