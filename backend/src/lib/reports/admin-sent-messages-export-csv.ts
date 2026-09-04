import {
  getAllConversationMessages,
  listAllConversationsForTenant,
} from "../dynamodb/conversation.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { currentUsagePeriod } from "../dynamodb/usage.repository.js";
import type { Conversation, Message, MessageRole } from "../../types/index.js";

const OUTBOUND_ROLES = new Set<MessageRole>(["assistant", "advisor", "system"]);

const HEADERS = [
  "timestamp",
  "message_id",
  "conversation_id",
  "contact_phone",
  "contact_name",
  "channel",
  "role",
  "source",
  "message_type",
  "content",
  "sent_by_advisor_id",
  "whatsapp_message_id",
  "external_message_id",
];

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function row(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsvCell).join(",");
}

function slugifyName(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "company";
}

function periodBounds(period: string): { start: string; end: string } {
  const [yearText, monthText] = period.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

function isInPeriod(timestamp: string, start: string, end: string): boolean {
  return timestamp >= start && timestamp < end;
}

function isOutboundMessage(message: Message): boolean {
  return OUTBOUND_ROLES.has(message.role);
}

function formatContent(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, 1000);
}

function messageRow(conversation: Conversation, message: Message): string {
  return row([
    message.timestamp,
    message.messageId,
    message.conversationId,
    conversation.phoneNumber,
    conversation.contactName ?? "",
    message.channel ?? conversation.channel ?? "",
    message.role,
    message.source ?? "",
    message.messageType ?? "",
    formatContent(message.content),
    message.sentByAdvisorId ?? "",
    message.whatsappMessageId ?? "",
    message.externalMessageId ?? "",
  ]);
}

function conversationMayHaveMessagesInPeriod(
  conversation: Conversation,
  periodStart: string
): boolean {
  if ((conversation.messageCount ?? 0) <= 0) return false;
  return conversation.lastMessageAt >= periodStart;
}

export async function buildAdminSentMessagesExportCsv(
  tenantId: string,
  period = currentUsagePeriod()
): Promise<{ filename: string; content: string } | null> {
  const tenant = await getTenant(tenantId);
  if (!tenant) return null;

  const { start, end } = periodBounds(period);
  const conversations = await listAllConversationsForTenant(tenantId);
  const lines: string[] = [row(HEADERS)];

  for (const conversation of conversations) {
    if (!conversationMayHaveMessagesInPeriod(conversation, start)) continue;

    const messages = await getAllConversationMessages(tenantId, conversation.conversationId);
    const outbound = messages
      .filter((message) => isOutboundMessage(message) && isInPeriod(message.timestamp, start, end))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const message of outbound) {
      lines.push(messageRow(conversation, message));
    }
  }

  const slug = slugifyName(tenant.name);
  const filename = `sent-messages-${slug}-${period}.csv`;
  const content = `\uFEFF${lines.join("\r\n")}`;
  return { filename, content };
}
