import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { getNextNodeId } from "../graph.js";

export function skipWhatsAppOnlyNode(
  ctx: FlowExecutionContext,
  nodeId: string,
  nodeType: string
): NodeExecutionResult | null {
  if (ctx.channel === "whatsapp") return null;
  console.warn(`Skipping ${nodeType} node on channel ${ctx.channel}`);
  return {
    nextNodeId: getNextNodeId(ctx.flow, nodeId),
    halt: false,
    wait: false,
    output: `skipped_${nodeType}`,
  };
}
