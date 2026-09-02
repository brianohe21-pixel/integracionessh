import type { FlowNode } from "@/types";

export function hasWebhookNode(nodes: FlowNode[]): boolean {
  return nodes.some((node) => node.type === "webhook");
}

export function isWebhookReceivingFlow(nodes: FlowNode[]): boolean {
  return (
    nodes.some(
      (node) => node.type === "trigger" && node.data.triggerType === "web_form_submitted"
    ) || hasWebhookNode(nodes)
  );
}
