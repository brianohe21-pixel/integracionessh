import type { FlowNode, FlowTriggerType } from "@/types";
import { hasWebhookNode } from "@/lib/flow-webhook";

export function resolveFlowTriggerType(
  nodes: FlowNode[],
  isVoiceFlow: boolean
): FlowTriggerType {
  if (isVoiceFlow) return "voice_call";
  if (hasWebhookNode(nodes)) return "web_form_submitted";

  const trigger = nodes.find((node) => node.type === "trigger");
  const data = trigger?.data;
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
    if (node.type !== "trigger") return node;
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

  const trigger = nodes.find((node) => node.type === "trigger");
  return trigger?.data.formSamplePayload;
}
