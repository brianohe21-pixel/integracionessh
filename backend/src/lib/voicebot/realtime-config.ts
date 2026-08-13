import type { Bot, BotLocale } from "../../types/index.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { getZonedParts } from "../calendar/slot-engine.js";
import { getSystemMessage, intlLocaleForBot } from "../i18n/index.js";
import { loadVoiceFlowRuntime } from "../flow/voice-flow-runtime.js";
import {
  DEFAULT_REALTIME_MODEL_ID,
  resolveRealtimeModelId,
} from "./realtime-models.js";

export const DEFAULT_VOICEBOT_MODEL = DEFAULT_REALTIME_MODEL_ID;
export const DEFAULT_VOICEBOT_VOICE = "alloy";

const VOICEBOT_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "sage",
  "shimmer",
  "verse",
] as const;

export function resolveVoicebotVoice(voice?: string): string {
  if (voice && VOICEBOT_VOICES.includes(voice as (typeof VOICEBOT_VOICES)[number])) {
    return voice;
  }
  return DEFAULT_VOICEBOT_VOICE;
}

export function resolveVoicebotModel(model?: string): string {
  return resolveRealtimeModelId(model);
}

async function buildCalendarInstructions(
  tenantId: string,
  botId: string,
  locale: BotLocale
): Promise<string> {
  const config = await getCalendarConfig(tenantId, botId);
  if (!config?.enabled) return "";

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
You can book appointments with list_available_slots and create_booking. Use cancel_booking if the customer cancels.
${getSystemMessage("calendarTimeHint", locale)}`;
  }

  return `\n\nCalendario activo. Fecha y hora actual (${config.timezone}): ${formattedNow} (hoy = ${parts.isoDate}).
Puedes agendar citas con list_available_slots y create_booking. Usa cancel_booking si el cliente cancela.
${getSystemMessage("calendarTimeHint", locale)}`;
}

export async function buildVoicebotInstructions(params: {
  bot: Bot;
  tenantId: string;
  locale: BotLocale;
  handoffEnabled?: boolean;
}): Promise<string> {
  const { bot, tenantId, locale } = params;
  const handoffEnabled = params.handoffEnabled === true;
  const basePrompt = bot.voicebotSystemPrompt?.trim() || bot.systemPrompt?.trim() || "";
  const languageInstruction =
    locale === "en"
      ? getSystemMessage("respondInEnglish", locale)
      : getSystemMessage("respondInSpanish", locale);
  const calendarBlock = await buildCalendarInstructions(tenantId, bot.botId, locale);
  const knowledgeHint =
    locale === "en"
      ? "\n\nUse search_knowledge when you need business-specific information."
      : "\n\nUsa search_knowledge cuando necesites información específica del negocio.";
  const handoffInstruction = handoffEnabled
    ? getSystemMessage("handoffToolInstruction", locale)
    : getSystemMessage("telephonyHandoffDisabledInstruction", locale);

  return `${basePrompt}${calendarBlock}${knowledgeHint}\n\n${languageInstruction}\n\n${handoffInstruction}`;
}

export function buildVoicebotTools(params: {
  locale: BotLocale;
  knowledgeEnabled: boolean;
  calendarEnabled: boolean;
  handoffEnabled?: boolean;
}): Array<Record<string, unknown>> {
  const { locale, knowledgeEnabled, calendarEnabled } = params;
  const handoffEnabled = params.handoffEnabled === true;
  const isEn = locale === "en";
  const tools: Array<Record<string, unknown>> = [];

  if (handoffEnabled) {
    tools.push({
      type: "function",
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
    });
  }

  if (knowledgeEnabled) {
    tools.push({
      type: "function",
      name: "search_knowledge",
      description: isEn
        ? "Search the business knowledge base for relevant information"
        : "Busca en la base de conocimiento del negocio información relevante",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: isEn ? "Search query" : "Consulta de búsqueda",
          },
        },
        required: ["query"],
      },
    });
  }

  if (calendarEnabled) {
    tools.push(
      {
        type: "function",
        name: "list_available_slots",
        description: isEn
          ? "List available time slots for a date in YYYY-MM-DD"
          : "Lista horarios disponibles para una fecha en YYYY-MM-DD",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["date"],
        },
      },
      {
        type: "function",
        name: "create_booking",
        description: isEn ? "Create a booking at an available slot" : "Crea una reserva en un horario disponible",
        parameters: {
          type: "object",
          properties: {
            startAt: { type: "string" },
            contactName: { type: "string" },
          },
          required: ["startAt"],
        },
      },
      {
        type: "function",
        name: "cancel_booking",
        description: isEn ? "Cancel an existing booking" : "Cancela una reserva existente",
        parameters: {
          type: "object",
          properties: {
            bookingId: { type: "string" },
          },
          required: ["bookingId"],
        },
      }
    );
  }

  return tools;
}

export async function buildRealtimeSessionConfig(params: {
  bot: Bot;
  tenantId: string;
  locale: BotLocale;
}): Promise<Record<string, unknown>> {
  const voiceRuntime = await loadVoiceFlowRuntime({
    tenantId: params.tenantId,
    botId: params.bot.botId,
    locale: params.locale,
  });

  const calendarConfig = await getCalendarConfig(params.tenantId, params.bot.botId);
  const handoffEnabled = voiceRuntime?.hasHandoff ?? Boolean(params.bot.telephonyHandoffEnabled);
  const instructions =
    voiceRuntime?.instructions ??
    await buildVoicebotInstructions({
      bot: params.bot,
      tenantId: params.tenantId,
      locale: params.locale,
      handoffEnabled,
    });
  const tools =
    voiceRuntime?.tools ??
    buildVoicebotTools({
      locale: params.locale,
      knowledgeEnabled: Boolean(params.bot.knowledgeEnabled),
      calendarEnabled: Boolean(calendarConfig?.enabled),
      handoffEnabled,
    });

  return {
    type: "realtime",
    model: resolveVoicebotModel(params.bot.voicebotModel),
    instructions,
    tools,
    tool_choice: "auto",
    audio: {
      input: {
        transcription: { model: "whisper-1" },
      },
      output: {
        voice: resolveVoicebotVoice(params.bot.voicebotVoice),
      },
    },
  };
}
