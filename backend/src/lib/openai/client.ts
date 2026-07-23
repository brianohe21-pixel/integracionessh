import OpenAI from "openai";
import type { Bot, BotLocale, ChatCompletionResult, Message } from "../../types/index.js";
import { messageRequestsHandoff } from "../advisor/keywords.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import {
  createBookingForBot,
  formatBookingConfirmation,
  getBookingSlotsForDate,
  updateBookingStatus,
} from "../calendar/calendar.service.js";
import { getZonedParts } from "../calendar/slot-engine.js";
import type { CalendarConfig } from "../../types/index.js";
import { retrieveContext } from "../knowledge/retrieve.js";
import { getSystemMessage, intlLocaleForBot } from "../i18n/index.js";

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

const MAX_TOOL_ROUNDS = 4;

function buildCalendarContextBlock(config: CalendarConfig, locale: BotLocale): string {
  const now = new Date();
  const parts = getZonedParts(now, config.timezone);
  const intlLocale = intlLocaleForBot(locale);
  const formattedNow = new Intl.DateTimeFormat(intlLocale, {
    timeZone: config.timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  if (locale === "en") {
    return `\n\nCalendar enabled. Current date and time (${config.timezone}): ${formattedNow} (today = ${parts.isoDate}).
Convert "today", "tomorrow", and weekdays to YYYY-MM-DD before calling list_available_slots.
You can book appointments with list_available_slots and create_booking. Use cancel_booking if the customer cancels.
${getSystemMessage("calendarTimeHint", locale)}`;
  }

  return `\n\nCalendario activo. Fecha y hora actual (${config.timezone}): ${formattedNow} (hoy = ${parts.isoDate}).
Convierte "hoy", "mañana" y días de la semana a YYYY-MM-DD antes de llamar list_available_slots.
Puedes agendar citas con list_available_slots y create_booking. Usa cancel_booking si el cliente cancela.
${getSystemMessage("calendarTimeHint", locale)}`;
}

function buildCalendarTools(locale: BotLocale): OpenAI.ChatCompletionTool[] {
  const isEn = locale === "en";
  return [
    {
      type: "function",
      function: {
        name: "list_available_slots",
        description: isEn
          ? "List available time slots for a date in YYYY-MM-DD (calendar timezone). Convert relative dates like tomorrow before calling."
          : "Lista horarios disponibles para una fecha en YYYY-MM-DD (zona horaria del calendario). Convierte fechas relativas como mañana antes de llamar.",
        parameters: {
          type: "object",
          properties: {
            date: {
              type: "string",
              description: isEn ? "ISO date YYYY-MM-DD" : "Fecha ISO YYYY-MM-DD",
            },
          },
          required: ["date"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "create_booking",
        description: isEn ? "Create a booking at an available slot" : "Crea una reserva en un horario disponible",
        parameters: {
          type: "object",
          properties: {
            startAt: {
              type: "string",
              description: isEn ? "Slot start in ISO 8601 UTC" : "Inicio en ISO 8601 UTC del slot elegido",
            },
            contactName: {
              type: "string",
              description: isEn ? "Contact name" : "Nombre del contacto",
            },
          },
          required: ["startAt"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "cancel_booking",
        description: isEn ? "Cancel an existing booking" : "Cancela una reserva existente",
        parameters: {
          type: "object",
          properties: {
            bookingId: {
              type: "string",
              description: isEn ? "Booking ID" : "ID de la reserva",
            },
          },
          required: ["bookingId"],
        },
      },
    },
  ];
}

async function executeCalendarToolCall(params: {
  toolCall: OpenAI.ChatCompletionMessageToolCall;
  tenantId: string;
  botId: string;
  calendarConfig: CalendarConfig;
  calendarContext: ChatCalendarContext;
  locale: BotLocale;
}): Promise<string> {
  const { toolCall, tenantId, botId, calendarConfig, calendarContext, locale } = params;
  if (toolCall.type !== "function") {
    return JSON.stringify({ error: "Unsupported tool call" });
  }

  if (toolCall.function.name === "list_available_slots") {
    const parsed = JSON.parse(toolCall.function.arguments) as { date?: string };
    if (!parsed.date) {
      return JSON.stringify({ error: "date is required in YYYY-MM-DD format" });
    }
    const slots = await getBookingSlotsForDate({
      tenantId,
      botId,
      isoDate: parsed.date,
    });
    return JSON.stringify({
      date: parsed.date,
      timezone: calendarConfig.timezone,
      slots: slots.map((slot) => ({ label: slot.label, startAt: slot.startAt })),
      count: slots.length,
      ...(slots.length === 0
        ? {
            hint: getSystemMessage("calendarDateHint", locale),
          }
        : {}),
    });
  }

  if (toolCall.function.name === "create_booking") {
    const parsed = JSON.parse(toolCall.function.arguments) as {
      startAt?: string;
      contactName?: string;
    };
    if (!parsed.startAt) {
      return JSON.stringify({ error: "startAt is required" });
    }
    const result = await createBookingForBot({
      tenantId,
      botId,
      startAt: parsed.startAt,
      contactPhone: calendarContext.contactPhone,
      conversationId: calendarContext.conversationId,
      ...(parsed.contactName ? { contactName: parsed.contactName } : {}),
      source: "openai",
    });
    const booking = result.booking;
    const label = formatBookingConfirmation(booking, calendarConfig);
    return JSON.stringify({
      success: true,
      bookingId: booking.bookingId,
      label,
      paymentRequired: Boolean(result.payment),
    });
  }

  if (toolCall.function.name === "cancel_booking") {
    const parsed = JSON.parse(toolCall.function.arguments) as { bookingId?: string };
    if (!parsed.bookingId) {
      return JSON.stringify({ error: "bookingId is required" });
    }
    await updateBookingStatus({
      tenantId,
      botId,
      bookingId: parsed.bookingId,
      status: "cancelled",
    });
    return JSON.stringify({ success: true, bookingId: parsed.bookingId });
  }

  return JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
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
  calendarContext?: ChatCalendarContext,
  locale: BotLocale = "es"
): Promise<ChatCompletionResult> {
  if (messageRequestsHandoff(userMessage)) {
    return {
      reply: null,
      handoff: true,
      handoffReason: getSystemMessage("handoffRequestedReason", locale),
    };
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
    ? locale === "en"
      ? `\n\nBusiness context:\n${knowledgeContext}`
      : `\n\nContexto del negocio:\n${knowledgeContext}`
    : "";
  const calendarBlock =
    calendarEnabled && calendarConfig
      ? buildCalendarContextBlock(calendarConfig, locale)
      : "";
  const languageInstruction =
    locale === "en"
      ? getSystemMessage("respondInEnglish", locale)
      : getSystemMessage("respondInSpanish", locale);
  const systemPrompt =
    basePrompt +
    contextBlock +
    calendarBlock +
    `\n\n${languageInstruction}\n\n${getSystemMessage("handoffToolInstruction", locale)}`;
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
        description: getSystemMessage("transferToHumanDescription", locale),
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: getSystemMessage("transferToHumanReason", locale),
            },
          },
          required: ["reason"],
        },
      },
    },
  ];

  if (calendarEnabled) {
    tools.push(...buildCalendarTools(locale));
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      tools,
      tool_choice: "auto",
    });

    const choice = completion.choices[0]?.message;
    if (!choice) throw new Error("Empty response from OpenAI");

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      if (!choice.content) throw new Error("Empty response from OpenAI");
      return { reply: choice.content, handoff: false };
    }

    messages.push(choice);

    for (const toolCall of toolCalls) {
      if (toolCall.type === "function" && toolCall.function.name === "transfer_to_human") {
        let reason = getSystemMessage("handoffRequestedReason", locale);
        try {
          const parsed = JSON.parse(toolCall.function.arguments) as { reason?: string };
          if (parsed.reason?.trim()) reason = parsed.reason.trim();
        } catch {
          // use default reason
        }
        return { reply: null, handoff: true, handoffReason: reason };
      }

      if (
        toolCall.type === "function" &&
        tenantId &&
        calendarContext &&
        calendarEnabled &&
        calendarConfig
      ) {
        const toolResult = await executeCalendarToolCall({
          toolCall,
          tenantId,
          botId: bot.botId,
          calendarConfig,
          calendarContext,
          locale,
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: toolResult,
        });
        continue;
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: "Tool not available" }),
      });
    }
  }

  throw new Error("Tool loop exceeded maximum rounds");
}
