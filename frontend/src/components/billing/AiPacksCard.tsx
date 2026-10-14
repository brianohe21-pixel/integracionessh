"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBillingStatus } from "@/hooks/useBilling";
import { useT } from "@/i18n/context";
import { formatCopPrice } from "@/lib/plan-config";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  SettingsCard,
  SettingsCardSkeleton,
} from "@/components/settings/SettingsCard";

export function AiPacksCard() {
  const t = useT();
  const router = useRouter();
  const { data, isLoading } = useBillingStatus();

  if (isLoading || !data) {
    return <SettingsCardSkeleton lines={4} />;
  }

  if (!data.canPurchaseAiPacks || !data.aiPacks?.length) return null;

  const aiUsage = data.aiUsage;

  return (
    <SettingsCard
      icon={<Sparkles className="h-4 w-4" />}
      title={t("billing.aiPacksTitle")}
      description={t("billing.aiPacksHint")}
      badge={
        aiUsage && aiUsage.bonusGranted > 0 ? (
          <Badge variant="info">
            {t("billing.aiPackBonusRemaining", {
              count: aiUsage.bonusRemaining.toLocaleString(),
            })}
          </Badge>
        ) : undefined
      }
    >
      {aiUsage && aiUsage.bonusGranted > 0 ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
            <p className="text-sm text-secondary">{t("billing.aiPackPlanUsed")}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {aiUsage.planUsed.toLocaleString()}
              <span className="font-normal text-muted">
                {" "}
                / {aiUsage.planLimit.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
            <p className="text-sm text-secondary">{t("billing.aiPackBonusUsed")}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {aiUsage.bonusUsed.toLocaleString()}
              <span className="font-normal text-muted">
                {" "}
                / {aiUsage.bonusGranted.toLocaleString()}
              </span>
            </p>
          </div>
          <div className="rounded-xl border border-subtle bg-surface px-4 py-3">
            <p className="text-sm text-secondary">{t("billing.aiPackEffectiveLimit")}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-primary">
              {aiUsage.totalUsed.toLocaleString()}
              <span className="font-normal text-muted">
                {" "}
                / {aiUsage.effectiveLimit.toLocaleString()}
              </span>
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.aiPacks.map((pack) => (
          <div
            key={pack.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-subtle bg-surface px-4 py-4"
          >
            <div>
              <p className="text-lg font-semibold tabular-nums text-primary">
                {t("billing.aiPackMessages", {
                  count: pack.messages.toLocaleString(),
                })}
              </p>
              <p className="mt-1 text-sm text-secondary">{formatCopPrice(pack.priceCents)}</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                router.push(`/billing/checkout?packId=${encodeURIComponent(pack.id)}`)
              }
            >
              {t("billing.aiPackBuy")}
            </Button>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}
