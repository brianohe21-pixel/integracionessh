import type { BotLocale, FlowDefinition, FlowNode } from "../../types/index.js";
import { isDemoModeEnabled } from "./voice-http-demo-fallback.js";
import { getOutgoingEdges } from "./graph.js";

export interface CompiledVoiceFlowTool {
  nodeId: string;
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface CompiledVoiceFlow {
  flowId: string;
  flowName: string;
  instructions: string;
  tools: CompiledVoiceFlowTool[];
  openAiTools: Array<Record<string, unknown>>;
  hasHandoff: boolean;
  variables: Record<string, string>;
  toolNodeByName: Record<string, string>;
}

function localizedText(value: unknown, locale: BotLocale): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, string>;
    return record[locale] ?? record.es ?? record.en ?? "";
  }
  return "";
}

function parseToolParameters(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) {
    return { type: "object", properties: {} };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.type === "object") return parsed;
    return { type: "object", properties: parsed };
  } catch {
    return { type: "object", properties: {} };
  }
}

function collectReachableNodes(flow: FlowDefinition): FlowNode[] {
  const trigger = flow.nodes.find((node) => node.type === "trigger");
  if (!trigger) return [];
  const visited = new Set<string>();
  const queue = [trigger.id];
  const ordered: FlowNode[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);
    const node = flow.nodes.find((item) => item.id === currentId);
    if (!node) continue;
    ordered.push(node);
    for (const edge of getOutgoingEdges(flow, currentId)) {
      queue.push(edge.target);
    }
  }

  return ordered;
}

function buildLocaleContext(variables: Record<string, string>, locale: BotLocale): string[] {
  const city = variables.default_city?.trim();
  if (!city) return [];

  return [
    locale === "en"
      ? `Default city is ${city}. Use it internally for addresses; do not mention the city or country unless the caller asks.`
      : `Ciudad por defecto: ${city}. Úsala internamente para direcciones; no menciones la ciudad ni el país salvo que el cliente pregunte.`,
  ];
}

function buildStepInstructions(flow: FlowDefinition, locale: BotLocale): string[] {
  const steps: string[] = [];
  for (const node of collectReachableNodes(flow)) {
    if (node.type === "message") {
      const text = localizedText(node.data.messageText, locale).trim();
      if (text) steps.push(`- ${text}`);
    }
    if (node.type === "http_request" && node.data.voiceInstruction?.trim()) {
      const toolName = node.data.voiceToolName?.trim() || node.id;
      steps.push(`- ${node.data.voiceInstruction.trim()} Usa la herramienta ${toolName}.`);
    }
    if (node.type === "handoff") {
      steps.push("- Si el cliente pide operador o no puedes resolver, usa transfer_to_human.");
    }
  }
  return steps;
}

export function isVoiceAiFlow(flow: FlowDefinition): boolean {
  if (flow.flowKind === "voice_ai") return true;
  const trigger = flow.nodes.find((node) => node.type === "trigger");
  return trigger?.data.triggerType === "voice_call";
}

export function compileVoiceFlow(flow: FlowDefinition, locale: BotLocale): CompiledVoiceFlow | null {
  if (!isVoiceAiFlow(flow)) return null;

  const trigger = flow.nodes.find((node) => node.type === "trigger");
  const variables = { ...(trigger?.data.flowVariables ?? {}) };
  const steps = buildStepInstructions(flow, locale);
  const tools: CompiledVoiceFlowTool[] = [];
  const toolNodeByName: Record<string, string> = {};
  let hasHandoff = false;

  for (const node of flow.nodes) {
    if (node.type === "handoff") hasHandoff = true;
    if (node.type !== "http_request") continue;
    const name = node.data.voiceToolName?.trim();
    if (!name) continue;
    tools.push({
      nodeId: node.id,
      name,
      description: node.data.voiceToolDescription?.trim() || node.data.label || name,
      parameters: parseToolParameters(node.data.voiceToolParameters),
    });
    toolNodeByName[name] = node.id;
  }

  const intro =
    locale === "en"
      ? `You are the voice agent for ${flow.name}. Follow this call flow and use tools when needed.`
      : `Eres el agente de voz de ${flow.name}. Sigue este flujo de llamada y usa herramientas cuando sea necesario.`;

  const demoBlock = isDemoModeEnabled(variables)
    ? locale === "en"
      ? [
          "If a tool returns no useful data, continue the presentation naturally.",
          "Simulate realistic fare, ETA, driver assignment and trip tracking. Do not mention technical errors.",
          "Accept addresses as the caller says them. Do not ask them to pick between options or repeat confirmations.",
          "If autocomplete returns one match, use it immediately and continue.",
          "Once you have origin and destination, quote the fare and confirm the trip without extra back-and-forth.",
          "Say trip status in Spanish (pendiente, en camino, finalizado). Never say PENDING, IN_PROGRESS, or COMPLETED.",
          "After creating the trip, simulate an assigned driver and confirm the trip with name, vehicle, and plate.",
        ]
      : [
          "Si una herramienta no devuelve datos útiles, continúa la presentación de forma natural.",
          "Simula tarifa, tiempo de llegada, conductor asignado y seguimiento del viaje de manera realista. No menciones errores técnicos.",
          "Acepta las direcciones tal como las diga el cliente. No le pidas elegir entre opciones ni repetir confirmaciones.",
          "Si autocomplete devuelve una coincidencia, úsala de inmediato y continúa.",
          "Con origen y destino, comunica la tarifa y confirma el viaje sin dar más vueltas.",
          "Di los estados del viaje en español (pendiente, en camino, finalizado). Nunca digas PENDING, IN_PROGRESS ni COMPLETED.",
          "Tras crear el viaje, simula conductor asignado y confirma el viaje con nombre, vehículo y placa.",
        ]
    : [];

  const localeBlock = buildLocaleContext(variables, locale);

  const instructions = [
    intro,
    ...(localeBlock.length > 0 ? ["", ...localeBlock] : []),
    "",
    ...steps,
    ...(demoBlock.length > 0 ? ["", ...demoBlock] : []),
  ].join("\n");
  const openAiTools: Array<Record<string, unknown>> = tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));

  return {
    flowId: flow.flowId,
    flowName: flow.name,
    instructions,
    tools,
    openAiTools,
    hasHandoff,
    variables,
    toolNodeByName,
  };
}

export function findVoiceFlowForBot(
  flows: FlowDefinition[],
  preferredFlowId?: string
): FlowDefinition | null {
  const voiceFlows = flows.filter((flow) => flow.enabled && isVoiceAiFlow(flow));
  if (preferredFlowId) {
    const preferred = voiceFlows.find((flow) => flow.flowId === preferredFlowId);
    if (preferred) return preferred;
  }
  return voiceFlows[0] ?? null;
}

export function findEnabledVoiceFlowForBot(flows: FlowDefinition[]): FlowDefinition | null {
  return findVoiceFlowForBot(flows);
}
