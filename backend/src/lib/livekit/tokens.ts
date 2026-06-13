import { AccessToken } from "livekit-server-sdk";
import type { LiveKitConfig } from "./config.js";

export interface CreateTokenOptions {
  identity: string;
  roomName: string;
  canPublishVideo: boolean;
  ttlSeconds?: number;
}

export async function createParticipantToken(
  config: LiveKitConfig,
  options: CreateTokenOptions
): Promise<string> {
  const at = new AccessToken(config.apiKey, config.apiSecret, {
    identity: options.identity,
    ttl: options.ttlSeconds ?? 600,
  });

  at.addGrant({
    roomJoin: true,
    room: options.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}
