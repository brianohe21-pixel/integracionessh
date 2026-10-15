import type { FlowNode, FlowTriggerType } from "@/types";
import { getFlowEntryNode, isFlowEntryNode } from "@/lib/flow-entry-node";
import { hasWebhookNode } from "@/lib/flow-webhook";

export function resolveFlowTriggerType(
  nodes: FlowNode[],
  isVoiceFlow: boolean
): FlowTriggerType {
  if (isVoiceFlow) return "voice_call";
  if (hasWebhookNode(nodes)) return "web_form_submitted";

  const entry = getFlowEntryNode(nodes);
  if (entry?.type === "opportunity_stage_trigger") {
    return "opportunity_stage_entered";
  }
  if (entry?.type === "message_received_trigger") {
    const keywords = entry.data.keywords ?? [];
    if (keywords.length > 0) return "keyword";
    if (entry.data.triggerType === "first_message") return "first_message";
    return "any_message";
  }

  const data = entry?.data;
  if (data?.triggerType === "opportunity_stage_entered") {
    return "opportunity_stage_entered";
  }

  if (entry?.type === "trigger") {
    return "any_message";
  }

  const keywords = data?.keywords ?? [];

  if (keywords.length > 0) return "keyword";
  if (data?.triggerType === "first_message") return "first_message";
  return "any_message";
}

export function applyResolvedTriggerType(
  nodes: FlowNode[],
  isVoiceFlow: boolean
): FlowNode[] {
  const triggerType = resolveFlowTriggerType(nodes, isVoiceFlow);

  return nodes.map((node) => {
    if (!isFlowEntryNode(node)) return node;
    return {
      ...node,
      data: {
        ...node.data,
        triggerType,
      },
    };
  });
}

export function resolveFlowSamplePayload(nodes: FlowNode[]): Record<string, unknown> | undefined {
  const webhookNode = nodes.find((node) => node.type === "webhook");
  if (webhookNode?.data.formSamplePayload) {
    return webhookNode.data.formSamplePayload;
  }

  const entry = getFlowEntryNode(nodes);
  return entry?.data.formSamplePayload;
}
