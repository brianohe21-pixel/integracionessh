import type { BotLocale, FlowEdge, FlowNode, FlowNodeType, LocalizedText } from "@/types";
import { resolveLocalizedText } from "@/lib/localized-text";
import { buildNodePreview } from "@/components/flows/nodeConfig";

export interface FlowPreviewStep {
  nodeId: string;
  type: FlowNodeType;
  title: string;
  detail: string;
  branchLabel?: string;
}

const MAX_STEPS = 40;

function text(value: LocalizedText | undefined, locale: BotLocale): string {
  return resolveLocalizedText(value, locale);
}

function buildStepDetail(
  node: FlowNode,
  locale: BotLocale,
  botNames?: Map<string, string>
): string {
  const names =
    botNames && botNames.size > 0
      ? Object.fromEntries(botNames.entries())
      : undefined;
  return buildNodePreview(
    node.type,
    node.data,
    locale === "en" ? "en" : "es",
    names
  );
}

function resolveBranchLabel(
  node: FlowNode,
  edge: FlowEdge,
  locale: BotLocale,
  branchTrue: string,
  branchFalse: string
): string | undefined {
  if (node.type === "condition") {
    if (edge.sourceHandle === "true") return branchTrue;
    if (edge.sourceHandle === "false") return branchFalse;
  }
  if (node.type === "buttons" && edge.sourceHandle) {
    const button = node.data.buttons?.find((item) => item.id === edge.sourceHandle);
    const label = button ? text(button.title, locale) : "";
    return label || edge.sourceHandle;
  }
  if (node.type === "list" && edge.sourceHandle) {
    const item = node.data.listItems?.find((row) => row.id === edge.sourceHandle);
    const label = item ? text(item.title, locale) : "";
    return label || edge.sourceHandle;
  }
  return undefined;
}

function walkPreview(params: {
  nodeId: string;
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
  visitedPath: Set<string>;
  steps: FlowPreviewStep[];
  locale: BotLocale;
  getTypeLabel: (type: FlowNodeType) => string;
  botNames: Map<string, string>;
  branchTrue: string;
  branchFalse: string;
  branchLabel?: string;
}): void {
  if (params.steps.length >= MAX_STEPS) return;

  const node = params.nodes.get(params.nodeId);
  if (!node) return;
  if (params.visitedPath.has(params.nodeId)) return;

  params.steps.push({
    nodeId: node.id,
    type: node.type,
    title: params.getTypeLabel(node.type),
    detail: buildStepDetail(node, params.locale, params.botNames),
    ...(params.branchLabel ? { branchLabel: params.branchLabel } : {}),
  });

  if (node.type === "end") return;

  const outgoing = params.edges.filter((edge) => edge.source === params.nodeId);
  if (!outgoing.length) return;

  const nextVisited = new Set(params.visitedPath);
  nextVisited.add(params.nodeId);

  for (const edge of outgoing) {
    walkPreview({
      ...params,
      nodeId: edge.target,
      visitedPath: nextVisited,
      branchLabel: resolveBranchLabel(node, edge, params.locale, params.branchTrue, params.branchFalse),
    });
  }
}

export function buildFlowPreviewSteps(params: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  locale: BotLocale;
  getTypeLabel: (type: FlowNodeType) => string;
  botNames?: Record<string, string>;
  branchTrue: string;
  branchFalse: string;
}): FlowPreviewStep[] {
  const trigger = params.nodes.find(
    (node) =>
      node.type === "trigger" ||
      node.type === "message_received_trigger" ||
      node.type === "opportunity_stage_trigger"
  );
  if (!trigger) return [];

  const nodeMap = new Map(params.nodes.map((node) => [node.id, node]));
  const botNames = new Map(Object.entries(params.botNames ?? {}));
  const steps: FlowPreviewStep[] = [];

  walkPreview({
    nodeId: trigger.id,
    nodes: nodeMap,
    edges: params.edges,
    visitedPath: new Set(),
    steps,
    locale: params.locale,
    getTypeLabel: params.getTypeLabel,
    botNames,
    branchTrue: params.branchTrue,
    branchFalse: params.branchFalse,
  });

  return steps;
}
