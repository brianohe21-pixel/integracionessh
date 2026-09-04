import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getCrossChannelHistory, getContactTimelineMessages } from "../../lib/contacts/contact-timeline.js";
import { enrichConversationMessages } from "../../lib/conversations/document-messages.js";
import {
  listConversations,
  getConversationMessages,
  findConversationById,
  addMessage,
  deleteConversation,
  clearConversationMessages,
  ensureConversationContactId,
} from "../../lib/dynamodb/conversation.repository.js";
import { getAdvisorByCognitoUserId } from "../../lib/dynamodb/advisor.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanSendMessages, assertCanUseCopilot } from "../../lib/billing/assert-plan.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  resolveRequestAuth,
  assertAdvisorOrMember,
  assertTenantManagerRole,
} from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { performHandoff, releaseToBot, claimConversation, performBulkHandoff } from "../../lib/advisor/handoff.js";
import { resolveConversation } from "../../lib/advisor/resolve.js";
import { updateConversation } from "../../lib/dynamodb/conversation.repository.js";
import {
  getClientHandoffMessage,
  notifyAdvisorOfConversation,
} from "../../lib/advisor/notify.js";
import { getBotLocale } from "../../lib/i18n/index.js";
import { buildWaMeLink } from "../../lib/advisor/wa-link.js";
import { getConversation } from "../../lib/dynamodb/conversation.repository.js";
import {
  getWhatsAppAccessToken,
  truncateWhatsAppText,
} from "../../lib/whatsapp/client.js";
import { getWhatsAppAccessTokenForAccount } from "../../lib/whatsapp/secrets.js";
import {
  phoneNumberIdForOutbound,
  resolveWhatsAppChannelForConversation,
} from "../../lib/whatsapp/channel-context.js";
import { getInstagramAccessToken } from "../../lib/instagram/secrets.js";
import { getTelegramBotToken } from "../../lib/telegram/secrets.js";
import { getMessengerAccessToken } from "../../lib/messenger/secrets.js";
import {
  buildOutboundContext,
  sendChannelText,
} from "../../lib/channels/router.js";
import { ok, created, badRequest, notFound, forbidden, noContent, handleError } from "../../lib/http.js";
import type { AuthContext, Conversation, Message, Channel } from "../../types/index.js";
import {
  generateCopilotInsights,
  suggestAdvisorReply,
  summarizeConversation,
} from "../../lib/advisor/copilot.js";
import {
  createAndSendQuotation,
  listConversationQuotations,
} from "../../lib/quotations/quotations.service.js";
import {
  createAndSendConversationBooking,
  listConversationBookingSlots,
} from "../../lib/conversations/conversation-bookings.service.js";
import {
  createConversationAttachmentUploadUrl,
  prepareConversationAttachmentSend,
} from "../../lib/conversations/conversation-attachments.service.js";
import { publishRealtimeEventSafe } from "../../lib/realtime/publish.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

async function resolveAccessTokenForChannel(
  tenantId: string,
  channel: Channel,
  botId?: string,
  accountId?: string
): Promise<string | undefined> {
  if (channel === "instagram") {
    return getInstagramAccessToken(tenantId, ENVIRONMENT);
  }
  if (channel === "whatsapp") {
    if (accountId) {
      return getWhatsAppAccessTokenForAccount(tenantId, accountId, ENVIRONMENT);
    }
    return getWhatsAppAccessToken(tenantId, ENVIRONMENT);
  }
  if (channel === "telegram" && botId) {
    return getTelegramBotToken(tenantId, botId, ENVIRONMENT);
  }
  if (channel === "messenger" && botId) {
    return getMessengerAccessToken(tenantId, botId, ENVIRONMENT);
  }
  return undefined;
}

const HandoffSchema = z.object({
  botId: z.string().uuid(),
  advisorId: z.string().uuid().optional(),
});

const ClaimSchema = z.object({
  botId: z.string().uuid(),
});

const BulkHandoffSchema = z.object({
  items: z
    .array(
      z.object({
        conversationId: z.string().uuid(),
        botId: z.string().uuid(),
      })
    )
    .min(1)
    .max(50),
  advisorId: z.string().uuid().optional(),
});

const SendMessageSchema = z.object({
  botId: z.string().uuid(),
  content: z.string().min(1).max(1024),
});

