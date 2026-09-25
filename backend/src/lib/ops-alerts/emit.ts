import { getTenant } from "../dynamodb/tenant.repository.js";
import {
  createOpsAlert,
  releaseOpsAlertDedupe,
  tryClaimOpsAlertDedupe,
} from "../dynamodb/ops-alert.repository.js";
import { sendEmail } from "../email/client.js";
import { publishRealtimeEventSafe } from "../realtime/publish.js";
import type { OpsAlert, OpsAlertRuleId, OpsAlertSeverity } from "../../types/index.js";
import { getOpsAlertRule, resolveOpsAlertsSettings } from "./settings.js";

export interface EmitOpsAlertParams {
  tenantId: string;
  ruleId: OpsAlertRuleId;
  title: string;
  body: string;
  href: string;
  severity?: OpsAlertSeverity;
  dedupeKey: string;
  dedupeTtlSeconds?: number;
}

export async function emitOpsAlert(
  params: EmitOpsAlertParams
): Promise<OpsAlert | null> {
  const tenant = await getTenant(params.tenantId);
  if (!tenant) return null;

  const settings = resolveOpsAlertsSettings(tenant.opsAlerts);
  const rule = getOpsAlertRule(settings, params.ruleId);
  if (!rule.enabled) return null;
  if (!rule.inApp && !rule.email) return null;

  const claimed = await tryClaimOpsAlertDedupe(
    params.tenantId,
    params.dedupeKey,
    params.dedupeTtlSeconds
  );
  if (!claimed) return null;

  try {
    const alert = await createOpsAlert({
      tenantId: params.tenantId,
      ruleId: params.ruleId,
      title: params.title,
      body: params.body,
      href: params.href,
      severity: params.severity ?? "warning",
      dedupeKey: params.dedupeKey,
    });

    if (rule.inApp) {
      publishRealtimeEventSafe(params.tenantId, {
        type: "ops.alert",
        alert,
      });
    }

    if (rule.email && settings.emailRecipients.length > 0) {
      await sendEmail({
        to: settings.emailRecipients,
        subject: `[Ops] ${alert.title}`,
        text: [alert.body, "", `Open: ${alert.href}`].join("\n"),
      }).catch((error) => {
        console.warn("Ops alert email failed:", error);
      });
    }

    return alert;
  } catch (error) {
    await releaseOpsAlertDedupe(params.tenantId, params.dedupeKey).catch(() => undefined);
    throw error;
  }
}

export function emitOpsAlertSafe(params: EmitOpsAlertParams): void {
  void emitOpsAlert(params).catch((error) => {
    console.error("Failed to emit ops alert:", error);
  });
}
