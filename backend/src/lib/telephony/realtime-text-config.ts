import type { Bot, BotLocale } from "../../types/index.js";
import {
  buildVoicebotInstructions,
  buildVoicebotTools,
  resolveVoicebotModel,
} from "../voicebot/realtime-config.js";
import { getCalendarConfig } from "../dynamodb/calendar-config.repository.js";

export async function buildTelephonyRealtimeTextConfig(params: {
  bot: Bot;
  tenantId: string;
  locale: BotLocale;
}): Promise<Record<string, unknown>> {
  const calendarConfig = await getCalendarConfig(params.tenantId, params.bot.botId);
  const voicebotGreeting = params.bot.telephonyGreeting ?? params.bot.voicebotGreeting;
  const voicebotSystemPrompt =
    params.bot.telephonySystemPrompt?.trim() ||
    params.bot.voicebotSystemPrompt?.trim() ||
    params.bot.systemPrompt;
  const instructions = await buildVoicebotInstructions({
    bot: {
      ...params.bot,
      ...(voicebotSystemPrompt ? { voicebotSystemPrompt } : {}),
      ...(voicebotGreeting ? { voicebotGreeting } : {}),
    },
    tenantId: params.tenantId,
    locale: params.locale,
  });
  const tools = buildVoicebotTools({
    locale: params.locale,
    knowledgeEnabled: Boolean(params.bot.knowledgeEnabled),
    calendarEnabled: Boolean(calendarConfig?.enabled),
  });

  return {
    type: "realtime",
    model: resolveVoicebotModel(params.bot.telephonyModel ?? params.bot.voicebotModel),
    instructions,
    tools,
    tool_choice: "auto",
    modalities: ["text"],
    input_audio_format: "g711_ulaw",
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
    },
    input_audio_transcription: {
      model: "gpt-4o-mini-transcribe",
    },
  };
}
