import type { FlowDefinition, FlowNode } from "../../types/index.js";
import { resolveDraftNodes } from "./draft.js";
import { resolveFlowBotId } from "./resolve-flow-bot.js";
import { isVoiceAiFlow } from "./voice-flow-compiler.js";
import { isWebhookReceivingFlow } from "./webhook-flow.js";

function isFormTriggerFlow(nodes: FlowNode[]): boolean {
  return nodes.some(
    (node) => node.type === "trigger" && node.data.triggerType === "web_form_submitted"
  );
}

export function getEnableBotAssignmentError(flow: FlowDefinition): string | null {
  const botId = resolveFlowBotId(flow);
  const nodes = resolveDraftNodes(flow);
  const formFlow = isFormTriggerFlow(nodes);
  const webhookFlow = isWebhookReceivingFlow(nodes);
  const voiceFlow = isVoiceAiFlow(flow);
  if (!botId && (voiceFlow || (!formFlow && !webhookFlow))) {
    return "Assign the flow to an agent before enabling it";
  }
  return null;
}
