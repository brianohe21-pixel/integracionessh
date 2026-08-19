export type BotLocale = "es" | "en";

export interface TelephonySession {
  sessionId: string;
  callControlId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  status: string;
  streamToken: string;
  locale: BotLocale;
  contactName?: string;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  ttl: number;
}

export interface Bot {
  botId: string;
  tenantId: string;
  telephonyVoiceId?: string;
  telephonyBackgroundSound?: string;
  telephonyBackgroundSoundVolume?: number;
  telephonyTtsModel?: string;
  telephonyVoiceSpeed?: number;
  telephonyVoiceStability?: number;
  telephonyVoiceSimilarity?: number;
  telephonyTranscriptionVadThreshold?: number;
  telephonyTranscriptionSilenceMs?: number;
  telephonyTranscriptionBargeIn?: boolean;
  telephonyModel?: string;
  telephonyTranscriptionModel?: string;
  telephonyGreeting?: string;
  telephonySystemPrompt?: string;
  telephonyRecordingEnabled?: boolean;
  telephonyRecordingNotice?: string;
  telephonyHandoffEnabled?: boolean;
  voicebotModel?: string;
  voicebotGreeting?: string;
  voicebotSystemPrompt?: string;
  systemPrompt?: string;
  knowledgeEnabled?: boolean;
  defaultLocale?: BotLocale;
}
