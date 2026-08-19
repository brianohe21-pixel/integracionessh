import { getOpenAIApiKey } from "../ai/providers/openai.js";
import { OpenAIProvider } from "../ai/providers/openai.js";
import type { BotLocale, CallRecord, TelephonyStructuredOutputDefinition } from "../../types/index.js";
import { getCallTranscriptMessages } from "./transcript.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const EXTRACTION_MODEL = "gpt-4o-mini";

function buildTranscript(
  messages: Awaited<ReturnType<typeof getCallTranscriptMessages>>,
  locale: BotLocale
): string {
  const userLabel = locale === "en" ? "User" : "Usuario";
  const assistantLabel = locale === "en" ? "Assistant" : "Asistente";

  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => {
      const label = message.role === "user" ? userLabel : assistantLabel;
      return `${label}: ${message.content.trim()}`;
    })
    .join("\n");
}

function extractWithRegex(
  transcript: string,
  patterns: Record<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [field, pattern] of Object.entries(patterns)) {
    try {
      const regex = new RegExp(pattern, "i");
      const match = transcript.match(regex);
      if (!match) continue;
      result[field] = match[1] !== undefined && match[1] !== "" ? match[1] : match[0];
    } catch (error) {
      console.error(`Invalid regex for field ${field}:`, error);
    }
  }

  return result;
}

export async function extractCallStructuredOutputs(params: {
  tenantId: string;
  call: CallRecord;
  definition: TelephonyStructuredOutputDefinition;
  locale: BotLocale;
}): Promise<Record<string, unknown> | null> {
  const messages = await getCallTranscriptMessages(params.tenantId, params.call);
  const transcript = buildTranscript(messages, params.locale);
  if (!transcript.trim()) return null;

  if (params.definition.type === "regex" && params.definition.patterns) {
    const result = extractWithRegex(transcript, params.definition.patterns);
    return Object.keys(result).length > 0 ? result : null;
  }

  if (!params.definition.schema) return null;

  const apiKey = await getOpenAIApiKey(params.tenantId, ENVIRONMENT);
  const provider = new OpenAIProvider();
  const schemaJson = JSON.stringify(params.definition.schema);
  const descriptionBlock = params.definition.description
    ? `\nContext: ${params.definition.description}`
    : "";

  const systemPrompt =
    params.locale === "en"
      ? `Extract structured data from the phone call transcript.${descriptionBlock}\nReturn JSON matching this JSON Schema exactly:\n${schemaJson}\nUse null for missing optional values.`
      : `Extrae datos estructurados de la transcripción de la llamada.${descriptionBlock}\nDevuelve JSON que coincida exactamente con este JSON Schema:\n${schemaJson}\nUsa null para valores opcionales faltantes.`;

  try {
    return await provider.completeJson<Record<string, unknown>>({
      apiKey,
      modelId: EXTRACTION_MODEL,
      systemPrompt,
      userPrompt: transcript,
      temperature: 0.1,
      maxTokens: 2048,
    });
  } catch (error) {
    console.error("Failed to extract call structured outputs:", error);
    return null;
  }
}
