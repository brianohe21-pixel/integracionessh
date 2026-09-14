import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { ResourceNotFoundException } from "@aws-sdk/client-secrets-manager";
import { z } from "zod";
import { randomUUID } from "crypto";
import { getBot, listBots } from "../../lib/dynamodb/bot.repository.js";
import { getTenant } from "../../lib/dynamodb/tenant.repository.js";
import {
  listCachedTemplates,
  getCachedTemplate,
  upsertCachedTemplate,
  deleteCachedTemplate,
  syncTemplates,
  listSmsTemplates,
  getSmsTemplate,
  upsertSmsTemplate,
  deleteSmsTemplate,
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
import { assertWhatsAppOutboundAllowed } from "../../lib/whatsapp/outbound-guard.js";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import {
  sendTemplateApprovedEmail,
  sendTemplateCreatedEmail,
} from "../../lib/email/template-status-notify.js";
import { sendSmsFromTemplate } from "../../lib/sms/send-outbound.js";
import { ok, created, noContent, badRequest, notFound, handleError } from "../../lib/http.js";
import type { OutreachChannel, WhatsAppTemplate, TemplateComponent, SmsTemplate } from "../../types/index.js";

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
    if (comp.type === "HEADER" && comp.text && /\{\{\d+\}\}/.test(comp.text)) {
      const samples = comp.example?.header_text;
      if (!samples?.length || samples.some((v) => !v.trim()) || /\{\{\d+\}\}/.test(samples.join(" "))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'HEADER component has variables ({{N}}) but is missing "example.header_text" with realistic sample values. Meta requires examples for every variable.',
        });
      }
    }
    if (comp.type === "BODY" && comp.text && /\{\{\d+\}\}/.test(comp.text)) {
      const rows = comp.example?.body_text;
      if (
        !rows?.length ||
        !rows[0]?.length ||
        rows[0].some((v) => !v.trim() || /\{\{\d+\}\}/.test(v))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'BODY component has variables ({{N}}) but is missing "example.body_text" with realistic sample values. Meta requires examples for every variable.',
        });
      }
    }
  });

