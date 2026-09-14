import { randomUUID } from "crypto";
import {
  CONVERSATION_ATTACHMENT_MAX_BYTES,
  inferConversationAttachmentMimeType,
  isAllowedConversationAttachmentFilename,
  isAudioAttachmentMimeType,
  isImageAttachmentMimeType,
  isVoiceNoteMimeType,
} from "./attachment-policy.js";
import { addMessage, updateConversation } from "../dynamodb/conversation.repository.js";
import { getBot } from "../dynamodb/bot.repository.js";
import { getTenant } from "../dynamodb/tenant.repository.js";
import { incrementMessages } from "../dynamodb/usage.repository.js";
import { assertCanSendMessages } from "../billing/assert-plan.js";
import { PlanLimitError } from "../billing/plan-limits.js";
import {
  buildOutboundContext,
  sendChannelAudio,
  sendChannelDocument,
  sendChannelImage,
} from "../channels/router.js";
import {
  buildConversationAttachmentS3Key,
  getObjectBuffer,
  getPresignedReadUrl,
  getPresignedUploadUrl,
} from "../s3/client.js";
import {
  phoneNumberIdForOutbound,
  resolveWhatsAppChannelForConversation,
} from "../whatsapp/channel-context.js";
import type { AuthContext, Bot, Channel, Conversation, Message } from "../../types/index.js";

const UPLOAD_URL_TTL_SECONDS = 900;
const DOWNLOAD_URL_TTL_SECONDS = 3600;

export class ConversationAttachmentError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

type ResolveAccessToken = (
  tenantId: string,
  channel: Channel,
  botId: string,
  accountId?: string
) => Promise<string | undefined>;

async function assertWhatsAppHumanConversation(conversation: Conversation): Promise<void> {
  if ((conversation.channel ?? "whatsapp") !== "whatsapp") {
    throw new ConversationAttachmentError(
      "Attachments are only supported for WhatsApp conversations",
      400
    );
  }
  if ((conversation.handoffMode ?? "bot") !== "human") {
    throw new ConversationAttachmentError("Conversation is not in human handoff mode", 400);
  }
}

function assertAttachmentS3Key(params: {
  tenantId: string;
  botId: string;
  conversationId: string;
  attachmentId: string;
  s3Key: string;
}): void {
  const expectedPrefix = `tenants/${params.tenantId}/bots/${params.botId}/conversations/${params.conversationId}/attachments/${params.attachmentId}/`;
  if (!params.s3Key.startsWith(expectedPrefix)) {
    throw new ConversationAttachmentError("Invalid attachment location", 400);
  }
}

