import { buildOutboundContext, sendChannelText } from "../../channels/router.js";
import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeMessageNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const text = node.data.messageText ?? "";
  if (text) {
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
