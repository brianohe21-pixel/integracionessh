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

export function coerceMessageEntryToWebhookTrigger(
  nodes: FlowNode[],
  triggerLabel: string
): FlowNode[] {
  if (!hasWebhookNode(nodes)) return nodes;

  let changed = false;
  const next = nodes.map((node) => {
    if (node.type === "message_received_trigger") {
      changed = true;
      return {
        ...node,
        type: "trigger" as const,
        data: {
          ...node.data,
          label: triggerLabel,
          triggerType: "web_form_submitted" as const,
          keywords: undefined,
          matchMode: undefined,
          channel: undefined,
          whatsappChannelId: undefined,
          whatsappChannelIds: undefined,
        },
      };
    }

    if (
      node.type === "trigger" &&
      node.data.triggerType !== "web_form_submitted"
    ) {
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          triggerType: "web_form_submitted" as const,
        },
      };
    }

    return node;
  });

  return changed ? next : nodes;
}
