import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { resolveRequestAuth, assertMemberRole } from "../../lib/auth/cognito.js";
import { assertAssignedServices } from "../../lib/billing/subaccount-services.js";
import { getBot } from "../../lib/dynamodb/bot.repository.js";
import { incrementMessages } from "../../lib/dynamodb/usage.repository.js";
import { assertOtpChannelReady, sendOtp, verifyOtp } from "../../lib/otp/service.js";
import { getTenantUsageMetrics } from "../../lib/dynamodb/metrics.repository.js";
import { getMarketingMetrics } from "../../lib/dynamodb/marketing-metrics.repository.js";
import { getLeadMetrics } from "../../lib/dynamodb/lead-metrics.repository.js";
import { getContactMetrics } from "../../lib/dynamodb/contact-metrics.repository.js";
import { getCallingMetrics } from "../../lib/dynamodb/call-metrics.repository.js";
import { getSalesMetrics } from "../../lib/dynamodb/sales-metrics.repository.js";
import { getInboxSlaMetrics } from "../../lib/dynamodb/inbox-sla-metrics.repository.js";
import { getAdvisorWorkloadMetrics } from "../../lib/dynamodb/advisor-workload.repository.js";
import { getConversationCategoryMetrics } from "../../lib/dynamodb/conversation-category-metrics.repository.js";
import { getWebsiteMetrics } from "../../lib/dynamodb/website-metrics.repository.js";
import { getWhatsAppUsageReport } from "../../lib/dynamodb/whatsapp-usage-metrics.repository.js";
import { getCampaignPerformanceReport } from "../../lib/dynamodb/campaign-performance.repository.js";
import { buildUsageMarketingCsv } from "../../lib/reports/metrics-csv.js";
import { getSmsHistoryPage, getSmsOverview } from "../../lib/dynamodb/sms-metrics.repository.js";
import type { SmsDlrSource, SmsHistoryStatus } from "../../types/index.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

const SMS_SOURCES = new Set<SmsDlrSource>(["api", "campaign", "template"]);
const SMS_STATUSES = new Set<SmsHistoryStatus>([
  "pending",
  "sent",
  "delivered",
  "delivery_failed",
  "send_failed",
]);

const SendSmsOtpSchema = z.object({
  botId: z.string().min(1),
  to: z.string().min(7).max(20).regex(/^\d+$/, "Phone number must contain only digits"),
  message: z.string().min(1).max(1024).optional(),
  maxAttempts: z.number().int().min(1).max(10).optional(),
});

const VerifySmsOtpSchema = z.object({
  to: z.string().min(7).max(20).regex(/^\d+$/, "Phone number must contain only digits"),
  code: z.string().min(4).max(10).regex(/^\d+$/, "Verification code must contain only digits"),
});

