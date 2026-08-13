import type { Bot, BotLocale } from "../../types/index.js";
import { getSystemMessage } from "../i18n/index.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";
import { getZonedParts } from "../calendar/slot-engine.js";
import { intlLocaleForBot } from "../i18n/index.js";

export function resolveAgentBasePrompt(bot: Bot): string {
  return (
    bot.telephonySystemPrompt?.trim() ||
    bot.voicebotSystemPrompt?.trim() ||
    bot.systemPrompt?.trim() ||
    ""
  );
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

export async function buildVoiceAgentRuntimeInstructions(params: {
  bot: Bot;
  tenantId: string;
  locale: BotLocale;
  standaloneInstructionLines: string[];
  flowInstructions?: string;
  handoffEnabled: boolean;
  knowledgeEnabled: boolean;
}): Promise<string> {
  const { bot, tenantId, locale } = params;
  const basePrompt = resolveAgentBasePrompt(bot);
  const languageInstruction =
    locale === "en"
      ? getSystemMessage("respondInEnglish", locale)
      : getSystemMessage("respondInSpanish", locale);
  const calendarBlock = await buildCalendarInstructions(tenantId, bot.botId, locale);
  const knowledgeHint =
    params.knowledgeEnabled
      ? locale === "en"
        ? "\n\nUse search_knowledge when you need business-specific information."
        : "\n\nUsa search_knowledge cuando necesites información específica del negocio."
      : "";
  const handoffInstruction = params.handoffEnabled
    ? getSystemMessage("handoffToolInstruction", locale)
    : getSystemMessage("telephonyHandoffDisabledInstruction", locale);

  const blocks: string[] = [];
  if (basePrompt) blocks.push(basePrompt);
  if (params.standaloneInstructionLines.length > 0) {
    blocks.push(params.standaloneInstructionLines.join("\n"));
  }
  if (params.flowInstructions?.trim()) {
    blocks.push(params.flowInstructions.trim());
  }

  const tail = `${calendarBlock}${knowledgeHint}\n\n${languageInstruction}\n\n${handoffInstruction}`;
  if (blocks.length > 0) {
    return `${blocks.join("\n\n")}${tail}`;
  }
  return tail.trim();
}
