import { randomUUID } from "crypto";
import { sendFlowMessage } from "../../whatsapp/flows.js";
import { setMetaFlowSession } from "../../dynamodb/conversation.repository.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotId, requireMessagingContext } from "../types.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";
import { getBotLocale, getSystemMessage, resolveLocalizedText } from "../../i18n/index.js";

export async function executeMetaFlowNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "meta_flow");
  if (skipped) return skipped;
  const metaFlowId = node.data.metaFlowId;
  if (!metaFlowId) throw new Error("metaFlowId required for meta_flow node");

  const { conversation, phoneNumberId, accessToken, customerPhone } = requireMessagingContext(ctx);
  const locale = getBotLocale(conversation, ctx.bot);
  const flowToken = randomUUID();
  const flowCta =
    resolveLocalizedText(node.data.metaFlowCta, locale) ||
    getSystemMessage("metaFlowCtaDefault", locale);

  await sendFlowMessage({
    phoneNumberId,
    to: customerPhone,
    accessToken,
    flowId: metaFlowId,
    flowCta,
    flowToken,
    ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
  });

  await setMetaFlowSession(
    ctx.tenantId,
    requireBotId(ctx),
    conversation.conversationId,
    metaFlowId,
    flowToken
  );

  return {
    nextNodeId: null,
    halt: true,
    wait: true,
    output: "awaiting_meta_flow",
  };
}
