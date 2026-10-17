import { sendInteractiveList } from "../../whatsapp/flows.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireMessagingContext } from "../types.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";
import { persistFlowOutboundMessage } from "../persist-outbound.js";

export async function executeListNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "list");
  if (skipped) return skipped;
  const { conversation, phoneNumberId, accessToken, customerPhone } = requireMessagingContext(ctx);
  const locale = getBotLocale(conversation, ctx.bot);
  const rows = (node.data.listItems ?? []).map((item) => {
    const description = resolveLocalizedText(item.description, locale).trim();
    return {
      id: item.id,
      title: resolveLocalizedText(item.title, locale),
      ...(description ? { description } : {}),
    };
  });
  const bodyText =
    resolveLocalizedText(node.data.messageText, locale) ||
    getSystemMessage("chooseOption", locale);
  const buttonText =
    resolveLocalizedText(node.data.listButtonText, locale) ||
    getSystemMessage("listOptions", locale);
  const sectionTitle = resolveLocalizedText(node.data.listSectionTitle, locale) || undefined;
  const headerText = resolveLocalizedText(node.data.listHeaderText, locale) || undefined;
  const footerText = resolveLocalizedText(node.data.listFooterText, locale) || undefined;

  if (ctx.buttonReplyId) {
    const { getNextNodeId } = await import("../graph.js");
    return {
      nextNodeId: getNextNodeId(ctx.flow, node.id, ctx.buttonReplyId),
      halt: false,
      wait: false,
      output: ctx.buttonReplyId,
    };
  }

  const result = await sendInteractiveList({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    bodyText,
    buttonText,
    rows,
    ...(sectionTitle ? { sectionTitle } : {}),
    ...(headerText ? { headerText } : {}),
    ...(footerText ? { footerText } : {}),
    ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
  });

  await persistFlowOutboundMessage({
    ctx,
    content: bodyText,
    messageType: "interactive",
    skipIfAdapterPersists: false,
    ...(result.messages?.[0]?.id ? { externalMessageId: result.messages[0].id } : {}),
    metadata: { kind: "interactive_list", buttonText, rows },
  });

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    output: "awaiting_list",
  };
}
