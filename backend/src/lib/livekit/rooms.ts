import { RoomServiceClient } from "livekit-server-sdk";
import type { LiveKitConfig } from "./config.js";

export async function deleteLiveKitRoom(
  config: LiveKitConfig,
  roomName: string
): Promise<void> {
  const host = config.url.replace(/^wss?:\/\//, "https://");
  const client = new RoomServiceClient(host, config.apiKey, config.apiSecret);
  try {
    await client.deleteRoom(roomName);
  } catch {
    // room may already be closed
  }
}
