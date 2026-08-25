"use client";

import { Badge } from "@/components/ui/Badge";
import { useT } from "@/i18n/context";
import type { TenantWhatsAppRiskSummary } from "@/types";

function riskVariant(
  risk: TenantWhatsAppRiskSummary["risk"]
): "success" | "warning" | "danger" | "default" {
  if (risk === "ok") return "success";
  if (risk === "warn") return "warning";
  if (risk === "block") return "danger";
  return "default";
}

interface WhatsAppRiskBadgeProps {
  risk?: TenantWhatsAppRiskSummary | null;
  compact?: boolean;
}

export function WhatsAppRiskBadge({ risk, compact = false }: WhatsAppRiskBadgeProps) {
  const t = useT();

  if (!risk || risk.risk === "none") {
    return (
      <span className="text-xs text-secondary" title={t("whatsapp.riskNoneHint")}>
        {t("whatsapp.riskNone")}
      </span>
    );
  }

  const label = t(`whatsapp.risk_${risk.risk}`);
  const scoreLabel =
    risk.score !== null ? t("whatsapp.riskScore", { score: String(risk.score) }) : null;

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={riskVariant(risk.risk)}>{label}</Badge>
      {!compact && scoreLabel ? (
        <span className="text-xs text-secondary">{scoreLabel}</span>
      ) : null}
    </div>
  );
}
