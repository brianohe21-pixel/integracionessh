import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { extractAuthContext, assertMemberRole } from "../../lib/auth/cognito.js";
import { getTenantUsageMetrics } from "../../lib/dynamodb/metrics.repository.js";
import { getMarketingMetrics } from "../../lib/dynamodb/marketing-metrics.repository.js";
import { getLeadMetrics } from "../../lib/dynamodb/lead-metrics.repository.js";
import { getCallingMetrics } from "../../lib/dynamodb/call-metrics.repository.js";
import { getInboxSlaMetrics } from "../../lib/dynamodb/inbox-sla-metrics.repository.js";
import { getAdvisorWorkloadMetrics } from "../../lib/dynamodb/advisor-workload.repository.js";
import { buildUsageMarketingCsv } from "../../lib/reports/metrics-csv.js";
import { ok, badRequest, handleError } from "../../lib/http.js";

export async function handler(
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  try {
    const auth = extractAuthContext(event);
    assertMemberRole(auth);
    const method = event.requestContext.http.method;
    const rawPath = event.rawPath ?? event.requestContext.http.path;

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

    if (method === "GET" && rawPath.endsWith("/metrics/marketing")) {
      const marketing = await getMarketingMetrics(auth.tenantId);
      return ok(marketing);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/inbox-sla")) {
      const inboxSla = await getInboxSlaMetrics(auth.tenantId);
      return ok(inboxSla);
    }

    if (method === "GET" && rawPath.endsWith("/metrics/advisor-workload")) {
      const workload = await getAdvisorWorkloadMetrics(auth.tenantId);
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

    if (method === "GET") {
      const metrics = await getTenantUsageMetrics(auth.tenantId);
      return ok(metrics);
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
