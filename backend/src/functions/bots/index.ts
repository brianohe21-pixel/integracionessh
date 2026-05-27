import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import {
  getBot,
  createBot,
  updateBot,
  deleteBot,
  listBots,
} from "../../lib/dynamodb/bot.repository.js";
import { extractAuthContext, assertTenantAccess } from "../../lib/auth/cognito.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { Bot } from "../../types/index.js";

function maskBot(bot: Bot): Bot {
  if (!bot.webhookSecret) return bot;
  return { ...bot, webhookSecret: "***" };
}

const CreateBotSchema = z
  .object({
    name: z.string().min(1).max(128),
    responseMode: z.enum(["openai", "webhook"]).default("openai"),
    systemPrompt: z.string().min(1).max(4096).optional(),
    model: z.enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]).default("gpt-4o"),
    temperature: z.number().min(0).max(2).default(0.7),
    maxTokens: z.number().int().min(1).max(4096).default(1024),
    webhookUrl: z.string().url().startsWith("https://").max(2048).optional(),
    webhookSecret: z.string().min(8).max(256).optional(),
    phoneNumberId: z.string().min(1),
    whatsappBusinessAccountId: z.string().min(1),
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
  responseMode: z.enum(["openai", "webhook"]).optional(),
  systemPrompt: z.string().min(1).max(4096).optional(),
  model: z.enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(4096).optional(),
  webhookUrl: z.string().url().startsWith("https://").max(2048).optional(),
  webhookSecret: z.string().min(8).max(256).optional(),
  phoneNumberId: z.string().min(1).optional(),
  whatsappBusinessAccountId: z.string().min(1).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const botId = event.pathParameters?.botId;

    if (method === "GET" && !botId) {
      const bots = await listBots(auth.tenantId);
      return ok(bots.map(maskBot));
    }

    if (method === "GET" && botId) {
      const bot = await getBot(auth.tenantId, botId);
      if (!bot) return notFound("Bot not found");
      assertTenantAccess(auth, bot.tenantId);
      return ok(maskBot(bot));
    }

    if (method === "POST") {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateBotSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const now = new Date().toISOString();
      const { responseMode, systemPrompt, model, temperature, maxTokens, webhookUrl, webhookSecret, ...rest } = parsed.data;
      const newBot: Bot = {
        botId: randomUUID(),
        tenantId: auth.tenantId,
        responseMode,
        ...(responseMode === "openai"
          ? { systemPrompt, model, temperature, maxTokens }
          : { webhookUrl, webhookSecret }),
        ...rest,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };

      await createBot(newBot);
      return created(newBot);
    }

    if (method === "PUT" && botId) {
      const existing = await getBot(auth.tenantId, botId);
      if (!existing) return notFound("Bot not found");
      assertTenantAccess(auth, existing.tenantId);

      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateBotSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const updated = await updateBot(
        auth.tenantId,
        botId,
        parsed.data as Partial<Omit<Bot, "tenantId" | "botId" | "createdAt">>
      );
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
