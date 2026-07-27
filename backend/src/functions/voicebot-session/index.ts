import type { BotLocale } from "../../types/index.js";
import { runVoicebotSideband } from "../../lib/voicebot/sideband.js";

export interface VoicebotSessionInvokeEvent {
  sessionId: string;
  callId: string;
  tenantId: string;
  botId: string;
  conversationId: string;
  participantId: string;
  locale: BotLocale;
  ephemeralKey?: string;
  greeting?: string;
}

export async function handler(event: VoicebotSessionInvokeEvent): Promise<void> {
  await runVoicebotSideband(event);
}
