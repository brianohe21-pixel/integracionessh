import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  listConversations,
  getConversationMessages,
  findConversationById,
  addMessage,
  deleteConversation,
} from "../../lib/dynamodb/conversation.repository.js";
import { getAdvisorByCognitoUserId } from "../../lib/dynamodb/advisor.repository.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanSendMessages } from "../../lib/billing/assert-plan.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { PlanLimitError } from "../../lib/billing/plan-limits.js";
import {
  extractAuthContext,
  assertAdvisorOrMember,
  assertTenantManagerRole,
} from "../../lib/auth/cognito.js";
import { performHandoff, releaseToBot } from "../../lib/advisor/handoff.js";
import { resolveConversation } from "../../lib/advisor/resolve.js";
import { updateConversation } from "../../lib/dynamodb/conversation.repository.js";
import {
  getClientHandoffMessage,
  notifyAdvisorOfConversation,
} from "../../lib/advisor/notify.js";
import { buildWaMeLink } from "../../lib/advisor/wa-link.js";
import { getConversation } from "../../lib/dynamodb/conversation.repository.js";
import {
  sendTextMessage,
  getWhatsAppAccessToken,
  truncateWhatsAppText,
} from "../../lib/whatsapp/client.js";
import { ok, created, badRequest, notFound, forbidden, noContent, handleError } from "../../lib/http.js";
import type { AuthContext, Conversation, Message } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const HandoffSchema = z.object({
  botId: z.string().uuid(),
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

const NoteSchema = z.object({
  botId: z.string().uuid(),
  internalNote: z.string().max(2000),
});

const ResolveSchema = z.object({
  botId: z.string().uuid(),
  csatScore: z.number().int().min(1).max(5).optional(),
  releaseToBot: z.boolean().optional(),
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

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertAdvisorOrMember(auth);

    const method = event.requestContext.http.method;
    const conversationId = event.pathParameters?.conversationId;
    const params = event.queryStringParameters ?? {};
    const rawPath = event.rawPath ?? event.requestContext.http.path;

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
      const limit = params.limit ? parseInt(params.limit, 10) : 20;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      let assignedAdvisorId = params.assignedAdvisorId;

      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        if (!advisor) return ok([]);
        assignedAdvisorId = advisor.advisorId;
      }

      const listOptions: Parameters<typeof listConversations>[1] = { limit };
      if (botId) listOptions.botId = botId;
      if (handoffMode) listOptions.handoffMode = handoffMode;
      if (workflowStatus) listOptions.workflowStatus = workflowStatus;
      if (status) listOptions.status = status;
      if (assignedAdvisorId) listOptions.assignedAdvisorId = assignedAdvisorId;
      if (params.cursor) listOptions.cursor = params.cursor;

      const result = await listConversations(auth.tenantId, listOptions);

      return ok(result);
    }

    if (!conversationId) {
      return badRequest("Route not found");
    }

    const subPath = parseSubPath(rawPath, conversationId);

    if (method === "GET" && !subPath) {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");

      await assertCanAccessConversation(auth, conversation);

      const limit = params.limit ? parseInt(params.limit, 10) : 50;
      if (isNaN(limit) || limit < 1 || limit > 100) {
        return badRequest("Invalid limit parameter (1-100)");
      }

      const messages = await getConversationMessages(auth.tenantId, conversationId, limit);
      return ok(messages);
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
        const accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
        await sendTextMessage({
          phoneNumberId: bot.phoneNumberId,
          to: refreshed.phoneNumber,
          text: getClientHandoffMessage(),
          accessToken,
        });
        await notifyAdvisorOfConversation({
          tenantId: auth.tenantId,
          botId: parsed.data.botId,
          conversation: refreshed,
          phoneNumberId: bot.phoneNumberId,
          accessToken,
          lastMessagePreview: "",
          force: true,
        });
      }

      return ok(refreshed);
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

      const accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
      const text = truncateWhatsAppText(parsed.data.content);

      let sentByAdvisorId: string | undefined;
      if (auth.role === "advisor") {
        const advisor = await resolveAdvisorRecord(auth);
        sentByAdvisorId = advisor?.advisorId;
      }

      const waResult = await sendTextMessage({
        phoneNumberId: bot.phoneNumberId,
        to: conversation.phoneNumber,
        text,
        accessToken,
      });

      const now = new Date().toISOString();
      const message: Message = {
        messageId: `adv-${randomUUID()}`,
        conversationId,
        tenantId: auth.tenantId,
        role: "advisor",
        content: text,
        source: "panel",
        ...(sentByAdvisorId ? { sentByAdvisorId } : {}),
        ...(waResult?.messages?.[0]?.id
          ? { whatsappMessageId: waResult.messages[0].id }
          : {}),
        timestamp: now,
      };

      await addMessage(message, parsed.data.botId);
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

    if (method === "GET" && subPath === "wa-link") {
      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation) return notFound("Conversation not found");

      await assertCanAccessConversation(auth, conversation);

      return ok({
        url: buildWaMeLink(conversation.phoneNumber),
        phoneNumber: conversation.phoneNumber,
      });
    }

    if (method === "DELETE" && !subPath) {
      assertTenantManagerRole(auth);

      const botId = params.botId;
      if (!botId || !z.string().uuid().safeParse(botId).success) {
        return badRequest("botId query parameter is required");
      }

      const conversation = await findConversationById(auth.tenantId, conversationId);
      if (!conversation || conversation.botId !== botId) {
        return notFound("Conversation not found");
      }

      const deleted = await deleteConversation(auth.tenantId, botId, conversationId);
      if (!deleted) return notFound("Conversation not found");

      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
