import type { FlowNode, FlowRun } from "../../../types/index.js";
import { isAiAssistantEnabled } from "../../ai-assistant/config.js";
import type { FlowExecutionContext, NodeExecutionResult } from "../types.js";
import { requireBotContext } from "../types.js";

export async function executeAssignBotNode(
  _node: FlowNode,
  ctx: FlowExecutionContext,
  _run: FlowRun
): Promise<NodeExecutionResult> {
  const { bot } = requireBotContext(ctx);

  if (!isAiAssistantEnabled(bot)) {
    throw new Error("AI Assistant is not enabled for this bot");
  }

  return {
    nextNodeId: null,
    halt: false,
    wait: false,
    variables: { handed_off_to_ai: "true" },
    output: "ai_assistant",
  };
}