export async function createConversationAttachmentUploadUrl(input: {
  tenantId: string;
  botId: string;
  conversationId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ uploadUrl: string; attachmentId: string; s3Key: string }> {
  if (!isAllowedConversationAttachmentFilename(input.filename)) {
    throw new ConversationAttachmentError("Unsupported attachment file type");
  }
  const resolvedMime = inferConversationAttachmentMimeType(input.filename, input.mimeType);
  if (!resolvedMime) {
    throw new ConversationAttachmentError("Unsupported attachment mime type");
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new ConversationAttachmentError("Invalid attachment size");
  }
  if (input.sizeBytes > CONVERSATION_ATTACHMENT_MAX_BYTES) {
    throw new ConversationAttachmentError("Attachment exceeds maximum size");
  }

  const attachmentId = randomUUID();
  const s3Key = buildConversationAttachmentS3Key(
    input.tenantId,
    input.botId,
    input.conversationId,
    attachmentId,
    input.filename
  );
  const uploadUrl = await getPresignedUploadUrl(s3Key, resolvedMime, UPLOAD_URL_TTL_SECONDS);
  return { uploadUrl, attachmentId, s3Key };
}

export async function sendConversationAttachment(input: {
  auth: AuthContext;
  conversation: Conversation;
  bot: Bot;
  attachmentId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  caption?: string;
  voiceNote?: boolean;
  sentByAdvisorId?: string;
  environment: string;
  resolveAccessToken: ResolveAccessToken;
}): Promise<Message> {
  await assertWhatsAppHumanConversation(input.conversation);

  if (!isAllowedConversationAttachmentFilename(input.filename)) {
    throw new ConversationAttachmentError("Unsupported attachment file type");
  }
  const resolvedMime = inferConversationAttachmentMimeType(input.filename, input.mimeType);
  if (!resolvedMime) {
    throw new ConversationAttachmentError("Unsupported attachment mime type");
  }

  assertAttachmentS3Key({
    tenantId: input.auth.tenantId,
    botId: input.bot.botId,
    conversationId: input.conversation.conversationId,
    attachmentId: input.attachmentId,
    s3Key: input.s3Key,
  });

  const tenant = await getTenant(input.auth.tenantId);
  if (tenant) {
    try {
      await assertCanSendMessages(tenant);
    } catch (err) {
      if (err instanceof PlanLimitError) {
        throw new ConversationAttachmentError(err.message, 403);
      }
      throw err;
    }
  }

  const buffer = await getObjectBuffer(input.s3Key);
  if (buffer.byteLength > CONVERSATION_ATTACHMENT_MAX_BYTES) {
    throw new ConversationAttachmentError("Attachment exceeds maximum size");
  }

  const resolvedChannel = await resolveWhatsAppChannelForConversation(
    input.conversation,
    input.bot
  );
  const accessToken = await input.resolveAccessToken(
    input.auth.tenantId,
    "whatsapp",
    input.bot.botId,
    resolvedChannel?.channel.accountId
  );
  if (!accessToken) {
    throw new ConversationAttachmentError("WhatsApp is not configured for this bot", 400);
  }

  const outboundCtx = buildOutboundContext({
    tenantId: input.auth.tenantId,
    botId: input.bot.botId,
    bot: input.bot,
    conversation: input.conversation,
    accessToken,
    environment: input.environment,
    phoneNumberId: phoneNumberIdForOutbound(
      input.conversation,
      input.bot,
      resolvedChannel?.channel
    ),
  });

  const caption = input.caption?.trim() || undefined;
  const isImage = isImageAttachmentMimeType(resolvedMime);
  const isAudio = isAudioAttachmentMimeType(resolvedMime);
  const outboundPayload = {
    buffer,
    mimeType: resolvedMime,
    filename: input.filename,
    ...(caption && !isAudio ? { caption } : {}),
  };

  const outboundResult = isImage
    ? await sendChannelImage(outboundCtx, outboundPayload)
    : isAudio
      ? await sendChannelAudio(outboundCtx, {
          ...outboundPayload,
          voice: Boolean(input.voiceNote && isVoiceNoteMimeType(resolvedMime)),
        })
      : await sendChannelDocument(outboundCtx, outboundPayload);

  const downloadUrl = await getPresignedReadUrl(input.s3Key, DOWNLOAD_URL_TTL_SECONDS);
  const now = new Date().toISOString();
  const messageType = isImage ? "image" : isAudio ? "audio" : "document";
  const metadata = {
    kind: isImage ? "image" : isAudio ? "audio" : "document",
    filename: input.filename,
    mimeType: resolvedMime,
    s3Key: input.s3Key,
    downloadUrl,
  };

  const message: Message = {
    messageId: `adv-${randomUUID()}`,
    conversationId: input.conversation.conversationId,
    tenantId: input.auth.tenantId,
    role: "advisor",
    content: isAudio ? input.filename : caption ?? input.filename,
    channel: "whatsapp",
    messageType,
    metadata,
    source: "panel",
    ...(input.sentByAdvisorId ? { sentByAdvisorId: input.sentByAdvisorId } : {}),
    ...(outboundResult.externalMessageId
      ? {
          externalMessageId: outboundResult.externalMessageId,
          whatsappMessageId: outboundResult.externalMessageId,
        }
      : {}),
    timestamp: now,
  };

  await addMessage(message, input.bot.botId);
  await incrementMessages(input.auth.tenantId);

  const convPatch: Parameters<typeof updateConversation>[3] = {
    workflowStatus: "open",
  };
  if (!input.conversation.firstHumanResponseAt) {
    convPatch.firstHumanResponseAt = now;
  }
  await updateConversation(
    input.auth.tenantId,
    input.bot.botId,
    input.conversation.conversationId,
    convPatch
  );

  return message;
}

export async function prepareConversationAttachmentSend(input: {
  auth: AuthContext;
  conversationId: string;
  botId: string;
  attachmentId: string;
  s3Key: string;
  filename: string;
  mimeType: string;
  caption?: string;
  voiceNote?: boolean;
  environment: string;
  resolveAccessToken: ResolveAccessToken;
  assertCanAccessConversation: (auth: AuthContext, conversation: Conversation) => Promise<void>;
  resolveAdvisorId?: (auth: AuthContext) => Promise<string | undefined>;
}): Promise<Message> {
  const { findConversationById } = await import("../dynamodb/conversation.repository.js");
  const conversation = await findConversationById(input.auth.tenantId, input.conversationId);
  if (!conversation || conversation.botId !== input.botId) {
    throw new ConversationAttachmentError("Conversation not found", 404);
  }

  await input.assertCanAccessConversation(input.auth, conversation);

  const bot = await getBot(input.auth.tenantId, input.botId);
  if (!bot) {
    throw new ConversationAttachmentError("Bot not found", 404);
  }

  const sentByAdvisorId = input.resolveAdvisorId
    ? await input.resolveAdvisorId(input.auth)
    : undefined;

  return sendConversationAttachment({
    auth: input.auth,
    conversation,
    bot,
    attachmentId: input.attachmentId,
    s3Key: input.s3Key,
    filename: input.filename,
    mimeType: input.mimeType,
    ...(input.caption ? { caption: input.caption } : {}),
    ...(input.voiceNote ? { voiceNote: input.voiceNote } : {}),
    ...(sentByAdvisorId ? { sentByAdvisorId } : {}),
    environment: input.environment,
    resolveAccessToken: input.resolveAccessToken,
  });
}