const WorkflowStatusSchema = z.object({
  botId: z.string().uuid(),
  workflowStatus: z.enum(["new", "open", "pending", "resolved"]),
});

const InteractionCategorySchema = z.object({
  botId: z.string().uuid(),
  interactionCategory: z.enum([
    "sale",
    "complaint",
    "callback",
    "support",
    "inquiry",
    "billing",
    "other",
  ]),
});

const NoteSchema = z.object({
  botId: z.string().uuid(),
  internalNote: z.string().max(2000),
});

const ResolveSchema = z.object({
  botId: z.string().uuid(),
  csatScore: z.number().int().min(1).max(5).optional(),
  releaseToBot: z.boolean().optional(),
  interactionCategory: z
    .enum(["sale", "complaint", "callback", "support", "inquiry", "billing", "other"])
    .optional(),
});

const CopilotSchema = z.object({
  botId: z.string().uuid(),
  action: z.enum(["suggest", "summarize", "analyze"]),
});

const QuotationLineItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(9999),
  unitPriceInCents: z.number().int().min(0),
});

const CreateQuotationSchema = z.object({
  botId: z.string().uuid(),
  items: z.array(QuotationLineItemSchema).min(1).max(50),
  notes: z.string().max(1000).optional(),
  validUntil: z.string().datetime().optional(),
  paymentDescription: z.string().min(1).max(200).optional(),
  includePaymentLink: z.boolean().optional().default(true),
});

