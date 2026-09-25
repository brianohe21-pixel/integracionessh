import type {
  OpsAlertRuleId,
  OpsAlertRuleSettings,
  OpsAlertsSettings,
} from "../../types/index.js";

export const OPS_ALERT_RULE_IDS: OpsAlertRuleId[] = [
  "sla_breached",
  "webhook_failed",
  "campaign_stopped",
  "whatsapp_quality",
  "plan_usage",
  "telephony_spend",
  "channel_down",
];

const DEFAULT_RULES: OpsAlertRuleSettings[] = OPS_ALERT_RULE_IDS.map((id) => {
  if (id === "plan_usage") {
    return { id, enabled: false, inApp: true, email: false, thresholdPercent: 85 };
  }
  if (id === "telephony_spend") {
    return { id, enabled: false, inApp: true, email: false, thresholdUsd: 50 };
  }
  return { id, enabled: false, inApp: true, email: false };
});

export function resolveOpsAlertsSettings(
  settings?: OpsAlertsSettings | null
): OpsAlertsSettings {
  const byId = new Map((settings?.rules ?? []).map((rule) => [rule.id, rule]));
  const rules = DEFAULT_RULES.map((fallback) => {
    const existing = byId.get(fallback.id);
    if (!existing) return { ...fallback };
    return {
      id: fallback.id,
      enabled: Boolean(existing.enabled),
      inApp: existing.inApp !== false,
      email: Boolean(existing.email),
      ...(fallback.id === "plan_usage"
        ? {
            thresholdPercent:
              typeof existing.thresholdPercent === "number" &&
              Number.isFinite(existing.thresholdPercent)
                ? Math.min(100, Math.max(1, Math.round(existing.thresholdPercent)))
                : 85,
          }
        : {}),
      ...(fallback.id === "telephony_spend"
        ? {
            thresholdUsd:
              typeof existing.thresholdUsd === "number" &&
              Number.isFinite(existing.thresholdUsd)
                ? Math.max(1, Math.round(existing.thresholdUsd * 100) / 100)
                : 50,
          }
        : {}),
    };
  });

  return {
    emailRecipients: (settings?.emailRecipients ?? [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    rules,
  };
}

export function getOpsAlertRule(
  settings: OpsAlertsSettings,
  ruleId: OpsAlertRuleId
): OpsAlertRuleSettings {
  return (
    settings.rules.find((rule) => rule.id === ruleId) ?? {
      id: ruleId,
      enabled: false,
      inApp: true,
      email: false,
    }
  );
}

export function tenantHasActiveScanRules(settings?: OpsAlertsSettings | null): boolean {
  const resolved = resolveOpsAlertsSettings(settings);
  return resolved.rules.some(
    (rule) =>
      rule.enabled &&
      (rule.id === "sla_breached" ||
        rule.id === "plan_usage" ||
        rule.id === "telephony_spend")
  );
}
