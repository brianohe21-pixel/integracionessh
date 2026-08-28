import type { Channel } from "../../types/index.js";

export function conversationLookupGsi1pk(
  tenantId: string,
  botId: string,
  channel: Channel,
  participantId: string
): string {
  return `TENANT#${tenantId}#BOT#${botId}#CHANNEL#${channel}#USER#${participantId}`;
}

export function whatsappConversationLookupGsi1pk(
  tenantId: string,
  botId: string,
  businessPhoneNumberId: string,
  participantId: string
): string {
  return `TENANT#${tenantId}#BOT#${botId}#CHANNEL#whatsapp#LINE#${businessPhoneNumberId}#USER#${participantId}`;
}

export function legacyPhoneGsi1pk(
  tenantId: string,
  botId: string,
  phoneNumber: string
): string {
  return `TENANT#${tenantId}#BOT#${botId}#PHONE#${phoneNumber}`;
}
