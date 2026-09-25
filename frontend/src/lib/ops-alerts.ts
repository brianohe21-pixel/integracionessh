import { OPS_ALERT_RULE_IDS, type OpsAlertRuleId, type OpsAlertsSettings } from "@/types";

export { OPS_ALERT_RULE_IDS };

export const DEFAULT_OPS_ALERTS: OpsAlertsSettings = {
  emailRecipients: [],
  rules: OPS_ALERT_RULE_IDS.map((id) => {
    if (id === "plan_usage") {
      return { id, enabled: false, inApp: true, email: false, thresholdPercent: 85 };
    }
    if (id === "telephony_spend") {
      return { id, enabled: false, inApp: true, email: false, thresholdUsd: 50 };
    }
    return { id, enabled: false, inApp: true, email: false };
  }),
};

export function resolveOpsAlertsSettings(
  settings?: OpsAlertsSettings | null
): OpsAlertsSettings {
  const byId = new Map((settings?.rules ?? []).map((rule) => [rule.id, rule]));
  return {
    emailRecipients: (settings?.emailRecipients ?? [])
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
    rules: DEFAULT_OPS_ALERTS.rules.map((fallback) => {
      const existing = byId.get(fallback.id as OpsAlertRuleId);
      if (!existing) return { ...fallback };
      return {
        ...fallback,
        enabled: Boolean(existing.enabled),
        inApp: existing.inApp !== false,
        email: Boolean(existing.email),
        ...(fallback.id === "plan_usage"
          ? {
              thresholdPercent:
                typeof existing.thresholdPercent === "number"
                  ? existing.thresholdPercent
                  : 85,
            }
          : {}),
        ...(fallback.id === "telephony_spend"
          ? {
              thresholdUsd:
                typeof existing.thresholdUsd === "number" ? existing.thresholdUsd : 50,
            }
          : {}),
      };
    }),
  };
}
