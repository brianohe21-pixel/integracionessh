import OpenAI from "openai";
import type { Bot, ChatCompletionResult, Message } from "../../types/index.js";
import { messageRequestsHandoff } from "../advisor/keywords.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import {
  createBookingForBot,
  formatBookingConfirmation,
  getBookingSlotsForDate,
  updateBookingStatus,
} from "../calendar/calendar.service.js";
import { retrieveContext } from "../knowledge/retrieve.js";

export interface ChatCalendarContext {
  contactPhone: string;
  conversationId: string;
}

let openaiClient: OpenAI | null = null;

function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient || openaiClient.apiKey !== apiKey) {
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export async function getOpenAIApiKey(
  tenantId: string,
  environment: string
): Promise<string> {
  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );

  const client = new SecretsManagerClient({});

  try {
    const command = new GetSecretValueCommand({
      SecretId: `/${environment}/tenants/${tenantId}/openai`,
    });
    const response = await client.send(command);
    const secret = JSON.parse(response.SecretString ?? "{}") as { apiKey: string };
    if (secret.apiKey) return secret.apiKey;
  } catch {
    // Fall through to platform key
  }

  const platformKey = process.env.OPENAI_API_KEY;
  if (!platformKey) throw new Error("No OpenAI API key configured");
  return platformKey;
}

function mapHistoryRole(msg: Message): "user" | "assistant" | null {
  if (msg.role === "user") return "user";
  if (msg.role === "assistant" || msg.role === "advisor") return "assistant";
  return null;
}

export async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const client = getOpenAIClient(apiKey);
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000),
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("Empty embedding from OpenAI");
  return embedding;
}

export async function generateChatResponse(
  bot: Bot,
  conversationHistory: Message[],
  userMessage: string,
  apiKey: string,
  tenantId?: string,
  calendarContext?: ChatCalendarContext
): Promise<ChatCompletionResult> {
  if (messageRequestsHandoff(userMessage)) {
    return { reply: null, handoff: true, handoffReason: "El cliente solicitó un asesor" };
  }

  const client = getOpenAIClient(apiKey);

  let knowledgeContext = "";
  if (bot.knowledgeEnabled && tenantId) {
    knowledgeContext = await retrieveContext(tenantId, bot.botId, userMessage, apiKey);
  }

  const calendarConfig =
    tenantId && calendarContext
      ? await getCalendarConfig(tenantId, bot.botId)
      : null;
  const calendarEnabled = calendarConfig?.enabled ?? false;

  const basePrompt = bot.systemPrompt ?? "";
  const contextBlock = knowledgeContext
    ? `\n\nContexto del negocio:\n${knowledgeContext}`
    : "";
  const calendarBlock = calendarEnabled
    ? "\n\nPuedes agendar citas con list_available_slots y create_booking. Usa cancel_booking si el cliente cancela."
    : "";
  const systemPrompt =
    basePrompt +
    contextBlock +
    calendarBlock +
    "\n\nSi el cliente necesita hablar con un asesor, usa la herramienta transfer_to_human.";
  const model = bot.model ?? "gpt-4o-mini";
  const temperature = bot.temperature ?? 0.7;
  const maxTokens = bot.maxTokens ?? 1024;

  const historyMessages: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of conversationHistory.slice(-20)) {
    const role = mapHistoryRole(msg);
    if (!role) continue;
    historyMessages.push({ role, content: msg.content });
  }

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...historyMessages,
    { role: "user", content: userMessage },
  ];

  const tools: OpenAI.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "transfer_to_human",
        description: "Transfiere la conversación a un asesor",
        parameters: {
          type: "object",
          properties: {
            reason: { type: "string", description: "Por qué el cliente necesita un asesor" },
          },
          required: ["reason"],
        },
      },
    },
  ];

  if (calendarEnabled) {
    tools.push(
      {
        type: "function",
        function: {
          name: "list_available_slots",
          description: "Lista horarios disponibles para una fecha (YYYY-MM-DD)",
          parameters: {
            type: "object",
            properties: {
              date: { type: "string", description: "Fecha ISO YYYY-MM-DD" },
            },
            required: ["date"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_booking",
          description: "Crea una reserva en un horario disponible",
          parameters: {
            type: "object",
            properties: {
              startAt: { type: "string", description: "Inicio en ISO 8601 UTC" },
              contactName: { type: "string", description: "Nombre del contacto" },
            },
            required: ["startAt"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "cancel_booking",
          description: "Cancela una reserva existente",
          parameters: {
            type: "object",
            properties: {
              bookingId: { type: "string", description: "ID de la reserva" },
            },
            required: ["bookingId"],
          },
        },
      }
    );
  }

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    tools,
    tool_choice: "auto",
  });

  const choice = completion.choices[0]?.message;
  const toolCall = choice?.tool_calls?.[0];

  if (toolCall?.type === "function" && tenantId && calendarContext && calendarEnabled) {
    if (toolCall.function.name === "list_available_slots") {
      const parsed = JSON.parse(toolCall.function.arguments) as { date?: string };
      if (parsed.date) {
        const slots = await getBookingSlotsForDate({
          tenantId,
          botId: bot.botId,
          isoDate: parsed.date,
        });
        const slotText =
          slots.length === 0
            ? "No hay horarios disponibles."
            : slots.map((s) => `${s.label} (${s.startAt})`).join(", ");
        return { reply: slotText, handoff: false };
      }
    }
    if (toolCall.function.name === "create_booking") {
      const parsed = JSON.parse(toolCall.function.arguments) as {
        startAt?: string;
        contactName?: string;
      };
      if (parsed.startAt) {
        const result = await createBookingForBot({
          tenantId,
          botId: bot.botId,
          startAt: parsed.startAt,
          contactPhone: calendarContext.contactPhone,
          conversationId: calendarContext.conversationId,
          ...(parsed.contactName ? { contactName: parsed.contactName } : {}),
          source: "openai",
        });
        const booking = result.booking;
        const label = formatBookingConfirmation(booking, calendarConfig!);
        const paymentNote = result.payment
          ? " Te enviamos un link de pago por WhatsApp para confirmar la reserva."
          : "";
        return {
          reply: `Cita agendada para ${label}.${paymentNote} ID: ${booking.bookingId}`,
          handoff: false,
        };
      }
    }
    if (toolCall.function.name === "cancel_booking") {
      const parsed = JSON.parse(toolCall.function.arguments) as { bookingId?: string };
      if (parsed.bookingId) {
        await updateBookingStatus({
          tenantId,
          botId: bot.botId,
          bookingId: parsed.bookingId,
          status: "cancelled",
        });
        return { reply: "La reserva fue cancelada.", handoff: false };
      }
    }
  }

  if (toolCall?.type === "function" && toolCall.function.name === "transfer_to_human") {
    let reason = "El cliente solicitó un asesor";
    try {
      const parsed = JSON.parse(toolCall.function.arguments) as { reason?: string };
      if (parsed.reason?.trim()) reason = parsed.reason.trim();
    } catch {
      // use default reason
    }
    return { reply: null, handoff: true, handoffReason: reason };
  }

  const content = choice?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return { reply: content, handoff: false };
}
