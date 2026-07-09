export interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export function getLiveKitConfig(): LiveKitConfig | null {
  const url = process.env.LIVEKIT_URL ?? "";
  const apiKey = process.env.LIVEKIT_API_KEY ?? "";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "";
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret };
}

export function buildRoomName(tenantId: string, conversationId: string): string {
  return `t_${tenantId}_c_${conversationId}`;
}