const ENVIRONMENT = process.env.ENVIRONMENT ?? "dev";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = await resolveRequestAuth(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;

    if (method === "GET" && rawPath.endsWith("/metrics/advisor-workload")) {
      await assertAssignedServices(auth.tenantId, ["supervisor", "metrics"]);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/export")) {
      const { filename, content } = await buildUsageMarketingCsv(auth.tenantId);
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Access-Control-Allow-Origin": "*",
        },
        body: content,
      };
    }

    if (method === "GET" && rawPath.endsWith("/metrics/leads")) {
      const leads = await getLeadMetrics(auth.tenantId);
      return ok(leads);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/contacts")) {
      await assertAssignedServices(auth.tenantId, "contacts");
      const contacts = await getContactMetrics(auth.tenantId);
      return ok(contacts);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/marketing")) {
      const marketing = await getMarketingMetrics(auth.tenantId);
      return ok(marketing);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/sms/history")) {
      await assertAssignedServices(auth.tenantId, "campaigns");
      const qs = event.queryStringParameters ?? {};
      const limitParam = qs.limit ? parseInt(qs.limit, 10) : undefined;
      const source = qs.source?.trim();
      const status = qs.status?.trim();
      const history = await getSmsHistoryPage(auth.tenantId, {
        ...(limitParam !== undefined && Number.isFinite(limitParam) ? { limit: limitParam } : {}),
        ...(qs.cursor ? { cursor: qs.cursor } : {}),
        ...(qs.from ? { from: qs.from } : {}),
        ...(qs.to ? { to: qs.to } : {}),
        ...(source && SMS_SOURCES.has(source as SmsDlrSource)
          ? { source: source as SmsDlrSource }
          : {}),
        ...(status && SMS_STATUSES.has(status as SmsHistoryStatus)
          ? { status: status as SmsHistoryStatus }
          : {}),
      });
      return ok(history);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/sms")) {
      await assertAssignedServices(auth.tenantId, "campaigns");
      const qs = event.queryStringParameters ?? {};
      const from = qs.from?.trim();
      const to = qs.to?.trim();
      const overview = await getSmsOverview(auth.tenantId, {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      return ok({ overview });
    }

    if (method === "POST" && rawPath.endsWith("/metrics/sms/otp/send")) {
      await assertAssignedServices(auth.tenantId, "campaigns");
      const parsed = SendSmsOtpSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
      }

      const bot = await getBot(auth.tenantId, parsed.data.botId);
      if (!bot || bot.status !== "active") {
        return badRequest("Bot not found or inactive");
      }
      assertOtpChannelReady(bot, "sms");

      const result = await sendOtp({
        tenantId: auth.tenantId,
        botId: parsed.data.botId,
        channel: "sms",
        to: parsed.data.to,
        ...(parsed.data.message ? { messageTemplate: parsed.data.message } : {}),
        ...(parsed.data.maxAttempts ? { maxAttempts: parsed.data.maxAttempts } : {}),
        environment: ENVIRONMENT,
      });

      await incrementMessages(auth.tenantId);
      return ok({
        destination: result.destination,
        channel: result.channel,
        messageId: result.messageId,
        expiresAt: result.expiresAt,
        maxAttempts: result.maxAttempts,
        ...(result.receiptId ? { traceId: result.receiptId } : {}),
        timestamp: new Date().toISOString(),
      });
    }

    if (method === "POST" && rawPath.endsWith("/metrics/sms/otp/verify")) {
      await assertAssignedServices(auth.tenantId, "campaigns");
      const parsed = VerifySmsOtpSchema.safeParse(JSON.parse(event.body ?? "{}"));
      if (!parsed.success) {
        return badRequest(parsed.error.errors[0]?.message ?? "Invalid request body");
      }

      const result = await verifyOtp({
        tenantId: auth.tenantId,
        to: parsed.data.to,
        code: parsed.data.code,
      });

      return ok({
        verified: result.verified,
        reason: result.reason,
        ...(result.attemptsRemaining !== undefined
          ? { attemptsRemaining: result.attemptsRemaining }
          : {}),
        timestamp: new Date().toISOString(),
      });
    }

    if (method === "GET" && rawPath.endsWith("/metrics/inbox-sla")) {
      const inboxSla = await getInboxSlaMetrics(auth.tenantId);
      return ok(inboxSla);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/conversation-categories")) {
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      const categories = await getConversationCategoryMetrics(auth.tenantId, options);
      return ok(categories);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/advisor-workload")) {
      const qs = event.queryStringParameters ?? {};
      const botId = qs.botId?.trim();
      const from = qs.from?.trim();
      const to = qs.to?.trim();
      const workload = await getAdvisorWorkloadMetrics(auth.tenantId, {
        ...(botId ? { botId } : {}),
        ...(from && to ? { from, to } : {}),
      });
      return ok(workload);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/calling")) {
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      const calling = await getCallingMetrics(auth.tenantId, options);
      return ok(calling);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/sales")) {
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
        includeProducts?: boolean;
        includeCsat?: boolean;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      if (qs.includeProducts === "false") options.includeProducts = false;
      if (qs.includeCsat === "false") options.includeCsat = false;
      const sales = await getSalesMetrics(auth.tenantId, options);
      return ok(sales);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/website")) {
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      const website = await getWebsiteMetrics(auth.tenantId, options);
      return ok(website);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/whatsapp-usage")) {
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      const report = await getWhatsAppUsageReport(auth.tenantId, options);
      return ok(report);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/campaign-performance")) {
      await assertAssignedServices(auth.tenantId, "campaigns");
      const qs = event.queryStringParameters ?? {};
      const daysParam = qs.days ? parseInt(qs.days, 10) : undefined;
      const options: {
        from?: string;
        to?: string;
        days?: number;
        botId?: string;
      } = {};
      if (qs.from) options.from = qs.from;
      if (qs.to) options.to = qs.to;
      if (daysParam !== undefined && Number.isFinite(daysParam)) options.days = daysParam;
      const botId = qs.botId?.trim();
      if (botId) options.botId = botId;
      const report = await getCampaignPerformanceReport(auth.tenantId, options);
      return ok(report);
    }

    if (method === "GET") {
      const metrics = await getTenantUsageMetrics(auth.tenantId);
      return ok(metrics);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
