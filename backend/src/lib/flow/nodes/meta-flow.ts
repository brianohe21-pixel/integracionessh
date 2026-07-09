import { randomUUID } from "crypto";
import { sendFlowMessage } from "../../whatsapp/flows.js";
import { setMetaFlowSession } from "../../dynamodb/conversation.repository.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { skipWhatsAppOnlyNode } from "./channel-guard.js";

export async function executeMetaFlowNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const skipped = skipWhatsAppOnlyNode(ctx, node.id, "meta_flow");
  if (skipped) return skipped;
  const metaFlowId = node.data.metaFlowId;
  if (!metaFlowId) throw new Error("metaFlowId required for meta_flow node");

  const flowToken = randomUUID();
  const flowCta = node.data.metaFlowCta ?? "Open form";

  await sendFlowMessage({
    phoneNumberId: ctx.phoneNumberId,
    to: ctx.customerPhone,
    accessToken: ctx.accessToken,
    flowId: metaFlowId,
    flowCta,
    flowToken,
    ...(ctx.replyToMessageId ? { replyToMessageId: ctx.replyToMessageId } : {}),
  });

  await setMetaFlowSession(
    ctx.tenantId,
    ctx.botId,
    ctx.conversation.conversationId,
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
