import { randomUUID } from "crypto";
import {
  addMessage,
  getOrCreateConversation,
} from "../dynamodb/conversation.repository.js";
import { resolveWhatsAppTemplateDisplayContent } from "../whatsapp/template-content.js";
import type { Message } from "../../types/index.js";

type PublicApiTemplateComponent = {
  type: string;
  parameters?: Array<{
    type: string;
    text?: string | undefined;
    image?: { link: string } | undefined;
  }> | undefined;
};

export type PublicApiOutboundPayload =
  | { type: "text"; text: string }
  | {
      type: "template";
      template: {
        name: string;
        language: string;
        components?: PublicApiTemplateComponent[];
      };
    };

export async function persistPublicApiWhatsAppOutbound(params: {
  tenantId: string;
  botId: string;
  phoneNumberId: string;
  to: string;
  externalMessageId?: string | null;
  payload: PublicApiOutboundPayload;
}): Promise<void> {
  const conversation = await getOrCreateConversation(
    params.tenantId,
    params.botId,
    "whatsapp",
    params.to,
    undefined,
    {
      businessPhoneNumberId: params.phoneNumberId,
      phoneNumber: params.to,
    }
  );

  const now = new Date().toISOString();
  const externalMessageId = params.externalMessageId ?? undefined;

  let content: string;
  let metadata: Record<string, unknown> = { origin: "public_api" };

  if (params.payload.type === "text") {
    content = params.payload.text;
  } else {
    const { template } = params.payload;
    const resolved = await resolveWhatsAppTemplateDisplayContent({
      tenantId: params.tenantId,
      botId: params.botId,
      templateName: template.name,
      language: template.language,
      ...(template.components?.length ? { components: template.components } : {}),
    });
    content = resolved.content;
    metadata = {
      ...metadata,
      kind: "whatsapp_template",
      templateName: template.name,
      language: template.language,
      display: resolved.display,
      ...(resolved.category ? { templateCategory: resolved.category } : {}),
      ...(template.components?.length ? { components: template.components } : {}),
    };
  }

  const message: Message = {
    messageId: externalMessageId ?? `api-${randomUUID()}`,
    conversationId: conversation.conversationId,
    tenantId: params.tenantId,
    role: "assistant",
    content,
    channel: "whatsapp",
    messageType: "text",
    metadata,
    timestamp: now,
    ...(externalMessageId
      ? { externalMessageId, whatsappMessageId: externalMessageId }
      : {}),
  };

  await addMessage(message, params.botId);
}
