import OpenAI from "openai";
import type { Bot, Message } from "../../types/index.js";
import { getOpenAIApiKey } from "../openai/client.js";
import { retrieveContext } from "../knowledge/retrieve.js";

export const COPILOT_INTENTS = [
  "consulta",
  "soporte",
  "ventas",
  "reclamo",
  "agendamiento",
  "seguimiento",
  "otro",
] as const;

export type CopilotIntent = (typeof COPILOT_INTENTS)[number];

export interface IntentAnalysis {
  intent: CopilotIntent;
  confidence: number;
  topics: string[];
}

export interface ConversationSummary {
  summary: string;
  keyPoints: string[];
}

export interface AdvisorReplySuggestion {
  suggestion: string;
  sources: string[];
}

export interface CopilotInsights {
  detectedIntent: string;
  copilotSummary: string;
  intentDetails: IntentAnalysis;
  summaryDetails: ConversationSummary;
}

function mapHistoryRole(msg: Message): "user" | "assistant" | null {
  if (msg.role === "user") return "user";
  if (msg.role === "assistant" || msg.role === "advisor") return "assistant";
  return null;
}

export function formatConversationHistory(messages: Message[]): string {
  const lines: string[] = [];
  for (const msg of messages.slice(-50)) {
    const role = mapHistoryRole(msg);
    if (!role) continue;
    const label = role === "user" ? "Cliente" : "Asistente/Asesor";
    lines.push(`${label}: ${msg.content}`);
  }
  return lines.join("\n");
}

export function buildRagQuery(messages: Message[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content);
  if (userMessages.length > 0) return userMessages.join("\n");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.content ?? "";
}

export function normalizeIntent(intent: string | undefined): CopilotIntent {
  const normalized = intent?.trim().toLowerCase() ?? "";
  if (COPILOT_INTENTS.includes(normalized as CopilotIntent)) {
    return normalized as CopilotIntent;
  }
  return "otro";
}

function buildAdvisorSystemBase(bot: Bot): string {
  const base = bot.systemPrompt ?? "";
  return `Eres un asistente interno para asesores humanos. Nunca escribes al cliente directamente; ayudas al asesor a entender y responder.
Tono: profesional, conciso y util.
Contexto del negocio (instrucciones del bot):
${base}`;
}

async function getKnowledgeContext(
  bot: Bot,
  tenantId: string,
  messages: Message[],
  apiKey: string
): Promise<string> {
  if (!bot.knowledgeEnabled) return "";
  const query = buildRagQuery(messages);
  if (!query) return "";
  return retrieveContext(tenantId, bot.botId, query, apiKey);
}

async function completeJson<T>(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const client = new OpenAI({ apiKey });
  const completion = await client.chat.completions.create({
    model,
    temperature: 0.3,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");
  return JSON.parse(content) as T;
}

export async function analyzeConversationIntent(params: {
  bot: Bot;
  messages: Message[];
  tenantId: string;
  environment: string;
}): Promise<IntentAnalysis> {
  const apiKey = await getOpenAIApiKey(params.tenantId, params.environment);
  const model = params.bot.model ?? "gpt-4o-mini";
  const history = formatConversationHistory(params.messages);

  const systemPrompt = `${buildAdvisorSystemBase(params.bot)}

Clasifica la intencion principal del cliente en una de estas categorias: consulta, soporte, ventas, reclamo, agendamiento, seguimiento, otro.
Responde en JSON con: intent (string), confidence (numero 0-1), topics (array de strings cortos).`;

  const result = await completeJson<{
    intent?: string;
    confidence?: number;
    topics?: string[];
  }>(apiKey, model, systemPrompt, `Historial:\n${history}`);

  return {
    intent: normalizeIntent(result.intent),
    confidence:
      typeof result.confidence === "number"
        ? Math.min(1, Math.max(0, result.confidence))
        : 0.5,
    topics: Array.isArray(result.topics)
      ? result.topics.filter((t): t is string => typeof t === "string").slice(0, 5)
      : [],
  };
}

export async function summarizeConversation(params: {
  bot: Bot;
  messages: Message[];
  tenantId: string;
  environment: string;
}): Promise<ConversationSummary> {
  const apiKey = await getOpenAIApiKey(params.tenantId, params.environment);
  const model = params.bot.model ?? "gpt-4o-mini";
  const history = formatConversationHistory(params.messages);
  const knowledgeContext = await getKnowledgeContext(
    params.bot,
    params.tenantId,
    params.messages,
    apiKey
  );

  const knowledgeBlock = knowledgeContext
    ? `\n\nContexto del negocio (knowledge base):\n${knowledgeContext}`
    : "";

  const systemPrompt = `${buildAdvisorSystemBase(params.bot)}${knowledgeBlock}

Resume la conversacion para que un asesor humano entienda rapidamente el contexto.
Responde en JSON con: summary (string de 2-4 oraciones), keyPoints (array de 3-5 puntos clave).`;

  const result = await completeJson<{
    summary?: string;
    keyPoints?: string[];
  }>(apiKey, model, systemPrompt, `Historial:\n${history}`);

  return {
    summary: result.summary?.trim() || "Sin resumen disponible.",
    keyPoints: Array.isArray(result.keyPoints)
      ? result.keyPoints.filter((p): p is string => typeof p === "string").slice(0, 5)
      : [],
  };
}

export async function suggestAdvisorReply(params: {
  bot: Bot;
  messages: Message[];
  tenantId: string;
  environment: string;
  advisorName?: string;
}): Promise<AdvisorReplySuggestion> {
  const apiKey = await getOpenAIApiKey(params.tenantId, params.environment);
  const model = params.bot.model ?? "gpt-4o-mini";
  const history = formatConversationHistory(params.messages);
  const knowledgeContext = await getKnowledgeContext(
    params.bot,
    params.tenantId,
    params.messages,
    apiKey
  );

  const knowledgeBlock = knowledgeContext
    ? `\n\nContexto del negocio (knowledge base):\n${knowledgeContext}`
    : "";
  const advisorBlock = params.advisorName
    ? `\nEl asesor se llama ${params.advisorName}.`
    : "";

  const systemPrompt = `${buildAdvisorSystemBase(params.bot)}${knowledgeBlock}${advisorBlock}

Sugiere una respuesta que el asesor pueda enviar al cliente. La respuesta debe ser clara, empatica y alineada con las politicas del negocio.
Responde en JSON con: suggestion (string con el texto sugerido), sources (array de strings describiendo que informacion usaste, ej. "historial", "knowledge base").`;

  const result = await completeJson<{
    suggestion?: string;
    sources?: string[];
  }>(apiKey, model, systemPrompt, `Historial:\n${history}`);

  return {
    suggestion: result.suggestion?.trim() || "",
    sources: Array.isArray(result.sources)
      ? result.sources.filter((s): s is string => typeof s === "string").slice(0, 5)
      : [],
  };
}

export async function generateCopilotInsights(params: {
  bot: Bot;
  messages: Message[];
  tenantId: string;
  environment: string;
}): Promise<CopilotInsights> {
  const [intentDetails, summaryDetails] = await Promise.all([
    analyzeConversationIntent(params),
    summarizeConversation(params),
  ]);

  return {
    detectedIntent: intentDetails.intent,
    copilotSummary: summaryDetails.summary,
    intentDetails,
    summaryDetails,
  };
}