const CreateTemplateSchema = z.object({
  channel: z.enum(["whatsapp"]).optional(),
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

const CreateSmsTemplateSchema = z.object({
  channel: z.literal("sms"),
  botId: z.string().min(1),
  name: z
    .string()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  body: z.string().min(1).max(1600),
});

const UpdateTemplateSchema = z.object({
  botId: z.string().min(1),
  components: z.array(ComponentSchema).min(1),
});

const UpdateSmsTemplateSchema = z.object({
  channel: z.literal("sms"),
  botId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

const SendTemplateSchema = z.object({
  botId: z.string().min(1),
  to: z.string().min(10),
  language: z.string().min(2).max(10),
  channel: z.enum(["whatsapp", "sms"]).optional(),
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
  requestDlr: z.boolean().optional().default(false),
});

function parseChannel(
  params: Record<string, string | undefined>,
  body?: Record<string, unknown>
): OutreachChannel {
  const raw = body?.channel ?? params.channel;
  return raw === "sms" ? "sms" : "whatsapp";
}

async function listTemplatesForTenant(
  tenantId: string,
  channel: OutreachChannel
): Promise<Array<WhatsAppTemplate | SmsTemplate>> {
  const bots = await listBots(tenantId);
  const eligible =
    channel === "sms"
      ? bots.filter((bot) => bot.smsEnabled)
      : bots.filter((bot) => bot.phoneNumberId && bot.whatsappBusinessAccountId);

  const templates: Array<WhatsAppTemplate | SmsTemplate> = [];
  for (const bot of eligible) {
    if (channel === "sms") {
      templates.push(...(await listSmsTemplates(tenantId, bot.botId)));
    } else {
      templates.push(...(await listCachedTemplates(tenantId, bot.botId)));
    }
  }
  return templates;
}

async function loadBotAndToken(tenantId: string, botId: string) {
  const bot = await getBot(tenantId, botId);
  if (!bot) throw Object.assign(new Error("Bot not found"), { statusCode: 404 });

  let accessToken: string;
  try {
    accessToken = await getWhatsAppAccessToken(tenantId, ENVIRONMENT);
  } catch (error) {
    if (error instanceof ResourceNotFoundException) {
      throw Object.assign(
        new Error("WhatsApp is not connected. Complete WhatsApp setup in bot settings."),
        { statusCode: 400 }
      );
    }
    throw error;
  }

  if (!accessToken.trim()) {
    throw Object.assign(
      new Error("WhatsApp access token is missing. Reconnect WhatsApp in bot settings."),
      { statusCode: 400 }
    );
  }

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

async function notifyApprovedTemplates(
  tenantId: string,
  recipientEmail: string | undefined,
  templates: WhatsAppTemplate[]
): Promise<void> {
  if (templates.length === 0) return;

  const tenant = await getTenant(tenantId);
  const to = recipientEmail?.trim() || tenant?.email?.trim();
  if (!to || !tenant) return;

  for (const template of templates) {
    void sendTemplateApprovedEmail({
      to,
      tenantName: tenant.name,
      templateName: template.name,
      language: template.language,
      category: template.category,
    }).catch((error) => {
      console.error("Failed to send template approved email:", error);
    });
  }
}

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    await assertAssignedServices(auth.tenantId, "templates");
    const method = event.requestContext.http.method;
    const templateName = event.pathParameters?.name;
    const params = event.queryStringParameters ?? {};
    const path = event.rawPath;
    const isSendRoute = templateName && path.endsWith("/send");

    if (method === "GET" && !templateName) {
      const botId = params.botId;
      const channel = parseChannel(params);

      if (!botId) {
        const templates = await listTemplatesForTenant(auth.tenantId, channel);
        return ok(templates);
      }

      if (channel === "sms") {
        const bot = await getBot(auth.tenantId, botId);
        if (!bot) return notFound("Bot not found");
        const templates = await listSmsTemplates(auth.tenantId, botId);
        return ok(templates);
      }

      const { bot, accessToken } = await loadBotAndToken(auth.tenantId, botId);
      assertWabaId(bot.whatsappBusinessAccountId, bot.phoneNumberId);
      const metaTemplates = await listMetaTemplates(bot.whatsappBusinessAccountId, accessToken);

      const now = new Date().toISOString();
      const templates: WhatsAppTemplate[] = metaTemplates
        .filter((mt) => mt.id && mt.name)
        .map((mt) => ({
          templateId: mt.id,
          tenantId: auth.tenantId,
          botId,
          channel: "whatsapp",
          name: mt.name,
          language: mt.language,
          category: mt.category,
          status: mt.status,
          components: mt.components ?? [],
          metaTemplateId: mt.id,
          syncedAt: now,
          createdAt: now,
        }));

      try {
        const newlyApproved = await syncTemplates(auth.tenantId, botId, templates);
        await notifyApprovedTemplates(auth.tenantId, auth.email, newlyApproved);
      } catch (syncError) {
        console.error("syncTemplates failed:", syncError);
      }

      return ok(templates);
    }

    if (method === "POST" && isSendRoute && templateName) {
      const body = JSON.parse(event.body ?? "{}") as Record<string, unknown>;
      const parsed = SendTemplateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId, to, language, components, requestDlr } = parsed.data;
      const channel = parseChannel(params, body);

      if (channel === "sms") {
        const bot = await getBot(auth.tenantId, botId);
        if (!bot) return notFound("Bot not found");
        const result = await sendSmsFromTemplate({
          tenantId: auth.tenantId,
          bot,
          botId,
          templateName,
          language,
          to,
          environment: ENVIRONMENT,
          ...(components ? { components } : {}),
          ...(requestDlr ? { requestDlr: true, source: "template" } : {}),
        } as Parameters<typeof sendSmsFromTemplate>[0]);
        return ok(result);
      }

      const { bot, accessToken } = await loadBotAndToken(auth.tenantId, botId);

      await assertWhatsAppOutboundAllowed({
        tenantId: auth.tenantId,
        phoneNumberId: bot.phoneNumberId,
        kind: "marketing",
        to,
        requireOptIn: true,
      });

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
      const body = JSON.parse(event.body ?? "{}") as Record<string, unknown>;

      if (body.channel === "sms") {
        const parsed = CreateSmsTemplateSchema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const { botId, name, language, category, body: smsBody } = parsed.data;
        const bot = await getBot(auth.tenantId, botId);
        if (!bot) return notFound("Bot not found");

        const existing = await getSmsTemplate(auth.tenantId, botId, name, language);
        if (existing) return badRequest("SMS template already exists for this name and language");

        const now = new Date().toISOString();
        const template: SmsTemplate = {
          templateId: randomUUID(),
          tenantId: auth.tenantId,
          botId,
          channel: "sms",
          name,
          language,
          category,
          status: "APPROVED",
          body: smsBody,
          createdAt: now,
          updatedAt: now,
        };

        await upsertSmsTemplate(auth.tenantId, botId, template);
        return created(template);
      }

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
        channel: "whatsapp",
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

      const tenant = await getTenant(auth.tenantId);
      const recipient = auth.email?.trim() || tenant?.email?.trim();
      if (recipient && tenant) {
        void sendTemplateCreatedEmail({
          to: recipient,
          tenantName: tenant.name,
          templateName: template.name,
          language: template.language,
          category: template.category,
        }).catch((error) => {
          console.error("Failed to send template created email:", error);
        });
      }

      return created(template);
    }

    if (method === "PUT" && templateName) {
      const body = JSON.parse(event.body ?? "{}") as Record<string, unknown>;

      if (parseChannel(params, body) === "sms") {
        const parsed = UpdateSmsTemplateSchema.safeParse(body);
        if (!parsed.success) return badRequest(parsed.error.message);

        const language = params.language ?? "es";
        const existing = await getSmsTemplate(
          auth.tenantId,
          parsed.data.botId,
          templateName,
          language
        );
        if (!existing) return notFound("SMS template not found");

        const updated: SmsTemplate = {
          ...existing,
          body: parsed.data.body,
          updatedAt: new Date().toISOString(),
        };
        await upsertSmsTemplate(auth.tenantId, parsed.data.botId, updated);
        return ok(updated);
      }

      const parsed = UpdateTemplateSchema.safeParse(body);
      if (!parsed.success) return badRequest(parsed.error.message);

      const { botId } = parsed.data;
      const comps = parsed.data.components as TemplateComponent[];
      const { accessToken } = await loadBotAndToken(auth.tenantId, botId);

      const language = params.language ?? "es";
      const cached = await getCachedTemplate(auth.tenantId, botId, templateName, language);
      if (!cached?.metaTemplateId) return notFound("Template not found in cache");

      if (cached.status !== "REJECTED") {
        return badRequest(
          "Templates can only be edited when Meta has rejected them. Approved or pending templates cannot be modified."
        );
      }

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

      if (parseChannel(params) === "sms") {
        const language = params.language ?? "es";
        const existing = await getSmsTemplate(auth.tenantId, botId, templateName, language);
        if (!existing) return notFound("SMS template not found");
        await deleteSmsTemplate(auth.tenantId, botId, templateName, language);
        return noContent();
      }

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
