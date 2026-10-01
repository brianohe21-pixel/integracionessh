import { sendInteractiveButtons } from "../../whatsapp/flows.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireMessagingContext } from "../types.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";
import { persistFlowOutboundMessage } from "../persist-outbound.js";

export async function executeButtonsNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "buttons");
  if (skipped) return skipped;
  const { conversation, phoneNumberId, accessToken, customerPhone } = requireMessagingContext(ctx);
  const locale = getBotLocale(conversation, ctx.bot);
  const buttons = (node.data.buttons ?? []).map((button) => ({
    id: button.id,
    title: resolveLocalizedText(button.title, locale),
  }));
  const bodyText =
    resolveLocalizedText(node.data.messageText, locale) ||
    getSystemMessage("chooseOption", locale);

  if (ctx.buttonReplyId) {
    const { getNextNodeId } = await import("../graph.js");
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, ctx.buttonReplyId),
      halt: false,
      wait: false,
      output: ctx.buttonReplyId,
    };
  }

  const result = await sendInteractiveButtons({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    bodyText,
    buttons,
    ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
  });

  await persistFlowOutboundMessage({
    ctx,
    content: bodyText,
    messageType: "interactive",
    skipIfAdapterPersists: false,
    ...(result.messages?.[0]?.id ? { externalMessageId: result.messages[0].id } : {}),
    metadata: { kind: "interactive_buttons", buttons },
  });

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    output: "awaiting_button",
  };
}
