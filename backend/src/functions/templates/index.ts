import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import {
  listCachedTemplates,
  getCachedTemplate,
  upsertCachedTemplate,
  deleteCachedTemplate,
  syncTemplates,
} from "../../lib/dynamodb/template.repository.js";
import {
  listMetaTemplates,
  createMetaTemplate,
  editMetaTemplate,
  deleteMetaTemplate,
  sendTemplateMessage,
  getWhatsAppAccessToken,
} from "../../lib/whatsapp/client.js";
import type { SendTemplateOptions } from "../../lib/whatsapp/client.js";
import { extractAuthContext } from "../../lib/auth/cognito.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { WhatsAppTemplate, TemplateComponent } from "../../types/index.js";

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

const ComponentSchema = z
  .object({
    type: z.enum(["HEADER", "BODY", "FOOTER", "BUTTONS"]),
    format: z.enum(["TEXT", "IMAGE", "VIDEO", "DOCUMENT"]).optional(),
    text: z.string().optional(),
    example: z
      .object({
        header_text: z.array(z.string()).optional(),
        body_text: z.array(z.array(z.string())).optional(),
      })
      .optional(),
    buttons: z
      .array(
        z.object({
          type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
          text: z.string(),
          url: z.string().optional(),
          phone_number: z.string().optional(),
          example: z.array(z.string()).optional(),
        })
      )
      .optional(),
  })
  .superRefine((comp, ctx) => {
    if (comp.type === "BODY" && comp.text && /\{\{\d+\}\}/.test(comp.text)) {
      const rows = comp.example?.body_text;
      if (!rows?.length || !rows[0]?.length || rows[0].some((v) => !v.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'BODY component has variables ({{N}}) but is missing "example.body_text" with non-empty sample values. Meta requires examples for every variable.',
        });
      }
    }
  });

const CreateTemplateSchema = z.object({
  botId: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  components: z.array(ComponentSchema).min(1),
});

const UpdateTemplateSchema = z.object({
  botId: z.string().min(1),
  components: z.array(ComponentSchema).min(1),
});

const SendTemplateSchema = z.object({
  botId: z.string().min(1),
  to: z.string().min(10),
  language: z.string().min(2).max(10),
  components: z
    .array(
      z.object({
        type: z.string(),
        parameters: z
          .array(
            z.object({
              type: z.string(),
              text: z.string().optional(),
              image: z.object({ link: z.string() }).optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

async function loadBotAndToken(tenantId: string, botId: string) {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });
  const accessToken = await getWhatsAppAccessToken(tenantId, ENVIRONMENT);
  return { bot, accessToken };
}

function assertWabaId(wabaId: string, phoneNumberId: string): void {
  if (!wabaId) {
    throw Object.assign(
      new Error("Bot misconfigured: whatsappBusinessAccountId is empty. Update the bot settings."),
      { statusCode: 400 }
    );
  }
  if (wabaId === phoneNumberId) {
    throw Object.assign(
      new Error(
        "Bot misconfigured: whatsappBusinessAccountId must be the WABA ID, not the Phone Number ID. " +
        "Go to Meta Business Suite → WhatsApp Manager → Account settings to find the correct WABA ID."
      ),
      { statusCode: 400 }
    );
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    const method = event.requestContext.http.method;
    const templateName = event.pathParameters?.name;
    const params = event.queryStringParameters ?? {};
    const path = event.rawPath;
    const isSendRoute = templateName && path.endsWith("/send");

    if (method === "GET" && !templateName) {
      const botId = params.botId;
      if (!botId) return badRequest("botId query parameter is required");

      const { bot, accessToken } = await loadBotAndToken(auth.tenantId, botId);
      assertWabaId(bot.whatsappBusinessAccountId, bot.phoneNumberId);
      const metaTemplates = await listMetaTemplates(bot.whatsappBusinessAccountId, accessToken);

      const now = new Date().toISOString();
      const templates: WhatsAppTemplate[] = metaTemplates.map((mt) => ({
        templateId: mt.id,
        tenantId: auth.tenantId,
        botId,
        name: mt.name,
        language: mt.language,
        category: mt.category,
        status: mt.status,
        components: mt.components,
        metaTemplateId: mt.id,
        syncedAt: now,
        createdAt: now,
      }));

      await syncTemplates(auth.tenantId, botId, templates);

      return ok(templates);
    }

    if (method === "POST" && isSendRoute && templateName) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = SendTemplateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId, to, language, components } = parsed.data;
      const { bot, accessToken } = await loadBotAndToken(auth.tenantId, botId);

      const result = await sendTemplateMessage({
        phoneNumberId: bot.phoneNumberId,
        to,
        templateName,
        language,
        ...(components ? { components } : {}),
        accessToken,
      } as SendTemplateOptions);

      return ok(result);
    }

    if (method === "POST" && !templateName) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = CreateTemplateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId, name, language, category } = parsed.data;
      const comps = parsed.data.components as TemplateComponent[];
      const { bot, accessToken } = await loadBotAndToken(auth.tenantId, botId);
      assertWabaId(bot.whatsappBusinessAccountId, bot.phoneNumberId);

      const metaResult = await createMetaTemplate(bot.whatsappBusinessAccountId, accessToken, {
        name,
        language,
        category,
        components: comps,
      });

      const now = new Date().toISOString();
      const template: WhatsAppTemplate = {
        templateId: randomUUID(),
        tenantId: auth.tenantId,
        botId,
        name,
        language,
        category,
        status: "PENDING",
        components: comps,
        metaTemplateId: metaResult.id,
        syncedAt: now,
        createdAt: now,
      };

      await upsertCachedTemplate(auth.tenantId, botId, template);

      return created(template);
    }

    if (method === "PUT" && templateName) {
      const body = JSON.parse(event.body ?? "{}");
      const parsed = UpdateTemplateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId } = parsed.data;
      const comps = parsed.data.components as TemplateComponent[];
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId);

      const language = params.language ?? "es";
      const cached = await getCachedTemplate(auth.tenantId, botId, templateName, language);
      if (!cached?.metaTemplateId) return notFound("Template not found in cache");

      await editMetaTemplate(cached.metaTemplateId, accessToken, { components: comps });

      const updated: WhatsAppTemplate = {
        ...cached,
        components: comps,
        status: "PENDING",
        syncedAt: new Date().toISOString(),
      };

      await upsertCachedTemplate(auth.tenantId, botId, updated);

      return ok(updated);
    }

    if (method === "DELETE" && templateName) {
      const botId = params.botId;
      if (!botId) return badRequest("botId query parameter is required");

      const { bot: deleteBot, accessToken } = await loadBotAndToken(auth.tenantId, botId);
      assertWabaId(deleteBot.whatsappBusinessAccountId, deleteBot.phoneNumberId);

      await deleteMetaTemplate(deleteBot.whatsappBusinessAccountId, templateName, accessToken);

      const cached = await listCachedTemplates(auth.tenantId, botId);
      const toDelete = cached.filter((t) => t.name === templateName);
      for (const t of toDelete) {
        await deleteCachedTemplate(auth.tenantId, botId, t.name, t.language);
      }

      return noContent();
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
