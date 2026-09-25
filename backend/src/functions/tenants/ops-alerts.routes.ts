import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import type { AuthContext, OpsAlertRuleId, OpsAlertsSettings } from "../../types/index.js";
import { assertSettingsAccess } from "../../lib/auth/permissions.js";
import { writeAuditEvent } from "../../lib/audit/write-audit-event.js";
import {
  listOpsAlerts,
  markAllOpsAlertsRead,
  markOpsAlertRead,
} from "../../lib/dynamodb/ops-alert.repository.js";
import { ensureTenant, getTenant, updateTenant } from "../../lib/dynamodb/tenant.repository.js";
import { badRequest, handleError, ok, parseJsonBody } from "../../lib/http.js";
import { OPS_ALERT_RULE_IDS, resolveOpsAlertsSettings } from "../../lib/ops-alerts/settings.js";

const RuleSchema = z.object({
  id: z.enum(OPS_ALERT_RULE_IDS as [OpsAlertRuleId, ...OpsAlertRuleId[]]),
  enabled: z.boolean(),
  inApp: z.boolean(),
  email: z.boolean(),
  thresholdPercent: z.number().min(1).max(100).optional(),
  thresholdUsd: z.number().min(1).max(1_000_000).optional(),
});

const UpdateOpsAlertsSchema = z.object({
  emailRecipients: z.array(z.string().email()).max(20),
  rules: z.array(RuleSchema).min(1).max(20),
});

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ") || "Invalid input";
}

function extractAlertId(rawPath: string): string | null {
  const match = rawPath.match(/\/ops-alerts\/([^/]+)\/read$/);
  return match?.[1] && match[1] !== "read-all" ? decodeURIComponent(match[1]) : null;
}

export async function handleOpsAlertsRoutes(
  event: APIGatewayProxyEventV2WithJWTAuthorizer,
  auth: AuthContext
): Promise<APIGatewayProxyResultV2 | null> {
  const rawPath = event.rawPath ?? event.requestContext.http.path ?? "";
  if (!rawPath.includes("/tenants/me/ops-alerts")) return null;

  const method = (event.requestContext.http.method ?? "").toUpperCase();

  try {
    const isWriteSettings = method === "PUT" && rawPath.endsWith("/ops-alerts");
    await assertSettingsAccess(auth, isWriteSettings ? "PUT" : "GET");
    await ensureTenant(auth.tenantId, auth.email, auth.name);

    if (method === "GET" && rawPath.endsWith("/ops-alerts/history")) {
      const unreadOnly = event.queryStringParameters?.unreadOnly === "true";
      const limit = Number(event.queryStringParameters?.limit ?? 50);
      const alerts = await listOpsAlerts(auth.tenantId, {
        limit: Number.isFinite(limit) ? limit : 50,
        unreadOnly,
      });
      return ok({ alerts });
    }

    if (method === "POST" && rawPath.endsWith("/ops-alerts/read-all")) {
      const marked = await markAllOpsAlertsRead(auth.tenantId);
      return ok({ marked });
    }

    const alertId = extractAlertId(rawPath);
    if (method === "POST" && alertId) {
      const alert = await markOpsAlertRead(auth.tenantId, alertId);
      if (!alert) return badRequest("Alert not found");
      return ok(alert);
    }

    if (method === "GET" && rawPath.endsWith("/ops-alerts")) {
      const tenant = await getTenant(auth.tenantId);
      return ok(resolveOpsAlertsSettings(tenant?.opsAlerts));
    }

    if (method === "PUT" && rawPath.endsWith("/ops-alerts")) {
      const body = parseJsonBody(event);
      const parsed = UpdateOpsAlertsSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest(formatZodError(parsed.error));
      }

      const incomingById = new Map(parsed.data.rules.map((rule) => [rule.id, rule]));
      for (const id of OPS_ALERT_RULE_IDS) {
        if (!incomingById.has(id)) {
          return badRequest(`Missing rule: ${id}`);
        }
      }

      const opsAlerts: OpsAlertsSettings = resolveOpsAlertsSettings({
        emailRecipients: parsed.data.emailRecipients,
        rules: parsed.data.rules.map((rule) => ({
          id: rule.id,
          enabled: rule.enabled,
          inApp: rule.inApp,
          email: rule.email,
          ...(rule.thresholdPercent !== undefined
            ? { thresholdPercent: rule.thresholdPercent }
            : {}),
          ...(rule.thresholdUsd !== undefined ? { thresholdUsd: rule.thresholdUsd } : {}),
        })),
      });

      const updated = await updateTenant(auth.tenantId, { opsAlerts });
      await writeAuditEvent({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        actorEmail: auth.email,
        module: "settings",
        action: "update",
        entityType: "opsAlerts",
        entityId: auth.tenantId,
        summary: "Updated ops alert settings",
      });
      return ok(resolveOpsAlertsSettings(updated.opsAlerts));
    }

    return badRequest("Route not found");
  } catch (error) {
    return handleError(error);
  }
}
