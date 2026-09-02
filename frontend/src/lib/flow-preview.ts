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

function buildStepDetail(node: FlowNode, locale: BotLocale, botName?: string): string {
  const d = node.data;

  switch (node.type) {
    case "trigger": {
      const triggerType = d.triggerType ?? "any_message";
      if (triggerType === "web_form_submitted") {
        const keys = Object.keys(d.formSamplePayload ?? {});
        return keys.length ? keys.join(", ") : "webhook";
      }
      if (triggerType === "keyword" && d.keywords?.length) {
        return d.keywords.join(", ");
      }
      return triggerType;
    }
    case "message":
      return text(d.messageText, locale);
    case "buttons": {
      const prompt = text(d.messageText, locale);
      const labels = (d.buttons ?? [])
        .map((btn) => text(btn.title, locale))
        .filter(Boolean)
        .join(" · ");
      return labels ? `${prompt}\n→ ${labels}` : prompt;
    }
    case "condition":
      return `${d.conditionVariable ?? "last_input"} ${d.conditionOperator ?? "contains"} ${d.conditionValue ?? ""}`.trim();
    case "assign_bot":
      return botName ?? d.botId ?? "";
    case "save_contact":
      return [d.contactPhoneBinding, d.contactNameBinding, d.contactEmailBinding].filter(Boolean).join(" · ");
    case "create_lead":
      return [d.leadPhoneBinding, d.leadNameBinding, d.leadEmailBinding].filter(Boolean).join(" · ");
    case "create_opportunity":
      return [d.opportunityTitleBinding, d.opportunityAmountBinding, d.opportunityPhoneBinding].filter(Boolean).join(" · ");
    case "send_notification": {
      const recipients =
        d.notificationRecipientBindings?.filter((item) => item.trim()).join(", ") ||
        d.notificationRecipientBinding ||
        "";
      return [d.notificationChannel, recipients].filter(Boolean).join(" → ");
    }
    case "http_request":
      return `${d.httpMethod ?? "GET"} ${d.httpUrl ?? ""}`.trim();
    case "webhook":
      return locale === "es" ? "Recibir JSON externo" : "Receive external JSON";
    case "delay":
      return `${d.delaySeconds ?? 5}s`;
    case "set_variable":
      return d.variableName ? `${d.variableName} = ${d.variableValue ?? ""}` : "";
    case "end":
      return "";
    default:
      return buildNodePreview(node.type, d, locale);
  }
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

  const botName = node.type === "assign_bot" && node.data.botId
    ? params.botNames.get(node.data.botId)
    : undefined;

  params.steps.push({
    nodeId: node.id,
    type: node.type,
    title: params.getTypeLabel(node.type),
    detail: buildStepDetail(node, params.locale, botName),
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
  const trigger = params.nodes.find((node) => node.type === "trigger");
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
