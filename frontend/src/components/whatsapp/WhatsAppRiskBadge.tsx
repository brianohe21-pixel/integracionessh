"use client";

import { AlertTriangle, CheckCircle2, MessageCircle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Tooltip } from "@/components/ui/Tooltip";
import { useT } from "@/i18n/context";
import { cn } from "@/lib/utils";
import type { TenantWhatsAppRiskSummary } from "@/types";

function riskVariant(
  risk: TenantWhatsAppRiskSummary["risk"]
): "success" | "warning" | "danger" | "default" {
  if (risk === "ok") return "success";
  if (risk === "warn") return "warning";
  if (risk === "block") return "danger";
  return "default";
}

function riskIconClass(risk: TenantWhatsAppRiskSummary["risk"] | "none"): string {
  if (risk === "ok") return "text-success bg-success/10 ring-success/20";
  if (risk === "warn") return "text-warning bg-warning/10 ring-warning/20";
  if (risk === "block") return "text-danger bg-danger/10 ring-danger/20";
  return "text-muted bg-surface-muted ring-default";
}

interface WhatsAppRiskBadgeProps {
  risk?: TenantWhatsAppRiskSummary | null;
  compact?: boolean;
  iconOnly?: boolean;
}

export function WhatsAppRiskBadge({
  risk,
  compact = false,
  iconOnly = false,
}: WhatsAppRiskBadgeProps) {
  const t = useT();
  const level = !risk || risk.risk === "none" ? "none" : risk.risk;
  const statusLabel =
    level === "none" ? t("whatsapp.riskNone") : t(`whatsapp.risk_${level}`);
  const scoreLabel =
    risk && risk.score !== null ? t("whatsapp.riskScore", { score: String(risk.score) }) : null;

  if (iconOnly) {
    const Icon =
      level === "ok"
        ? CheckCircle2
        : level === "warn"
          ? AlertTriangle
          : level === "block"
            ? ShieldAlert
            : MessageCircle;

    const tooltipLine =
      level === "none"
        ? t("whatsapp.riskNoneHint")
        : scoreLabel
          ? `${statusLabel} · ${scoreLabel}`
          : statusLabel;

    return (
      <Tooltip
        side="bottom"
        content={
          <span className="whitespace-nowrap">
            <span className="font-semibold">{t("whatsapp.riskTitle")}</span>
            {": "}
            {tooltipLine}
          </span>
        }
      >
        <button
          type="button"
          aria-label={`${t("whatsapp.riskTitle")}: ${statusLabel}`}
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 transition-colors hover:opacity-90",
            riskIconClass(level)
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      </Tooltip>
    );
  }

  if (!risk || risk.risk === "none") {
    return (
      <span className="text-xs text-secondary" title={t("whatsapp.riskNoneHint")}>
        {t("whatsapp.riskNone")}
      </span>
    );
  }

  const label = t(`whatsapp.risk_${risk.risk}`);

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={riskVariant(risk.risk)}>{label}</Badge>
      {!compact && scoreLabel ? (
        <span className="text-xs text-secondary">{scoreLabel}</span>
      ) : null}
    </div>
  );
}
