import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export async function executeAgentNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const channel = node.data.channel ?? "any";
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: {
      flow_agent_channel: channel,
      ...(node.data.whatsappChannelId
        ? { flow_whatsapp_channel_id: node.data.whatsappChannelId }
        : {}),
    },
    output: channel,
  };
}
