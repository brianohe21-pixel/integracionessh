import type { FlowEdge, FlowNode } from "@/types";
import { getFlowEntryNode, isFlowEntryNode } from "@/lib/flow-entry-node";
import { createFlowNode } from "@/lib/flow-node-factory";
import { hasWebhookNode } from "@/lib/flow-webhook";

export type FlowEntryMode = "message" | "webhook" | "stage" | "voice";

export type EditableFlowEntryMode = Exclude<FlowEntryMode, "voice">;

export function resolveFlowEntryMode(nodes: FlowNode[]): FlowEntryMode {
  const entry = getFlowEntryNode(nodes);
  if (!entry) return "message";

  if (entry.data.triggerType === "voice_call") return "voice";
  if (entry.type === "opportunity_stage_trigger") return "stage";
  if (
    hasWebhookNode(nodes) ||
    entry.data.triggerType === "web_form_submitted"
  ) {
    return "webhook";
  }
  if (entry.type === "message_received_trigger") return "message";
  if (entry.type === "trigger") return "message";
  return "message";
}

function removeWebhookNodes(
  nodes: FlowNode[],
  edges: FlowEdge[]
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const webhookIds = new Set(
    nodes.filter((node) => node.type === "webhook").map((node) => node.id)
  );
  if (webhookIds.size === 0) return { nodes, edges };

  const nextNodes = nodes.filter((node) => !webhookIds.has(node.id));
  const incoming = edges.filter((edge) => webhookIds.has(edge.target));
  const outgoing = edges.filter((edge) => webhookIds.has(edge.source));
  const kept = edges.filter(
    (edge) => !webhookIds.has(edge.source) && !webhookIds.has(edge.target)
  );

  const bridged: FlowEdge[] = [...kept];
  for (const inEdge of incoming) {
    for (const outEdge of outgoing) {
      if (outEdge.source !== inEdge.target) continue;
      bridged.push({
        id: `e-${inEdge.source}-${outEdge.target}-${Date.now()}`,
        source: inEdge.source,
        target: outEdge.target,
        ...(outEdge.sourceHandle ? { sourceHandle: outEdge.sourceHandle } : {}),
      });
    }
  }

  return { nodes: nextNodes, edges: bridged };
}

function ensureWebhookAfterEntry(
  nodes: FlowNode[],
  edges: FlowEdge[],
  entryId: string,
  webhookLabel: string
): { nodes: FlowNode[]; edges: FlowEdge[]; webhookId: string } {
  const existing = nodes.find((node) => node.type === "webhook");
  if (existing) {
    const linked = edges.some(
      (edge) => edge.source === entryId && edge.target === existing.id
    );
    if (linked) {
      return { nodes, edges, webhookId: existing.id };
    }
    const nextEdges = [
      ...edges.filter((edge) => !(edge.source === entryId && edge.target === existing.id)),
      {
        id: `e-${entryId}-${existing.id}`,
        source: entryId,
        target: existing.id,
      },
    ];
    return { nodes, edges: nextEdges, webhookId: existing.id };
  }

  const entry = nodes.find((node) => node.id === entryId);
  const webhook = createFlowNode({
    type: "webhook",
    position: {
      x: (entry?.position.x ?? 220) + 40,
      y: (entry?.position.y ?? 60) + 140,
    },
    label: webhookLabel,
    bindingPreset: "form",
  });

  const formerTargets = edges.filter((edge) => edge.source === entryId);
  const withoutEntryOut = edges.filter((edge) => edge.source !== entryId);
  const nextEdges: FlowEdge[] = [
    ...withoutEntryOut,
    { id: `e-${entryId}-${webhook.id}`, source: entryId, target: webhook.id },
    ...formerTargets.map((edge, index) => ({
      ...edge,
      id: `e-${webhook.id}-${edge.target}-${index}`,
      source: webhook.id,
    })),
  ];

  return {
    nodes: [...nodes, webhook],
    edges: nextEdges,
    webhookId: webhook.id,
  };
}

export function applyFlowEntryMode(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  mode: EditableFlowEntryMode;
  labels: {
    start: string;
    message: string;
    stage: string;
    webhook: string;
  };
  suggestedBotId?: string;
}): { nodes: FlowNode[]; edges: FlowEdge[]; entryId: string | null } {
  const entry = getFlowEntryNode(params.nodes);
  if (!entry) {
    return { nodes: params.nodes, edges: params.edges, entryId: null };
  }

  const botId =
    entry.data.botId?.trim() || params.suggestedBotId?.trim() || undefined;

  if (params.mode === "message") {
    const cleaned = removeWebhookNodes(params.nodes, params.edges);
    const nodes = cleaned.nodes.map((node) => {
      if (!isFlowEntryNode(node) || node.id !== entry.id) return node;
      return {
        ...node,
        type: "message_received_trigger" as const,
        data: {
          ...node.data,
          label: params.labels.start,
          triggerType:
            node.data.triggerType === "first_message"
              ? ("first_message" as const)
              : ("any_message" as const),
          channel: node.data.channel ?? "any",
          triggerStageKey: undefined,
          ...(botId ? { botId } : {}),
        },
      };
    });
    return { nodes, edges: cleaned.edges, entryId: entry.id };
  }

  if (params.mode === "stage") {
    const cleaned = removeWebhookNodes(params.nodes, params.edges);
    const nodes = cleaned.nodes.map((node) => {
      if (!isFlowEntryNode(node) || node.id !== entry.id) return node;
      return {
        ...node,
        type: "opportunity_stage_trigger" as const,
        data: {
          ...node.data,
          label: params.labels.start,
          triggerType: "opportunity_stage_entered" as const,
          keywords: undefined,
          matchMode: undefined,
          channel: undefined,
          whatsappChannelId: undefined,
          whatsappChannelIds: undefined,
          ...(botId ? { botId } : {}),
        },
      };
    });
    return { nodes, edges: cleaned.edges, entryId: entry.id };
  }

  const entryAsTrigger = params.nodes.map((node) => {
    if (!isFlowEntryNode(node) || node.id !== entry.id) return node;
    return {
      ...node,
      type: "trigger" as const,
      data: {
        ...node.data,
        label: params.labels.start,
        triggerType: "web_form_submitted" as const,
        keywords: undefined,
        matchMode: undefined,
        channel: undefined,
        whatsappChannelId: undefined,
        whatsappChannelIds: undefined,
        triggerStageKey: undefined,
        ...(botId ? { botId } : {}),
      },
    };
  });

  const withWebhook = ensureWebhookAfterEntry(
    entryAsTrigger,
    params.edges,
    entry.id,
    params.labels.webhook
  );

  return {
    nodes: withWebhook.nodes,
    edges: withWebhook.edges,
    entryId: entry.id,
  };
}

export function getFlowEntryDisplayLabel(
  type: FlowNode["type"],
  startLabel: string
): string | null {
  if (
    type === "trigger" ||
    type === "message_received_trigger" ||
    type === "opportunity_stage_trigger"
  ) {
    return startLabel;
  }
  return null;
}
