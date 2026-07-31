import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireEnabledCatalog } from "../../catalog/catalog.service.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";

export async function executeAwaitOrderNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const locale = getBotLocale(ctx.conversation, ctx.bot);
  try {
    await requireEnabledCatalog(ctx.tenantId, ctx.botId);
  } catch {
    await sendChannelText(
      buildOutboundContext({
        tenantId: ctx.tenantId,
        botId: ctx.botId,
        bot: ctx.bot,
        conversation: ctx.conversation,
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
      botId: ctx.botId,
      bot: ctx.bot,
      conversation: ctx.conversation,
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