const CreateConversationBookingSchema = z.object({
  botId: z.string().uuid(),
  startAt: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

const ClearConversationSchema = z.object({
  botId: z.string().uuid(),
});

const AttachmentUploadUrlSchema = z.object({
  botId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

const SendAttachmentSchema = z.object({
  botId: z.string().uuid(),
  attachmentId: z.string().uuid(),
  s3Key: z.string().min(1).max(500),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(120),
  caption: z.string().max(1024).optional(),
});

const BulkDeleteSchema = z.object({
  items: z
    .array(
      z.object({
        conversationId: z.string().uuid(),
        botId: z.string().uuid(),
      })
    )
    .min(1)
    .max(50),
});

async function resolveAdvisorRecord(auth: AuthContext) {
  if (auth.role !== "advisor") return null;
  return getAdvisorByCognitoUserId(auth.tenantId, auth.userId);
}

async function assertCanAccessConversation(
  auth: AuthContext,
  conversation: Conversation
): Promise<void> {
  if (auth.role === "member") return;

  const advisor = await resolveAdvisorRecord(auth);
  if (!advisor || conversation.assignedAdvisorId !== advisor.advisorId) {
    const error = new Error("Access denied to this conversation");
    (error as Error & { statusCode: number }).statusCode = 403;
    throw error;
  }
}

function parseSubPath(rawPath: string, conversationId: string): string | null {
  const suffix = rawPath.split(`/conversations/${conversationId}`)[1] ?? "";
  if (!suffix || suffix === "") return null;
  return suffix.replace(/^\//, "").split("/")[0] ?? null;
}

function resolveConversationId(
  rawPath: string,
  pathParams: { conversationId?: string } | undefined
): string | undefined {
  if (pathParams?.conversationId) return pathParams.conversationId;
  if (rawPath === "/conversations" || rawPath.endsWith("/conversations/bulk-handoff") || rawPath.endsWith("/conversations/bulk-delete")) {
    return undefined;
  }
  const match = rawPath.match(/^\/conversations\/([^/]+)/);
  return match?.[1];
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertAdvisorOrMember(auth);
    if (auth.role !== "advisor") {
      await assertAssignedServices(auth.tenantId, ["conversations", "supervisor"]);
    }

    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;
    const conversationId = resolveConversationId(rawPath, event.pathParameters);
    const params = event.queryStringParameters ?? {};

    if (method === "POST" && rawPath.endsWith("/conversations/bulk-handoff")) {
      assertTenantManagerRole(auth);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = BulkHandoffSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const result = await performBulkHandoff({
        tenantId: auth.tenantId,
        items: parsed.data.items,
        reason: "manual",
        ...(parsed.data.advisorId ? { advisorId: parsed.data.advisorId } : {}),
      });

      return ok(result);
    }

    if (method === "POST" && rawPath.endsWith("/conversations/bulk-delete")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = BulkDeleteSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const succeeded: string[] = [];
      const failed: Array<{ conversationId: string; error: string }> = [];

      for (const item of parsed.data.items) {
        try {
          const conversation = await findConversationById(auth.tenantId, item.conversationId);
          if (!conversation || conversation.botId !== item.botId) {
            failed.push({ conversationId: item.conversationId, error: "not_found" });
            continue;
          }

          await assertCanAccessConversation(auth, conversation);
          const deleted = await deleteConversation(
            auth.tenantId,
            item.botId,
            item.conversationId
          );
          if (deleted) {
            succeeded.push(item.conversationId);
          } else {
            failed.push({ conversationId: item.conversationId, error: "not_found" });
          }
        } catch {
          failed.push({ conversationId: item.conversationId, error: "forbidden" });
        }
      }

      return ok({ succeeded, failed });
    }

    if (method === "GET" && !conversationId) {
      const botId = params.botId;
      const handoffMode =
        params.handoffMode === "human" || params.handoffMode === "bot"
          ? params.handoffMode
          : undefined;
      const workflowStatus =
        params.workflowStatus === "new" ||
        params.workflowStatus === "open" ||
        params.workflowStatus === "pending" ||
        params.workflowStatus === "resolved"
          ? params.workflowStatus
          : undefined;
      const status =
        params.status === "active" || params.status === "closed"
          ? params.status
          : undefined;
      const channel =
        params.channel === "whatsapp" ||
        params.channel === "instagram" ||
        params.channel === "webchat" ||
        params.channel === "telegram" ||
        params.channel === "messenger" ||
        params.channel === "sms" ||
        params.channel === "email" ||
        params.channel === "voicebot" ||
        params.channel === "phone"
          ? params.channel
          : undefined;
      const limit = params.limit ? parseInt(params.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const assignment =
        params.assignment === "assigned" || params.assignment === "unassigned"
          ? params.assignment
          : undefined;
      const interactionCategory =
        params.interactionCategory === "sale" ||
        params.interactionCategory === "complaint" ||
        params.interactionCategory === "callback" ||
        params.interactionCategory === "support" ||
        params.interactionCategory === "inquiry" ||
        params.interactionCategory === "billing" ||
        params.interactionCategory === "other"
          ? params.interactionCategory
          : undefined;

      let assignedAdvisorId = params.assignedAdvisorId;

      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        if (!advisor) return ok([]);
        if (assignment === "unassigned") {
          assignedAdvisorId = undefined;
        } else {
          assignedAdvisorId = advisor.advisorId;
        }
      }

      const listOptions: Parameters<typeof listConversations>[1] = { limit };
      if (botId) listOptions.botId = botId;
      if (handoffMode) listOptions.handoffMode = handoffMode;
      if (workflowStatus) listOptions.workflowStatus = workflowStatus;
      if (status) listOptions.status = status;
      if (channel) listOptions.channel = channel;
      if (params.whatsappChannelId) listOptions.whatsappChannelId = params.whatsappChannelId;
      if (assignedAdvisorId) listOptions.assignedAdvisorId = assignedAdvisorId;
      if (assignment) listOptions.assignment = assignment;
      if (interactionCategory) listOptions.interactionCategory = interactionCategory;
      if (params.cursor) listOptions.cursor = params.cursor;

      const result = await listConversations(auth.tenantId, listOptions);

      return ok(result);
    }

    if (!conversationId) {
      return badRequest("Route not found");
    }

    const subPath = parseSubPath(rawPath, conversationId);

    if (method === "GET" && subPath === "cross-channel-history") {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");

      await assertCanAccessConversation(auth, conversation);

      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const resolved = await ensureConversationContactId(conversation);
      const messages = await getCrossChannelHistory({
        tenantId: auth.tenantId,
        conversation: resolved,
        limit,
      });

      const enriched = await enrichConversationMessages(messages, {
        tenantId: auth.tenantId,
        botId: resolved.botId,
      });

      return ok({ contactId: resolved.contactId, messages: enriched });
    }

    if (method === "GET" && !subPath) {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");

      await assertCanAccessConversation(auth, conversation);

      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const messages = await getConversationMessages(auth.tenantId, conversationId, limit);
      const enriched = await enrichConversationMessages(messages, {
        tenantId: auth.tenantId,
        botId: conversation.botId,
      });
      return ok(enriched);
    }

    if (method === "PATCH" && subPath === "status") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = WorkflowStatusSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const updated = await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        { workflowStatus: parsed.data.workflowStatus }
      );
      return ok(updated);
    }

    if (method === "PATCH" && subPath === "category") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = InteractionCategorySchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const updated = await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        {
          interactionCategory: parsed.data.interactionCategory,
          interactionCategoryAt: new Date().toISOString(),
        }
      );
      return ok(updated);
    }

    if (method === "PATCH" && subPath === "note") {
      assertTenantManagerRole(auth);
      const body = JSON.parse(event.body ?? "{}");
      const parsed = NoteSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      const updated = await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        { internalNote: parsed.data.internalNote }
      );
      return ok(updated);
    }

    if (method === "POST" && subPath === "resolve") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = ResolveSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const updated = await resolveConversation({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        conversationId,
        ...(parsed.data.csatScore !== undefined ? { csatScore: parsed.data.csatScore } : {}),
        ...(parsed.data.releaseToBot ? { releaseToBot: true } : {}),
        ...(parsed.data.interactionCategory
          ? { interactionCategory: parsed.data.interactionCategory }
          : {}),
      });

      return ok(updated);
    }

    if (method === "POST" && subPath === "handoff") {
      assertTenantManagerRole(auth);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = HandoffSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await performHandoff({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        conversationId,
        reason: "manual",
        ...(parsed.data.advisorId ? { advisorId: parsed.data.advisorId } : {}),
      });

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      const refreshed = await getConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId
      );

      if (bot && refreshed) {
        const channel = refreshed.channel ?? "whatsapp";
        const accessToken = await resolveAccessTokenForChannel(
          auth.tenantId,
          channel,
          refreshed.botId
        );
        if (
          accessToken ||
          channel === "webchat" ||
          channel === "sms" ||
          channel === "email" ||
          channel === "voicebot" ||
          channel === "phone"
        ) {
          await sendChannelText(
            buildOutboundContext({
              tenantId: auth.tenantId,
              botId: parsed.data.botId,
              bot,
              conversation: refreshed,
              accessToken,
              environment: ENVIRONMENT,
            }),
            getClientHandoffMessage(getBotLocale(refreshed, bot))
          );
        }
        await notifyAdvisorOfConversation({
          tenantId: auth.tenantId,
          botId: parsed.data.botId,
          conversation: refreshed,
          phoneNumberId: bot.phoneNumberId,
          accessToken: accessToken ?? "",
          lastMessagePreview: "",
          force: true,
        });
      }

      return ok(refreshed);
    }

    if (method === "POST" && subPath === "claim") {
      if (auth.role !== "advisor") {
        return forbidden("Only advisors can claim conversations");
      }

      const advisor = await resolveAdvisorRecord(auth);
      if (!advisor) return forbidden("Advisor record not found");

      const body = JSON.parse(event.body ?? "{}");
      const parsed = ClaimSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      const updated = await claimConversation({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        conversationId,
        advisorId: advisor.advisorId,
      });

      return ok(updated);
    }

    if (method === "POST" && subPath === "release") {
      const body = JSON.parse(event.body ?? "{}");
      const botId = z.object({ botId: z.string().uuid() }).safeParse(body);
      if (!botId.success) return badRequest(botId.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== botId.data.botId) {
        return notFound("Conversation not found");
      }

      if (auth.role === "advisor") {
        await assertCanAccessConversation(auth, conversation);
      }

      const updated = await releaseToBot({
        tenantId: auth.tenantId,
        botId: botId.data.botId,
        conversationId,
      });

      return ok(updated);
    }

    if (method === "POST" && subPath === "copilot") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CopilotSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const tenant = await getTenant(auth.tenantId);
      if (!tenant) return notFound("Tenant not found");

      try {
        assertCanUseCopilot(tenant);
      } catch (err) {
        if (err instanceof PlanLimitError) {
          return forbidden(err.message);
        }
        throw err;
      }

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const resolved = await ensureConversationContactId(conversation);
      const messages = await getContactTimelineMessages({
        tenantId: auth.tenantId,
        conversation: resolved,
        limit: 50,
      });
      const copilotParams = {
        bot,
        messages,
        tenantId: auth.tenantId,
        environment: ENVIRONMENT,
      };

      if (parsed.data.action === "suggest") {
        let advisorName: string | undefined;
        if (auth.role === "advisor") {
          const advisor = await resolveAdvisorRecord(auth);
          advisorName = advisor?.name;
        }

        const suggestion = await suggestAdvisorReply({
          ...copilotParams,
          ...(advisorName ? { advisorName } : {}),
        });

        return ok(suggestion);
      }

      if (parsed.data.action === "summarize") {
        const summary = await summarizeConversation(copilotParams);
        const updated = await updateConversation(
          auth.tenantId,
          parsed.data.botId,
          conversationId,
          {
            copilotSummary: summary.summary,
            copilotGeneratedAt: new Date().toISOString(),
          }
        );

        return ok({
          ...summary,
          conversation: updated,
        });
      }

      const insights = await generateCopilotInsights(copilotParams);
      const updated = await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        {
          copilotSummary: insights.copilotSummary,
          detectedIntent: insights.detectedIntent,
          copilotGeneratedAt: new Date().toISOString(),
        }
      );

      if (updated) {
        publishRealtimeEventSafe(auth.tenantId, {
          type: "conversation.updated",
          conversation: updated,
        });
      }

      return ok({
        detectedIntent: insights.detectedIntent,
        copilotSummary: insights.copilotSummary,
        intentDetails: insights.intentDetails,
        summaryDetails: insights.summaryDetails,
        conversation: updated,
      });
    }

    if (method === "POST" && subPath === "messages") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = SendMessageSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      if ((conversation.handoffMode ?? "bot") !== "human") {
        return badRequest("Conversation is not in human handoff mode");
      }

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const channel = conversation.channel ?? "whatsapp";
      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        try {
          await assertCanSendMessages(tenant);
        } catch (err) {
          if (err instanceof PlanLimitError) {
            return forbidden(err.message);
          }
          throw err;
        }
      }

      const resolvedChannel =
        channel === "whatsapp"
          ? await resolveWhatsAppChannelForConversation(conversation, bot)
          : null;

      const accessToken = await resolveAccessTokenForChannel(
        auth.tenantId,
        channel,
        parsed.data.botId,
        resolvedChannel?.channel.accountId
      );
      const outboundPhoneNumberId = phoneNumberIdForOutbound(
        conversation,
        bot,
        resolvedChannel?.channel
      );
      const text =
        channel === "whatsapp" ? truncateWhatsAppText(parsed.data.content) : parsed.data.content;

      let sentByAdvisorId: string | undefined;
      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        sentByAdvisorId = advisor?.advisorId;
      }

      const outbound = await (async () => {
        if (channel === "webchat") {
          const messageId = `adv-${randomUUID()}`;
          await addMessage(
            {
              messageId,
              conversationId,
              tenantId: auth.tenantId,
              role: "advisor",
              content: text,
              channel,
              source: "panel",
              ...(sentByAdvisorId ? { sentByAdvisorId } : {}),
              externalMessageId: messageId,
              timestamp: new Date().toISOString(),
            },
            parsed.data.botId
          );
          return { externalMessageId: messageId };
        }
        return sendChannelText(
          buildOutboundContext({
            tenantId: auth.tenantId,
            botId: parsed.data.botId,
            bot,
            conversation,
            accessToken,
            environment: ENVIRONMENT,
            phoneNumberId: outboundPhoneNumberId,
          }),
          text
        );
      })();

      const now = new Date().toISOString();
      const message: Message =
        channel === "webchat"
          ? {
              messageId: outbound.externalMessageId ?? `adv-${randomUUID()}`,
              conversationId,
              tenantId: auth.tenantId,
              role: "advisor",
              content: text,
              channel,
              source: "panel",
              ...(sentByAdvisorId ? { sentByAdvisorId } : {}),
              ...(outbound.externalMessageId
                ? { externalMessageId: outbound.externalMessageId }
                : {}),
              timestamp: now,
            }
          : {
              messageId: `adv-${randomUUID()}`,
              conversationId,
              tenantId: auth.tenantId,
              role: "advisor",
              content: text,
              channel,
              source: "panel",
              ...(sentByAdvisorId ? { sentByAdvisorId } : {}),
              ...(outbound.externalMessageId
                ? {
                    externalMessageId: outbound.externalMessageId,
                    ...(channel === "whatsapp"
                      ? { whatsappMessageId: outbound.externalMessageId }
                      : {}),
                  }
                : {}),
              timestamp: now,
            };

      if (channel !== "webchat") {
        await addMessage(message, parsed.data.botId);
      }
      await incrementMessages(auth.tenantId);

      const convPatch: Parameters<typeof updateConversation>[3] = {
        workflowStatus: "open",
      };
      if (!conversation.firstHumanResponseAt) {
        convPatch.firstHumanResponseAt = now;
      }
      await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        convPatch
      );

      return created(message);
    }

    if (method === "POST" && rawPath.endsWith("/attachments/upload-url")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = AttachmentUploadUrlSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      if ((conversation.handoffMode ?? "bot") !== "human") {
        return badRequest("Conversation is not in human handoff mode");
      }
      if ((conversation.channel ?? "whatsapp") !== "whatsapp") {
        return badRequest("Attachments are only supported for WhatsApp conversations");
      }

      const result = await createConversationAttachmentUploadUrl({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        conversationId,
        filename: parsed.data.filename,
        mimeType: parsed.data.mimeType,
        sizeBytes: parsed.data.sizeBytes,
      });

      return created(result);
    }

    if (method === "POST" && rawPath.endsWith("/attachments/send")) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = SendAttachmentSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const message = await prepareConversationAttachmentSend({
        auth,
        conversationId,
        botId: parsed.data.botId,
        attachmentId: parsed.data.attachmentId,
        s3Key: parsed.data.s3Key,
        filename: parsed.data.filename,
        mimeType: parsed.data.mimeType,
        ...(parsed.data.caption ? { caption: parsed.data.caption } : {}),
        environment: ENVIRONMENT,
        resolveAccessToken: resolveAccessTokenForChannel,
        assertCanAccessConversation,
        resolveAdvisorId: async (requestAuth) => {
          if (requestAuth.role !== "advisor") return undefined;
          const advisor = await resolveAdvisorRecord(requestAuth);
          return advisor?.advisorId;
        },
      });

      return created(message);
    }

    if (method === "GET" && subPath === "booking-slots") {
      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const from = params.from;
      const to = params.to;
      const slots = await listConversationBookingSlots({
        tenantId: auth.tenantId,
        botId,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        environment: ENVIRONMENT,
      });
      return ok(slots);
    }

    if (method === "POST" && subPath === "bookings") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateConversationBookingSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      if ((conversation.handoffMode ?? "bot") !== "human") {
        return badRequest("Conversation is not in human handoff mode");
      }

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        try {
          await assertCanSendMessages(tenant);
        } catch (err) {
          if (err instanceof PlanLimitError) {
            return forbidden(err.message);
          }
          throw err;
        }
      }

      let createdByAdvisorId: string | undefined;
      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        createdByAdvisorId = advisor?.advisorId;
      }

      const result = await createAndSendConversationBooking({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        bot,
        conversation,
        environment: ENVIRONMENT,
        startAt: parsed.data.startAt,
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        ...(createdByAdvisorId ? { createdByAdvisorId } : {}),
      });

      await incrementMessages(auth.tenantId);

      const now = new Date().toISOString();
      const convPatch: Parameters<typeof updateConversation>[3] = {
        workflowStatus: "open",
      };
      if (!conversation.firstHumanResponseAt) {
        convPatch.firstHumanResponseAt = now;
      }
      await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        convPatch
      );

      return created(result);
    }

    if (method === "GET" && subPath === "quotations") {
      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const quotations = await listConversationQuotations({
        tenantId: auth.tenantId,
        botId,
        conversationId,
      });
      return ok({ quotations });
    }

    if (method === "POST" && subPath === "quotations") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateQuotationSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      if ((conversation.handoffMode ?? "bot") !== "human") {
        return badRequest("Conversation is not in human handoff mode");
      }

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot) return notFound("Bot not found");

      const tenant = await getTenant(auth.tenantId);
      if (tenant) {
        try {
          await assertCanSendMessages(tenant);
        } catch (err) {
          if (err instanceof PlanLimitError) {
            return forbidden(err.message);
          }
          throw err;
        }
      }

      let createdByAdvisorId: string | undefined;
      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        createdByAdvisorId = advisor?.advisorId;
      }

      const result = await createAndSendQuotation({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        bot,
        conversation,
        environment: ENVIRONMENT,
        items: parsed.data.items,
        includePaymentLink: parsed.data.includePaymentLink,
        ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
        ...(parsed.data.validUntil ? { validUntil: parsed.data.validUntil } : {}),
        ...(parsed.data.paymentDescription
          ? { paymentDescription: parsed.data.paymentDescription }
          : {}),
        ...(createdByAdvisorId ? { createdByAdvisorId } : {}),
      });

      await incrementMessages(auth.tenantId);

      const now = new Date().toISOString();
      const convPatch: Parameters<typeof updateConversation>[3] = {
        workflowStatus: "open",
      };
      if (!conversation.firstHumanResponseAt) {
        convPatch.firstHumanResponseAt = now;
      }
      await updateConversation(
        auth.tenantId,
        parsed.data.botId,
        conversationId,
        convPatch
      );

      return created(result);
    }

    if (method === "POST" && subPath === "clear") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = ClearConversationSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== parsed.data.botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const updated = await clearConversationMessages(
        auth.tenantId,
        parsed.data.botId,
        conversationId
      );
      if (!updated) return notFound("Conversation not found");

      return ok(updated);
    }

    if (method === "GET" && subPath === "wa-link") {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");

      await assertCanAccessConversation(auth, conversation);

      if ((conversation.channel ?? "whatsapp") !== "whatsapp") {
        return badRequest("WhatsApp link is only available for WhatsApp conversations");
      }

      return ok({
        url: buildWaMeLink(conversation.phoneNumber),
        phoneNumber: conversation.phoneNumber,
      });
    }

    if (method === "GET" && rawPath.includes("/messages/") && rawPath.endsWith("/document")) {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");
      await assertCanAccessConversation(auth, conversation);

      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }
      if (conversation.botId !== botId) return notFound("Conversation not found");

      const match = rawPath.match(/\/messages\/([^/]+)\/document$/);
      if (!match) return badRequest("Invalid document path");
      const [, messageId] = match;

      const { resolveDocumentDownloadUrl } = await import(
        "../../lib/conversations/document-messages.js"
      );
      const result = await resolveDocumentDownloadUrl({
        tenantId: auth.tenantId,
        botId,
        conversationId,
        messageId: decodeURIComponent(messageId),
      });
      if (!result) return notFound("Document not found");
      return ok(result);
    }

    if (method === "GET" && rawPath.includes("/messages/") && rawPath.includes("/attachments/")) {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");
      await assertCanAccessConversation(auth, conversation);

      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }
      if (conversation.botId !== botId) return notFound("Conversation not found");

      const match = rawPath.match(/\/messages\/([^/]+)\/attachments\/([^/]+)$/);
      if (!match) return badRequest("Invalid attachment path");
      const [, messageId, attachmentId] = match;

      const { resolveEmailAttachmentUrl } = await import("../../lib/email/attachments.js");
      const result = await resolveEmailAttachmentUrl({
        tenantId: auth.tenantId,
        botId,
        conversationId,
        messageId: decodeURIComponent(messageId),
        attachmentId: decodeURIComponent(attachmentId),
      });
      if (!result) return notFound("Attachment not found");
      return ok(result);
    }

    if (method === "GET" && rawPath.includes("/messages/") && rawPath.endsWith("/html")) {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");
      await assertCanAccessConversation(auth, conversation);

      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }
      if (conversation.botId !== botId) return notFound("Conversation not found");

      const match = rawPath.match(/\/messages\/([^/]+)\/html$/);
      if (!match) return badRequest("Invalid html path");
      const [, messageId] = match;

      const { resolveEmailHtmlBody } = await import("../../lib/email/attachments.js");
      const result = await resolveEmailHtmlBody({
        tenantId: auth.tenantId,
        botId,
        conversationId,
        messageId: decodeURIComponent(messageId),
      });
      if (!result) return notFound("HTML body not found");
      return ok(result);
    }

    if (method === "DELETE" && !subPath) {
      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== botId) {
        return notFound("Conversation not found");
      }

      await assertCanAccessConversation(auth, conversation);

      const deleted = await deleteConversation(auth.tenantId, botId, conversationId);
      if (!deleted) return notFound("Conversation not found");

      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
