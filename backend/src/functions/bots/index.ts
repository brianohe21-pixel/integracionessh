import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  getBot,
  createBot,
  updateBot,
  deleteBot,
  listBots,
} from "../../lib/dynamodb/bot.repository.js";
import { resolveRequestAuth, assertTenantAccess, assertMemberRole } from "../../lib/auth/cognito.js";
import { ensureTenant } from "../../lib/dynamodb/tenant.repository.js";
import { assertCanCreateBot, assertCanUseWebChat, assertCanEnableChannel, assertCanStartLiveKitCall, assertCanUseVoicebot } from "../../lib/billing/assert-plan.js";
import { putWidgetKeyLookup, putSmsNumberLookup, deleteSmsNumberLookup, putEmailAddressLookup, deleteEmailAddressLookup, putVoicebotWidgetKeyLookup, deleteVoicebotWidgetKeyLookup } from "../../lib/dynamodb/bot-lookup.repository.js";
import { generateWidgetKey } from "../../lib/webchat/session.repository.js";
import { generateVoicebotWidgetKey } from "../../lib/voicebot/session.repository.js";
import { assertAllowedModel, assertCanEnableKnowledge } from "../../lib/billing/plan-config.js";
import {
  assertAiAssistantActive,
  assertCanDisableAiAssistant,
  buildAiAssistantAutoEnableUpdates,
  toAiAssistantConfig,
} from "../../lib/ai-assistant/config.js";
import { TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH } from "../../lib/telephony/limits.js";
import {
  DEFAULT_MODEL_ID,
  getModelProviderMismatch,
  isValidModelId,
} from "../../lib/ai/models.js";
import {
  getWhatsAppAccessToken,
  getPhoneNumberInfo,
  type WhatsAppPhoneInfo,
} from "../../lib/whatsapp/client.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import { shouldRegisterSmsInboundLookup } from "../../lib/sms/client.js";
import { enqueueWhatsAppSync } from "../../lib/whatsapp/coexistence/sync-queue.js";
import type { Bot } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";
const WHATSAPP_SYNC_QUEUE_URL = process.env.WHATSAPP_SYNC_QUEUE_URL ?? "";

type BotDetailResponse = Bot & { whatsappPhone?: WhatsAppPhoneInfo | null };

function maskBot(bot: Bot): Bot {
  if (!bot.webhookSecret) return bot;
  return { ...bot, webhookSecret: "***" };
}

const AiProviderSchema = z.enum(["openai"]);

const ModelSchema = z.string().refine(isValidModelId, { message: "Invalid model" });

const CreateBotSchema = z
  .object({
    name: z.string().min(1).max(128),
    defaultLocale: z.enum(["es", "en"]).optional(),
    responseMode: z.enum(["none", "openai", "webhook"]).default("none"),
    systemPrompt: z.string().min(1).max(4096).optional(),
    aiProvider: AiProviderSchema.optional(),
    model: ModelSchema.default(DEFAULT_MODEL_ID),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(1).max(4096).default(1024),
    webhookUrl: z.string().url().startsWith("https://").max(2048).optional(),
    webhookSecret: z.string().min(8).max(256).optional(),
    phoneNumberId: z.string().optional().default(""),
    whatsappBusinessAccountId: z.string().optional().default(""),
    whatsappOnboardingMode: z.enum(["cloud_api", "coexistence"]).optional(),
    isOnBizApp: z.boolean().optional(),
    platformType: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.responseMode === "openai" && !data.systemPrompt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "systemPrompt is required when responseMode is openai",
        path: ["systemPrompt"],
      });
    }
    if (data.responseMode === "webhook" && !data.webhookUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "webhookUrl is required when responseMode is webhook",
        path: ["webhookUrl"],
      });
    }
  });

const UpdateBotSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  defaultLocale: z.enum(["es", "en"]).optional(),
  responseMode: z.enum(["none", "webhook"]).optional(),
  webhookUrl: z.string().url().startsWith("https://").max(2048).optional(),
  webhookSecret: z.string().min(8).max(256).optional(),
  phoneNumberId: z.string().min(1).optional(),
  whatsappBusinessAccountId: z.string().min(1).optional(),
  whatsappOnboardingMode: z.enum(["cloud_api", "coexistence"]).optional(),
  isOnBizApp: z.boolean().optional(),
  platformType: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const AiAssistantUpdateSchema = z.object({
  systemPrompt: z.string().min(1).max(4096).optional(),
  aiProvider: AiProviderSchema.optional(),
  model: ModelSchema.optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  knowledgeEnabled: z.boolean().optional(),
});

const AiAssistantEnableSchema = z.object({
  systemPrompt: z.string().min(1).max(4096),
  aiProvider: AiProviderSchema.optional(),
  model: ModelSchema.default(DEFAULT_MODEL_ID),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(4096).default(1024),
  knowledgeEnabled: z.boolean().optional(),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const botId = event.pathParameters?.botId;
    const rawPath = event.rawPath ?? event.requestContext.http.path;

    if (botId && method === "POST" && rawPath.includes("/webchat/rotate-key")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertCanUseWebChat(tenant);
      await assertCanEnableChannel(tenant, existing, "webchat");

      const newKey = generateWidgetKey();
      if (existing.webchatWidgetKey) {
        const { deleteWidgetKeyLookup } = await import(
          "../../lib/dynamodb/bot-lookup.repository.js"
        );
        await deleteWidgetKeyLookup(existing.webchatWidgetKey);
      }
      await putWidgetKeyLookup(newKey, auth.tenantId, botId);
      const updated = await updateBot(auth.tenantId, botId, {
        webchatWidgetKey: newKey,
        webchatEnabled: true,
      });
      return ok({ webchatWidgetKey: updated.webchatWidgetKey, webchatEnabled: true });
    }

    if (botId && method === "PUT" && rawPath.includes("/webchat")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          webchatVoiceEnabled: z.boolean().optional(),
          webchatVideoEnabled: z.boolean().optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);

      if (parsed.data.enabled === true) {
        await assertCanUseWebChat(tenant);
        await assertCanEnableChannel(tenant, existing, "webchat");
      }

      let widgetKey = existing.webchatWidgetKey;
      if (parsed.data.enabled === true && !widgetKey) {
        widgetKey = generateWidgetKey();
        await putWidgetKeyLookup(widgetKey, auth.tenantId, botId);
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.enabled !== undefined) {
        updates.webchatEnabled = parsed.data.enabled;
        if (widgetKey) updates.webchatWidgetKey = widgetKey;
      }
      if (parsed.data.webchatVoiceEnabled !== undefined) {
        if (parsed.data.webchatVoiceEnabled) await assertCanStartLiveKitCall(tenant);
        updates.webchatVoiceEnabled = parsed.data.webchatVoiceEnabled;
      }
      if (parsed.data.webchatVideoEnabled !== undefined) {
        updates.webchatVideoEnabled = parsed.data.webchatVideoEnabled;
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok({
        webchatEnabled: updated.webchatEnabled,
        webchatWidgetKey: updated.webchatWidgetKey,
        webchatVoiceEnabled: updated.webchatVoiceEnabled,
        webchatVideoEnabled: updated.webchatVideoEnabled,
      });
    }

    if (botId && method === "PUT" && rawPath.includes("/sms")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          smsOriginationNumber: z
            .string()
            .min(1)
            .max(15)
            .regex(/^(?:\d{1,15}|[a-zA-Z0-9]{1,11})$/, "Invalid Telcored sender label")
            .optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      if (parsed.data.enabled === true) {
        await assertCanEnableChannel(tenant, existing, "sms");
      }

      if (
        existing.smsOriginationNumber &&
        parsed.data.smsOriginationNumber &&
        existing.smsOriginationNumber !== parsed.data.smsOriginationNumber
      ) {
        await deleteSmsNumberLookup(existing.smsOriginationNumber);
      }

      const number = parsed.data.smsOriginationNumber ?? existing.smsOriginationNumber;
      if (parsed.data.enabled === true && number && shouldRegisterSmsInboundLookup(number)) {
        await putSmsNumberLookup(number, auth.tenantId, botId);
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.enabled !== undefined) updates.smsEnabled = parsed.data.enabled;
      if (parsed.data.smsOriginationNumber) {
        updates.smsOriginationNumber = parsed.data.smsOriginationNumber;
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok({
        smsEnabled: updated.smsEnabled,
        smsOriginationNumber: updated.smsOriginationNumber,
      });
    }

    if (botId && method === "PUT" && rawPath.includes("/email")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          emailAddress: z.string().email().optional(),
          inboundProvider: z.enum(["ses", "imap"]).optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      if (existing.emailInboundProvider === "imap" && parsed.data.inboundProvider !== "ses") {
        return badRequest("Disconnect IMAP before changing SES settings");
      }

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      if (parsed.data.enabled === true) {
        await assertCanEnableChannel(tenant, existing, "email");
      }

      if (
        existing.emailAddress &&
        parsed.data.emailAddress &&
        existing.emailAddress !== parsed.data.emailAddress
      ) {
        await deleteEmailAddressLookup(existing.emailAddress);
      }

      const address = parsed.data.emailAddress ?? existing.emailAddress;
      if (parsed.data.enabled === true && address) {
        await putEmailAddressLookup(address, auth.tenantId, botId);
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.enabled !== undefined) updates.emailEnabled = parsed.data.enabled;
      if (parsed.data.emailAddress) {
        updates.emailAddress = parsed.data.emailAddress.toLowerCase();
      }
      if (parsed.data.inboundProvider) {
        updates.emailInboundProvider = parsed.data.inboundProvider;
      } else if (!existing.emailInboundProvider && parsed.data.enabled === true) {
        updates.emailInboundProvider = "ses";
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok({
        emailEnabled: updated.emailEnabled,
        emailAddress: updated.emailAddress,
        emailInboundProvider: updated.emailInboundProvider,
      });
    }

    if (botId && method === "PUT" && rawPath.includes("/voicebot")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = z
        .object({
          enabled: z.boolean().optional(),
          voicebotVoice: z.string().min(2).max(32).optional(),
          voicebotModel: z.string().min(3).max(64).optional(),
          voicebotTranscriptionModel: z.string().min(3).max(64).optional(),
          voicebotGreeting: z.string().max(500).optional(),
          voicebotSystemPrompt: z.string().max(TELEPHONY_SYSTEM_PROMPT_MAX_LENGTH).optional(),
        })
        .safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      const aiAssistantUpdates =
        parsed.data.enabled === true ? buildAiAssistantAutoEnableUpdates(existing) : {};
      if (parsed.data.enabled === true) {
        await assertCanUseVoicebot(tenant);
        await assertCanEnableChannel(tenant, existing, "voicebot");
      }

      let widgetKey = existing.voicebotWidgetKey;
      if (parsed.data.enabled === true && !widgetKey) {
        widgetKey = generateVoicebotWidgetKey();
        await putVoicebotWidgetKeyLookup(widgetKey, auth.tenantId, botId);
      }

      const updates: Record<string, unknown> = { ...aiAssistantUpdates };
      if (parsed.data.enabled !== undefined) {
        updates.voicebotEnabled = parsed.data.enabled;
        if (widgetKey) updates.voicebotWidgetKey = widgetKey;
      }
      if (parsed.data.voicebotVoice !== undefined) {
        updates.voicebotVoice = parsed.data.voicebotVoice;
      }
      if (parsed.data.voicebotModel !== undefined) {
        updates.voicebotModel = parsed.data.voicebotModel;
      }
      if (parsed.data.voicebotTranscriptionModel !== undefined) {
        updates.voicebotTranscriptionModel = parsed.data.voicebotTranscriptionModel;
      }
      if (parsed.data.voicebotGreeting !== undefined) {
        updates.voicebotGreeting = parsed.data.voicebotGreeting;
      }
      if (parsed.data.voicebotSystemPrompt !== undefined) {
        updates.voicebotSystemPrompt = parsed.data.voicebotSystemPrompt;
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok({
        voicebotEnabled: updated.voicebotEnabled,
        voicebotWidgetKey: updated.voicebotWidgetKey,
        voicebotVoice: updated.voicebotVoice,
        voicebotModel: updated.voicebotModel,
        voicebotTranscriptionModel: updated.voicebotTranscriptionModel,
        voicebotGreeting: updated.voicebotGreeting,
        voicebotSystemPrompt: updated.voicebotSystemPrompt,
      });
    }

    if (botId && method === "POST" && rawPath.includes("/voicebot/rotate-key")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertCanUseVoicebot(tenant);
      await assertCanEnableChannel(tenant, existing, "voicebot");

      const newKey = generateVoicebotWidgetKey();
      if (existing.voicebotWidgetKey) {
        await deleteVoicebotWidgetKeyLookup(existing.voicebotWidgetKey);
      }
      await putVoicebotWidgetKeyLookup(newKey, auth.tenantId, botId);
      const updated = await updateBot(auth.tenantId, botId, {
        voicebotWidgetKey: newKey,
        voicebotEnabled: true,
      });
      return ok({
        voicebotEnabled: updated.voicebotEnabled,
        voicebotWidgetKey: updated.voicebotWidgetKey,
      });
    }

    if (botId && method === "GET" && rawPath.includes("/ai-assistant")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);
      return ok(toAiAssistantConfig(existing));
    }

    if (botId && method === "PUT" && rawPath.includes("/ai-assistant")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);
      assertAiAssistantActive(existing);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = AiAssistantUpdateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      if (parsed.data.model) {
        assertAllowedModel(tenant, parsed.data.model);
        const providerMismatch = getModelProviderMismatch(
          parsed.data.model,
          parsed.data.aiProvider
        );
        if (providerMismatch) return badRequest(providerMismatch);
      }
      if (parsed.data.knowledgeEnabled === true) {
        assertCanEnableKnowledge(tenant);
      }

      const updates: Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">> = {};
      if (parsed.data.systemPrompt !== undefined) updates.systemPrompt = parsed.data.systemPrompt;
      if (parsed.data.model !== undefined) updates.model = parsed.data.model;
      if (parsed.data.temperature !== undefined) updates.temperature = parsed.data.temperature;
      if (parsed.data.maxTokens !== undefined) updates.maxTokens = parsed.data.maxTokens;
      if (parsed.data.aiProvider !== undefined) updates.aiProvider = parsed.data.aiProvider;
      if (parsed.data.knowledgeEnabled !== undefined) {
        updates.knowledgeEnabled = parsed.data.knowledgeEnabled;
      }

      const updated = await updateBot(auth.tenantId, botId, updates);
      return ok(toAiAssistantConfig(updated));
    }

    if (botId && method === "POST" && rawPath.endsWith("/ai-assistant/enable")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = AiAssistantEnableSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      assertAllowedModel(tenant, parsed.data.model);
      const providerMismatch = getModelProviderMismatch(parsed.data.model, parsed.data.aiProvider);
      if (providerMismatch) return badRequest(providerMismatch);
      if (parsed.data.knowledgeEnabled === true) {
        assertCanEnableKnowledge(tenant);
      }

      const updated = await updateBot(auth.tenantId, botId, {
        responseMode: "openai",
        systemPrompt: parsed.data.systemPrompt,
        model: parsed.data.model,
        temperature: parsed.data.temperature,
        maxTokens: parsed.data.maxTokens,
        ...(parsed.data.aiProvider ? { aiProvider: parsed.data.aiProvider } : {}),
        ...(parsed.data.knowledgeEnabled !== undefined
          ? { knowledgeEnabled: parsed.data.knowledgeEnabled }
          : {}),
      });
      return ok(toAiAssistantConfig(updated));
    }

    if (botId && method === "POST" && rawPath.endsWith("/ai-assistant/disable")) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);
      assertCanDisableAiAssistant(existing);

      const updated = await updateBot(auth.tenantId, botId, { responseMode: "none" });
      return ok(toAiAssistantConfig(updated));
    }

    if (method === "GET" && !botId) {
      const bots = await listBots(auth.tenantId);
      return ok(bots.map(maskBot));
    }

    if (method === "GET" && botId) {
      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");
      assertTenantAccess(auth, bot.tenantId);

      const response: BotDetailResponse = maskBot(bot);
      try {
        const accessToken = await getWhatsAppAccessToken(auth.tenantId, ENVIRONMENT);
        response.whatsappPhone = await getPhoneNumberInfo(bot.phoneNumberId, accessToken);
      } catch {
        response.whatsappPhone = null;
      }

      return ok(response);
    }

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateBotSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const tenant = await ensureTenant(auth.tenantId, auth.email, auth.name);
      await assertCanCreateBot(tenant);

      const now = new Date().toISOString();
      const data = parsed.data;

      if (data.responseMode === "openai") {
        assertAllowedModel(tenant, data.model);
        const providerMismatch = getModelProviderMismatch(data.model, data.aiProvider);
        if (providerMismatch) return badRequest(providerMismatch);
      }

      const base = {
        botId: randomUUID(),
        tenantId: auth.tenantId,
        responseMode: data.responseMode,
        name: data.name,
        phoneNumberId: data.phoneNumberId,
        whatsappBusinessAccountId: data.whatsappBusinessAccountId,
        ...(data.whatsappOnboardingMode
          ? { whatsappOnboardingMode: data.whatsappOnboardingMode }
          : {}),
        ...(data.isOnBizApp !== undefined ? { isOnBizApp: data.isOnBizApp } : {}),
        ...(data.platformType ? { platformType: data.platformType } : {}),
        status: "active" as const,
        createdAt: now,
        updatedAt: now,
      };

      let newBot: Bot;
      if (data.responseMode === "openai") {
        if (!data.systemPrompt) {
          return badRequest("systemPrompt is required when responseMode is openai");
        }
        newBot = {
          ...base,
          systemPrompt: data.systemPrompt,
          model: data.model,
          ...(data.aiProvider ? { aiProvider: data.aiProvider } : {}),
          temperature: data.temperature,
          maxTokens: data.maxTokens,
        };
      } else if (data.responseMode === "webhook") {
        if (!data.webhookUrl) {
          return badRequest("webhookUrl is required when responseMode is webhook");
        }
        newBot = {
          ...base,
          webhookUrl: data.webhookUrl,
          ...(data.webhookSecret !== undefined ? { webhookSecret: data.webhookSecret } : {}),
        };
      } else {
        newBot = base;
      }

      await createBot(newBot);

      if (
        newBot.whatsappOnboardingMode === "coexistence" &&
        newBot.phoneNumberId?.trim() &&
        WHATSAPP_SYNC_QUEUE_URL
      ) {
        await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
          jobType: "start_sync",
          tenantId: newBot.tenantId,
          botId: newBot.botId,
          phoneNumberId: newBot.phoneNumberId,
          dedupeKey: `start-sync-${newBot.botId}`,
        });
      }

      return created(newBot);
    }

    if (method === "PUT" && botId) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateBotSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      if (parsed.data.responseMode === "webhook" && !parsed.data.webhookUrl && !existing.webhookUrl) {
        return badRequest("webhookUrl is required when responseMode is webhook");
      }
      if (parsed.data.responseMode === "webhook" && existing.responseMode === "openai") {
        assertCanDisableAiAssistant(existing);
      }

      const updated = await updateBot(
        auth.tenantId,
        botId,
        parsed.data as Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">>
      );

      if (
        updated.whatsappOnboardingMode === "coexistence" &&
        updated.phoneNumberId?.trim() &&
        WHATSAPP_SYNC_QUEUE_URL &&
        (parsed.data.phoneNumberId || parsed.data.whatsappOnboardingMode === "coexistence")
      ) {
        const syncPending =
          !updated.whatsappSyncStatus?.contacts ||
          updated.whatsappSyncStatus.contacts === "pending" ||
          updated.whatsappSyncStatus.contacts === "failed";
        if (syncPending) {
          await enqueueWhatsAppSync(WHATSAPP_SYNC_QUEUE_URL, {
            jobType: "start_sync",
            tenantId: updated.tenantId,
            botId: updated.botId,
            phoneNumberId: updated.phoneNumberId,
            dedupeKey: `start-sync-${updated.botId}-${Date.now()}`,
          });
        }
      }

      return ok(updated);
    }

    if (method === "DELETE" && botId) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      await deleteBot(auth.tenantId, botId);
      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
