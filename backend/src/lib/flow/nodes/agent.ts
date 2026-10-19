import type { FlowNode, FlowRun } from "../../../types/index.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";
import { resolveConfiguredWhatsAppChannelIds } from "../whatsapp-channel-filter.js";

export async function executeAgentNode(
  node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const channel = node.data.channel ?? "any";
  const whatsappChannelIds = resolveConfiguredWhatsAppChannelIds(node.data);
  return {
    nextNodeId: getNextNodeId(ctx.flow, node.id),
    halt: false,
    wait: false,
    variables: {
      flow_agent_channel: channel,
      ...(whatsappChannelIds[0]
        ? { flow_whatsapp_channel_id: whatsappChannelIds[0] }
        : {}),
      ...(whatsappChannelIds.length
        ? { flow_whatsapp_channel_ids: whatsappChannelIds.join(",") }
        : {}),
    },
    output: channel,
  };
}
